import { evaluateJsonContract } from "../xvl-contract";
import { evaluateSprintEligibility, sprintEligibilityInputSchema } from "../short-sprint-eligibility";
import { hashContent } from "./imprima-model";

type Check = { id: string; label: string; state: "PASS" | "FAIL" | "INCONCLUSIVE" | "NOT_RUN"; detail: string };
export const INTERNAL_CAVEAT = "Internal assessment only, using recorded internal scores and bounded deterministic checks. Not independently evaluated, certified, approved for Final publication, marketplace qualified, sealed or released. No deployment or stage advancement is authorized. Missing evidence is not a pass.";
type Scores = { jcseScore: number | null; mathmonScore: number | null };

/** No external receipts, verification statuses or protected workflow records are written here. */
export function internalEvaluation(input: {
  kind: "imprima" | "short-sprints"; sourceHash: string; source: unknown;
  scores: Scores; assessedAt: Date;
  sprint?: { circuit: "SC_ONE" | "SC_TWO"; target: "SOFTWARE" | "FIRMWARE"; profile: "PROTOTYPE_LIGHT" | "STANDARD" | "REGULATED"; manifest: Record<string, unknown> };
}) {
  const checks: Check[] = [
    { id: "SOURCE_SAFETY", label: "Existing source safety scan", state: "PASS", detail: "The existing preparation safety scan accepted this source and any supplied manifest. This is heuristic screening, not a security audit." },
    { id: "SOURCE_VERSION_BOUND", label: "Source version binding", state: "PASS", detail: `Assessment bound to source SHA-256 ${input.sourceHash}.` },
  ];
  for (const [id, label, value, threshold] of [
    ["JCSE", "Recorded source JCSE", input.scores.jcseScore, 45],
    ["MATHMON", "Recorded source MATHMON", input.scores.mathmonScore, 70],
  ] as const) {
    checks.push({ id, label, state: value === null ? "NOT_RUN" : value >= threshold ? "PASS" : "FAIL",
      detail: value === null ? "No score is recorded on this exact source artifact. Scores from unrelated or earlier artifacts are not substituted."
        : `Inherited source score ${value}; internal comparison threshold ${threshold}. No fresh judge or runtime test was run.` });
  }
  let eligibility: ReturnType<typeof evaluateSprintEligibility> | null = null;
  if (input.sprint) {
    const { manifest, circuit, target, profile } = input.sprint;
    const result = evaluateJsonContract(manifest, [
      { path: "/inputContract", operator: "type", expected: "object" },
      { path: "/outputContract", operator: "type", expected: "object" },
      { path: "/systemPrompt", operator: "minLength", expected: 1 },
      { path: "/tools", operator: "type", expected: "array" },
      { path: "/constraints", operator: "type", expected: "array" },
    ]);
    checks.push({ id: "JSON_CONTRACT", label: "Internal manifest structure", state: result.outcome,
      detail: "Existing deterministic JSON adapter checks declared manifest structure only; it does not execute the agent or validate its behaviour." });
    const unknown = { value: null, evidenceHash: null };
    // Keep the original policy's certified/measured facts unknown. A manifest
    // assertion or internal score must never become an external certification.
    const facts: Record<string, { value: number | boolean | null; evidenceHash: string | null }> =
      Object.fromEntries(Object.keys(sprintEligibilityInputSchema.shape.facts.shape).map(key => [key, unknown]));
    facts.toolCount = { value: Array.isArray(manifest.tools) ? manifest.tools.length : null, evidenceHash: hashContent(manifest) };
    eligibility = evaluateSprintEligibility({ circuit, target, profile, sourceArtifactHash: input.sourceHash, facts });
    checks.push({ id: "SPRINT_ELIGIBILITY", label: "Existing sprint eligibility policy",
      state: eligibility.state === "ELIGIBLE" ? "PASS" : eligibility.state === "INELIGIBLE" ? "FAIL" : "INCONCLUSIVE",
      detail: `${eligibility.state}. Unresolved certified or measured facts remain UNKNOWN; no YES decision, verification pack or external route is opened.` });
  } else {
    checks.push({ id: "EDITORIAL_REVIEW", label: "KLARITY / SOCRATES review", state: "NOT_RUN",
      detail: "Source-preserving DRAFT rendering only. No new clarity, truthfulness or editorial model assessment is claimed." });
  }
  const state = checks.some(c => c.state === "FAIL") ? "FAIL" as const
    : checks.some(c => c.state === "NOT_RUN" || c.state === "INCONCLUSIVE") ? "INCONCLUSIVE" as const : "PASS" as const;
  return { schemaVersion: "ATANDA-INTERNAL-EVAL-1", state, sourceHash: input.sourceHash, assessedAt: input.assessedAt.toISOString(),
    caveat: INTERNAL_CAVEAT, checks, inheritedEvidence: { sourceScores: input.scores, sprintEligibility: eligibility },
    releaseAllowed: false as const, externalVerification: "NOT_RUN" as const };
}
