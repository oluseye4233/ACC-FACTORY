import { z } from "zod/v4";
import { MATHMON_WEIGHTS, type MathmonSubScores } from "./mathmon";

export const JCSE_PILLARS = [
  "SYSTEM",
  "ROLE",
  "INSTRUCTION",
  "EXAMPLE",
  "CONSTRAINT",
  "FORMAT",
  "DATA",
] as const;

export type JcsePillar = (typeof JCSE_PILLARS)[number];

const FeedbackSchema = z.object({
  explanation: z.string().optional(),
  gaps: z.array(z.string()).optional(),
  actions: z.array(z.string()).optional(),
});

export const JcsePillarFeedbackSchema = z.object({
  system: FeedbackSchema.optional(),
  role: FeedbackSchema.optional(),
  instruction: FeedbackSchema.optional(),
  example: FeedbackSchema.optional(),
  constraint: FeedbackSchema.optional(),
  format: FeedbackSchema.optional(),
  data: FeedbackSchema.optional(),
});

export const MathmonFeedbackSchema = z.object({
  mathCoherence: FeedbackSchema.optional(),
  applicability: FeedbackSchema.optional(),
  predictiveReliability: FeedbackSchema.optional(),
});

export type ScorecardFeedback = z.infer<typeof FeedbackSchema>;

export interface ScorecardDimension {
  key: string;
  label: string;
  score: number;
  maxScore: number;
  weightPercent: number | null;
  weightedContribution: number | null;
  explanation: string;
  gaps: string[];
  actions: string[];
}

export interface AdvisoryStep {
  priority: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  why: string;
  action: string;
  expectedImpact: string;
}

export interface Scorecard {
  kind: "JCSE" | "MATHMON";
  score: number;
  maxScore: number;
  summary: string;
  calculation: string;
  dimensions: ScorecardDimension[];
  strengths: string[];
  gaps: string[];
  advisoryReport: {
    summary: string;
    steps: AdvisoryStep[];
  };
}

const JCSE_DEFINITIONS: Record<JcsePillar, { label: string; max: number; guidance: string; action: string }> = {
  SYSTEM: {
    label: "System",
    max: 7,
    guidance: "Operating context, mission boundary, and governing rules.",
    action: "State the operating context, mission boundary, and governing rules explicitly.",
  },
  ROLE: {
    label: "Role",
    max: 7,
    guidance: "Persona, expertise, audience, voice, and authority.",
    action: "Name the role, required expertise, audience, and expected voice.",
  },
  INSTRUCTION: {
    label: "Instruction",
    max: 8,
    guidance: "A single, unambiguous, testable action.",
    action: "Rewrite the ask as one action with a clear completion condition.",
  },
  EXAMPLE: {
    label: "Example",
    max: 7,
    guidance: "Concrete examples or worked precedents that anchor the expected result.",
    action: "Add a representative input/output example that matches the desired result.",
  },
  CONSTRAINT: {
    label: "Constraint",
    max: 7,
    guidance: "Hard rules, exclusions, scope, and safety boundaries.",
    action: "List hard rules, exclusions, scope limits, and required safety boundaries.",
  },
  FORMAT: {
    label: "Format",
    max: 7,
    guidance: "Output structure, schema, length, style, and delivery target.",
    action: "Specify the output structure, required fields, length, and delivery format.",
  },
  DATA: {
    label: "Data",
    max: 7,
    guidance: "Required inputs, source material, definitions, and ground truth.",
    action: "List required inputs and sources, define key terms, and say how missing data is handled.",
  },
};

const MATHMON_DEFINITIONS = {
  mathCoherence: {
    label: "Math coherence",
    weight: MATHMON_WEIGHTS.mathCoherence,
    guidance: "Whether equations, variables, assumptions, and constraints form a consistent, solvable system.",
    action: "Define each variable and unit, make assumptions explicit, and check that equations and constraints are jointly solvable.",
  },
  applicability: {
    label: "Applicability",
    weight: MATHMON_WEIGHTS.applicability,
    guidance: "Whether the selected mathematics applies to this concept and its real decisions.",
    action: "Connect each model or equation to an observable decision, target, or constraint in the intake.",
  },
  predictiveReliability: {
    label: "Predictive reliability",
    weight: MATHMON_WEIGHTS.predictiveReliability,
    guidance: "Whether available data and assumptions support reliable predictions about real outcomes.",
    action: "Identify the data needed to validate predictions, then test sensitivity to uncertain assumptions.",
  },
} as const;

function cleanList(values: string[] | undefined, max = 4): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))].slice(0, max);
}

function priorityFor(score: number, maxScore: number): AdvisoryStep["priority"] {
  const ratio = maxScore > 0 ? score / maxScore : 0;
  if (ratio < 0.5) return "HIGH";
  if (ratio < 0.8) return "MEDIUM";
  return "LOW";
}

function makeAdvisory(dimensions: ScorecardDimension[], kind: Scorecard["kind"]) {
  const ordered = [...dimensions].sort((a, b) => {
    const aRatio = a.maxScore > 0 ? a.score / a.maxScore : 0;
    const bRatio = b.maxScore > 0 ? b.score / b.maxScore : 0;
    return aRatio - bRatio || a.label.localeCompare(b.label);
  });
  const steps = ordered.map((dimension) => ({
    priority: priorityFor(dimension.score, dimension.maxScore),
    title: `Improve ${dimension.label}`,
    why:
      dimension.gaps[0] ??
      `${dimension.label} scored ${dimension.score}/${dimension.maxScore}; this is one of the score's improvement opportunities.`,
    action: dimension.actions[0] ?? `Review the ${dimension.label} rubric and make the supporting evidence more specific.`,
    expectedImpact:
      kind === "JCSE"
        ? "A stronger pillar can raise the JCSE total; run the assessment again to measure the change."
        : "A stronger sub-score can improve the weighted MATHMON composite; rebuild the MAP to measure the change.",
  }));
  const weakest = ordered.slice(0, Math.min(3, ordered.length)).map((dimension) => dimension.label);
  return {
    summary:
      weakest.length > 0
        ? `Start with ${weakest.join(", ")}. These are the lowest-scoring dimensions relative to their maximums.`
        : "Review the score dimensions and strengthen the lowest-scoring areas first.",
    steps,
  };
}

function uniqueText(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function buildJcseScorecard(input: {
  score: number;
  scores: Record<JcsePillar, number>;
  maxScores?: Partial<Record<JcsePillar, number>>;
  feedback?: Partial<Record<Lowercase<JcsePillar>, ScorecardFeedback>>;
  strengths?: string[];
  gaps?: string[];
}): Scorecard {
  const dimensions = JCSE_PILLARS.map((pillar): ScorecardDimension => {
    const definition = JCSE_DEFINITIONS[pillar];
    const score = input.scores[pillar];
    const maxScore = input.maxScores?.[pillar] ?? definition.max;
    const feedback = input.feedback?.[pillar.toLowerCase() as Lowercase<JcsePillar>];
    const feedbackGaps = cleanList(feedback?.gaps);
    const actions = cleanList(feedback?.actions);
    const rationale =
      feedback?.explanation?.trim() ||
      `The model assigned ${score}/${maxScore} under the JCSE rubric. This pillar evaluates ${definition.guidance}`;
    return {
      key: pillar,
      label: definition.label,
      score,
      maxScore,
      weightPercent: null,
      weightedContribution: null,
      explanation: rationale,
      gaps: feedbackGaps,
      actions: actions.length > 0 ? actions : [definition.action],
    };
  });
  const calculation = `${JCSE_PILLARS.map((pillar) => `${pillar} ${input.scores[pillar]}`).join(" + ")} = ${input.score}/50`;
  const summary = `JCSE is the 7-pillar rubric total. The score is ${input.score}/50; use each pillar explanation and advisory step to see what drove it and what to improve.`;
  const advisoryReport = makeAdvisory(dimensions, "JCSE");
  return {
    kind: "JCSE",
    score: input.score,
    maxScore: 50,
    summary,
    calculation,
    dimensions,
    strengths: cleanList(input.strengths ?? [], 6),
    gaps: uniqueText([
      ...(input.gaps ?? []),
      ...dimensions.flatMap((dimension) => dimension.gaps),
    ]).slice(0, 10),
    advisoryReport,
  };
}

export function buildMathmonScorecard(input: {
  scores: MathmonSubScores;
  score: number;
  feedback?: Partial<Record<keyof MathmonSubScores, ScorecardFeedback>>;
}): Scorecard {
  const keys = ["mathCoherence", "applicability", "predictiveReliability"] as const;
  const dimensions = keys.map((key): ScorecardDimension => {
    const definition = MATHMON_DEFINITIONS[key];
    const score = input.scores[key];
    const feedback = input.feedback?.[key];
    const actions = cleanList(feedback?.actions);
    const gaps = cleanList(feedback?.gaps);
    return {
      key,
      label: definition.label,
      score,
      maxScore: 100,
      weightPercent: definition.weight * 100,
      weightedContribution: Number((score * definition.weight).toFixed(2)),
      explanation:
        feedback?.explanation?.trim() ||
        `The MAP assigned ${score}/100. This dimension evaluates ${definition.guidance}`,
      gaps,
      actions: actions.length > 0 ? actions : [definition.action],
    };
  });
  const calculation =
    `${input.scores.mathCoherence} × 40% + ${input.scores.applicability} × 35% + ` +
    `${input.scores.predictiveReliability} × 25% = ${input.score}/100 (rounded)`;
  const summary =
    `MATHMON is recomputed from the three MAP sub-scores using weights of 40%, 35%, and 25%, then rounded to ${input.score}/100.`;
  const advisoryReport = makeAdvisory(dimensions, "MATHMON");
  return {
    kind: "MATHMON",
    score: input.score,
    maxScore: 100,
    summary,
    calculation,
    dimensions,
    strengths: dimensions
      .filter((dimension) => dimension.score >= 80)
      .map((dimension) => `${dimension.label}: ${dimension.score}/100`),
    gaps: uniqueText(dimensions.flatMap((dimension) => dimension.gaps)).slice(0, 10),
    advisoryReport,
  };
}