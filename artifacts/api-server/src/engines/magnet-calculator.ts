import { z } from "zod/v4";
import type { Request, Response } from "express";
import { MagnetCalculatorBody } from "@workspace/api-zod";
import { MAGNET_CALCULATOR_SYSTEM } from "./prompts";
import { callLlmJson } from "./shared";
import {
  MAGNET_CALCULATOR_ENGINE_ID,
  clientIp,
  ensureMagnetSystemUserId,
  hashIp,
  recordMagnetSession,
} from "../lib/magnet";

const CalculatorOutputSchema = z.object({
  compoundLogicSignals: z.array(z.string()).default([]),
  redundancySignals: z.array(z.string()).default([]),
  headline: z.string(),
  rationale: z.string(),
});

type CompressionClass = "LOW" | "MEDIUM" | "HIGH" | "EXTREME";

/** Savings RANGE (low–high %) for each compression class. Never a single value. */
const RANGE_BY_CLASS: Record<CompressionClass, { low: number; high: number }> = {
  LOW: { low: 10, high: 25 },
  MEDIUM: { low: 25, high: 45 },
  HIGH: { low: 45, high: 65 },
  EXTREME: { low: 65, high: 85 },
};

/**
 * Bucket the total number of model-detected compressibility signals into a
 * class. Recomputed server-side from the signal COUNT — the model never reports
 * a class, a percentage, or a range.
 */
function classForSignalCount(count: number): CompressionClass {
  if (count >= 10) return "EXTREME";
  if (count >= 6) return "HIGH";
  if (count >= 3) return "MEDIUM";
  return "LOW";
}

/**
 * Anonymous Savings Calculator (D25 magnet). Runs one lightweight inference and
 * returns a compression-savings RANGE only — never a single precise percentage.
 * The class + range are derived server-side from the signal counts. Ephemeral:
 * the submitted artifact is not persisted (only its length + outcome).
 */
export async function handleMagnetCalculator(req: Request, res: Response): Promise<void> {
  const parsed = MagnetCalculatorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { artifact, email } = parsed.data;

  const userId = await ensureMagnetSystemUserId();
  const userPrompt = `Estimate the compression headroom in this prompt / spec.\n\n<<<ARTIFACT>>>\n${artifact}\n<<<END_ARTIFACT>>>`;

  let out: z.infer<typeof CalculatorOutputSchema>;
  try {
    out = await callLlmJson("claude", MAGNET_CALCULATOR_SYSTEM, userPrompt, CalculatorOutputSchema, {
      sessionId: null,
      userId,
      engineId: MAGNET_CALCULATOR_ENGINE_ID,
    });
  } catch (err) {
    req.log.error({ err }, "Magnet calculator engine call failed");
    res.status(502).json({ error: "Engine call failed", detail: (err as Error).message });
    return;
  }

  // Derive class + range server-side from signal COUNTS — never trust a
  // model-stated percentage or class.
  const signalCount = out.compoundLogicSignals.length + out.redundancySignals.length;
  const compressionClass = classForSignalCount(signalCount);
  const { low, high } = RANGE_BY_CLASS[compressionClass];

  const session = await recordMagnetSession({
    tool: "calculator",
    ipHash: hashIp(clientIp(req)),
    email: email ?? null,
    inputChars: artifact.length,
    savingsLowPct: low,
    savingsHighPct: high,
    compressionClass,
    rawScore: signalCount,
    provider: "claude",
  });

  // Return the RANGE only — no single precise percentage, no raw signal counts.
  res.json({
    magnetSessionId: session.id,
    savingsLowPct: low,
    savingsHighPct: high,
    compressionClass,
    headline: out.headline,
    rationale: out.rationale,
  });
}
