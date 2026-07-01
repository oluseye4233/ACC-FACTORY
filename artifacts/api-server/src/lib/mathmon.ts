/**
 * MATHMON Core & FORGE VERIFIED gate (D26 · MM-FV).
 *
 * The mathematical-verification layer sits between the HARNESS engines and the
 * public certificate: F0.5 profiles a concept (MATHMON Intake) → the MAP
 * (Mathematical Applicability Profile) scores it → the MM-FV gate at F7 decides
 * whether the certified artifact earns the FORGE VERIFIED badge.
 *
 * The gate rule is ABSOLUTE and has no override:
 *   forgeVerified = (jcse ≥ 45 AND mathmonScore ≥ 70)
 *
 * `mathmonScore` is ALWAYS recomputed server-side from the MAP's three
 * sub-scores (PFP discipline — the model's self-reported composite is ignored):
 *   mathmonScore = mathCoherence×0.40 + applicability×0.35 + predictiveReliability×0.25
 */

/** JCSE gate threshold (0–50 rubric; 45 ≈ GOLD). */
export const JCSE_PASS_THRESHOLD = 45;

/** MATHMON composite gate threshold (0–100). */
export const MATHMON_PASS_THRESHOLD = 70;

/** Sub-score weights for the MATHMON composite. Must sum to 1.0. */
export const MATHMON_WEIGHTS = {
  mathCoherence: 0.4,
  applicability: 0.35,
  predictiveReliability: 0.25,
} as const;

/**
 * The mandatory embedded FORGE VERIFIED disclaimer. Attached to every FORGE
 * VERIFIED artifact and every MAP economic projection, and surfaced anywhere
 * that status is displayed.
 */
export const FORGE_VERIFIED_DISCLAIMER =
  "FORGE VERIFIED confirms mathematical verification of this specification only. " +
  "It is NOT a runtime safety certification and does not guarantee the safety, " +
  "correctness, or performance of any system built from it. Economic projections " +
  "are modelled ranges, not guarantees.";

export interface MathmonSubScores {
  mathCoherence: number;
  applicability: number;
  predictiveReliability: number;
}

/** Clamp a value into the 0–100 sub-score range and round to an integer. */
export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Recompute the composite MATHMON score from the three sub-scores. Rounded to a
 * whole number. Always call this server-side — never trust a model-reported
 * composite.
 */
export function computeMathmonScore(sub: MathmonSubScores): number {
  const mc = clampScore(sub.mathCoherence);
  const ap = clampScore(sub.applicability);
  const pr = clampScore(sub.predictiveReliability);
  return Math.round(
    mc * MATHMON_WEIGHTS.mathCoherence +
      ap * MATHMON_WEIGHTS.applicability +
      pr * MATHMON_WEIGHTS.predictiveReliability,
  );
}

/**
 * The absolute FORGE VERIFIED gate. Both thresholds must be met; there is no
 * override. A null mathmonScore (no MAP for the session) can never pass.
 */
export function computeForgeVerified(
  jcse: number | null | undefined,
  mathmonScore: number | null | undefined,
): boolean {
  if (jcse == null || mathmonScore == null) return false;
  return jcse >= JCSE_PASS_THRESHOLD && mathmonScore >= MATHMON_PASS_THRESHOLD;
}
