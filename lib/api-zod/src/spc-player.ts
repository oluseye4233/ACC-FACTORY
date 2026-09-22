import { z } from "zod";

const SpcPlayerScoreAxesSchema = z
  .object({
    clarity: z.number().int().min(0).max(100).nullable(),
    truthfulness: z.number().int().min(0).max(100).nullable(),
    detectability: z.number().int().min(0).max(100).nullable(),
  })
  .strict();

const SpcPlayerGovernanceEvaluationSchema = z
  .object({
    kind: z.literal("governance_evaluation"),
    invoked: z.literal(true),
    verdict: z.string().min(1),
    content: z.string(),
    evidence: z.array(z.string()),
    scores: SpcPlayerScoreAxesSchema.extend({
      clarity: z.number().int().min(0).max(100),
      truthfulness: z.number().int().min(0).max(100),
      detectability: z.number().int().min(0).max(100),
    }),
    completedAt: z.string().datetime(),
  })
  .strict();

const SpcPlayerCompletedScoreAxesSchema = z
  .object({
    clarity: z.number().int().min(0).max(100),
    truthfulness: z.number().int().min(0).max(100),
    detectability: z.number().int().min(0).max(100),
  })
  .strict();

export const SpcPlayerOutputPackageSchema = z
  .object({
    content: z.array(
      z
        .object({
          stageIndex: z.number().int().min(0),
          cardId: z.string().uuid(),
          cardSlug: z.string().min(1),
          invoked: z.literal(true),
          verdict: z.string().min(1),
          content: z.string(),
          evidence: z.array(z.string()),
          completedAt: z.string().datetime(),
        })
        .strict(),
    ),
    governanceEvaluation: SpcPlayerGovernanceEvaluationSchema,
    advisory: z
      .object({
        authority: z.string().min(1),
        status: z.literal("PRE_BUILD"),
        profile: z.enum(["full", "rapid"]),
        invokedStages: z.array(z.number().int().min(0)),
        governanceEvaluationInvoked: z.boolean(),
        evidenceTrail: z.array(z.string()),
        distribution: z.string().min(1),
      })
      .strict(),
    scores: SpcPlayerCompletedScoreAxesSchema,
    distributionPlan: z
      .object({
        status: z.literal("plan_only"),
        connectorInvoked: z.literal(false),
        externalSend: z.literal(false),
      })
      .strict(),
  })
  .strict();