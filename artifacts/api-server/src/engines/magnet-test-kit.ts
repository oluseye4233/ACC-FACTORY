import { z } from "zod/v4";
import type { Request, Response } from "express";
import { MagnetTestKitBody } from "@workspace/api-zod";
import { MAGNET_TEST_KIT_SYSTEM } from "./prompts";
import { callLlmJson } from "./shared";
import {
  MAGNET_TEST_KIT_ENGINE_ID,
  clientIp,
  ensureMagnetSystemUserId,
  hashIp,
  recordMagnetSession,
} from "../lib/magnet";

const DimensionName = z.enum(["CLARITY", "STRUCTURE", "ROBUSTNESS"]);

const TestKitOutputSchema = z.object({
  dimensions: z
    .array(
      z.object({
        name: DimensionName,
        score: z.number().int().min(0).max(10),
        note: z.string(),
      }),
    )
    .min(1),
  headline: z.string(),
  strengths: z.array(z.string()).default([]),
  fixes: z.array(z.string()).default([]),
});

type Band = "LITE-PASS" | "LITE-REVIEW" | "LITE-FAIL";

/**
 * Bucket the summed dimension score (0..30) into a coarse band. This is the
 * ONLY place the outcome is decided — the model never reports a band, and the
 * raw total is never sent to the client.
 */
function bandForScore(total: number): Band {
  if (total >= 22) return "LITE-PASS";
  if (total >= 12) return "LITE-REVIEW";
  return "LITE-FAIL";
}

/**
 * Anonymous Agent Test Kit (D25 magnet). Runs one lightweight inference and
 * returns a quality BAND only. The raw numeric score is summed and bucketed
 * server-side and is never included in the response. Ephemeral: the submitted
 * prompt is not persisted (only its length + outcome).
 */
export async function handleMagnetTestKit(req: Request, res: Response): Promise<void> {
  const parsed = MagnetTestKitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { prompt, email } = parsed.data;

  const userId = await ensureMagnetSystemUserId();
  const userPrompt = `Rate this AI prompt / agent instruction with the Test Kit.\n\n<<<SUBMISSION>>>\n${prompt}\n<<<END_SUBMISSION>>>`;

  let out: z.infer<typeof TestKitOutputSchema>;
  try {
    out = await callLlmJson("claude", MAGNET_TEST_KIT_SYSTEM, userPrompt, TestKitOutputSchema, {
      sessionId: null,
      userId,
      engineId: MAGNET_TEST_KIT_ENGINE_ID,
    });
  } catch (err) {
    req.log.error({ err }, "Magnet test-kit engine call failed");
    res.status(502).json({ error: "Engine call failed", detail: (err as Error).message });
    return;
  }

  // Recompute the outcome server-side; never trust a model-stated verdict.
  const total = out.dimensions.reduce((sum, d) => sum + d.score, 0);
  const band = bandForScore(total);

  const session = await recordMagnetSession({
    tool: "test_kit",
    ipHash: hashIp(clientIp(req)),
    email: email ?? null,
    inputChars: prompt.length,
    band,
    rawScore: total,
    provider: "claude",
  });

  // Strip all numeric scores from the payload — band label + qualitative copy only.
  res.json({
    magnetSessionId: session.id,
    band,
    headline: out.headline,
    strengths: out.strengths,
    fixes: out.fixes,
    dimensions: out.dimensions.map((d) => ({ name: d.name, note: d.note })),
  });
}
