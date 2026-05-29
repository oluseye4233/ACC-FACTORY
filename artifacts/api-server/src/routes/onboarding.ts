import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import {
  db,
  jstAssessmentsTable,
  readerOnboardingTable,
} from "@workspace/db";
import { SubmitMyJstBody, ClaimReaderCodeBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import {
  computeAscension,
  getOnboardingState,
  scoreJst,
} from "../lib/ascension";

const router: IRouter = Router();

/**
 * Reader codes that map a reader of *The Atomic Prompt* onto the
 * `atomic_prompt_v1` onboarding track. Codes are case-insensitive. Kept as a
 * small allowlist for the MVP — any future code-issuance system can replace
 * this set without touching the route.
 */
const ATOMIC_PROMPT_READER_CODES = new Set(["ATOMICPROMPT", "BOOKONE", "ASCEND"]);

function jstToJson(row: typeof jstAssessmentsTable.$inferSelect) {
  return {
    id: row.id,
    jobsScore: row.jobsScore,
    skillsScore: row.skillsScore,
    talentScore: row.talentScore,
    composite: Number(row.composite),
    band: row.band,
    source: row.source,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

async function jstSummary(userId: string) {
  const rows = await db
    .select()
    .from(jstAssessmentsTable)
    .where(eq(jstAssessmentsTable.userId, userId))
    .orderBy(sql`${jstAssessmentsTable.createdAt} DESC`);
  const history = rows.map(jstToJson);
  return { latest: history[0] ?? null, history, count: history.length };
}

router.get("/me/jst", requireAuth, async (req, res): Promise<void> => {
  res.json(await jstSummary(req.localUser!.id));
});

router.post("/me/jst", requireAuth, async (req, res): Promise<void> => {
  const parsed = SubmitMyJstBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", detail: parsed.error.message });
    return;
  }
  const userId = req.localUser!.id;
  const { jobsScore, skillsScore, talentScore, notes } = parsed.data;
  // Generated Zod from `type: integer` only emits `.number()`, so guard the
  // integer contract here before the values reach integer DB columns.
  if (
    !Number.isInteger(jobsScore) ||
    !Number.isInteger(skillsScore) ||
    !Number.isInteger(talentScore)
  ) {
    res.status(400).json({ error: "Scores must be whole numbers from 1 to 10." });
    return;
  }
  const { composite, band } = scoreJst(jobsScore, skillsScore, talentScore);

  await db.insert(jstAssessmentsTable).values({
    userId,
    jobsScore,
    skillsScore,
    talentScore,
    composite: String(composite),
    band,
    source: "self_assessment",
    notes: notes ?? null,
  });

  res.json(await jstSummary(userId));
});

router.get("/me/ascension", requireAuth, async (req, res): Promise<void> => {
  const userId = req.localUser!.id;
  const journey = await computeAscension(userId);
  res.json(journey);
});

router.post(
  "/me/onboarding/reader-code",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = ClaimReaderCodeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", detail: parsed.error.message });
      return;
    }
    const userId = req.localUser!.id;
    const normalized = parsed.data.code.trim().toUpperCase().replace(/[\s-]/g, "");

    if (!ATOMIC_PROMPT_READER_CODES.has(normalized)) {
      res.status(400).json({
        error: "Unrecognised reader code",
        detail: "Check the code printed in your copy of The Atomic Prompt.",
      });
      return;
    }

    // Ensure a row exists, then upgrade the track.
    await getOnboardingState(userId);
    await db
      .update(readerOnboardingTable)
      .set({ track: "atomic_prompt_v1", readerCode: normalized })
      .where(eq(readerOnboardingTable.userId, userId));

    const state = await getOnboardingState(userId);
    res.json(state);
  },
);

/**
 * Import the user's JST score from the ARK.ONECRAFT production platform.
 *
 * ARK.ONECRAFT is the authoritative source of JST scores once the integration
 * is connected; an imported score is recorded with `source = 'ark_onecraft'`
 * and, being the newest row, supersedes any interim in-app self-assessment.
 *
 * Follows the env-gated external-integration pattern (cf. SPHINX): until the
 * server is configured with `ARK_ONECRAFT_BASE_URL` (+ `ARK_ONECRAFT_API_KEY`)
 * this endpoint returns 503 `ARK_NOT_CONFIGURED` rather than fabricating data.
 */
router.post("/me/jst/import-from-ark", requireAuth, async (req, res): Promise<void> => {
  const userId = req.localUser!.id;

  const arkBase = process.env.ARK_ONECRAFT_BASE_URL?.replace(/\/$/, "");
  const arkKey = process.env.ARK_ONECRAFT_API_KEY;
  if (!arkBase || !arkKey) {
    res.status(503).json({
      error: "The ARK.ONECRAFT integration is not yet connected on this server.",
      code: "ARK_NOT_CONFIGURED",
    });
    return;
  }

  // Fetch the authoritative JST score for this user from ARK.ONECRAFT.
  let arkRes: globalThis.Response;
  try {
    arkRes = await fetch(`${arkBase}/api/jst/score?externalUserId=${encodeURIComponent(userId)}`, {
      method: "GET",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${arkKey}`,
      },
    });
  } catch (err) {
    req.log.warn({ err }, "ARK.ONECRAFT JST import: network error");
    res.status(502).json({
      error: "Could not reach ARK.ONECRAFT.",
      code: "ARK_UNREACHABLE",
    });
    return;
  }

  const arkBody = (await arkRes.json().catch(() => null)) as
    | { jobsScore?: number; skillsScore?: number; talentScore?: number }
    | null;
  if (!arkRes.ok || !arkBody) {
    req.log.warn({ status: arkRes.status, body: arkBody }, "ARK.ONECRAFT JST import: rejected");
    res.status(502).json({
      error: "ARK.ONECRAFT rejected the JST score request.",
      code: "ARK_REJECTED",
    });
    return;
  }

  const jobsScore = Number(arkBody.jobsScore);
  const skillsScore = Number(arkBody.skillsScore);
  const talentScore = Number(arkBody.talentScore);
  const valid = [jobsScore, skillsScore, talentScore].every(
    (n) => Number.isInteger(n) && n >= 1 && n <= 10,
  );
  if (!valid) {
    res.status(502).json({
      error: "ARK.ONECRAFT returned an invalid JST score.",
      code: "ARK_INVALID_SCORE",
    });
    return;
  }

  const { composite, band } = scoreJst(jobsScore, skillsScore, talentScore);
  await db.insert(jstAssessmentsTable).values({
    userId,
    jobsScore,
    skillsScore,
    talentScore,
    composite: String(composite),
    band,
    source: "ark_onecraft",
    notes: "Imported from ARK.ONECRAFT",
  });

  res.json(await jstSummary(userId));
});

export default router;
