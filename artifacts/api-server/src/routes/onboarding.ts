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
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

router.get("/me/jst", requireAuth, async (req, res): Promise<void> => {
  const userId = req.localUser!.id;
  const rows = await db
    .select()
    .from(jstAssessmentsTable)
    .where(eq(jstAssessmentsTable.userId, userId))
    .orderBy(sql`${jstAssessmentsTable.createdAt} DESC`);
  const history = rows.map(jstToJson);
  res.json({
    latest: history[0] ?? null,
    history,
    count: history.length,
  });
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
    notes: notes ?? null,
  });

  const rows = await db
    .select()
    .from(jstAssessmentsTable)
    .where(eq(jstAssessmentsTable.userId, userId))
    .orderBy(sql`${jstAssessmentsTable.createdAt} DESC`);
  const history = rows.map(jstToJson);
  res.json({
    latest: history[0] ?? null,
    history,
    count: history.length,
  });
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

export default router;
