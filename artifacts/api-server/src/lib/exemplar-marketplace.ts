import { createHash } from "node:crypto";
import { z } from "zod/v4";
import type { ExemplarLibraryItem } from "@workspace/db";
import { readSpcPlayerPublication } from "./spc-player";

export const POLICY_VERSION = "SPHINX_BASELINE_V1" as const;
export const COMMERCIAL_KINDS = ["MA", "SPC", "MPDD", "PDD"] as const;
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
export const qualificationBody = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  notes: z.string().trim().min(10).max(2000),
  jcse: z.number().int().min(0).max(50),
  tokenCount: z.number().int().positive().max(1_000_000),
  version: z.string().trim().regex(SEMVER_RE),
  documentation: z.string().trim().min(5).max(2000),
  tests: z.string().trim().min(5).max(2000),
  rightsCleared: z.boolean(),
  safetyReviewed: z.boolean(),
}).strict().superRefine((value, ctx) => {
  if (value.decision !== "APPROVED") return;
  if (value.jcse < 35 || value.tokenCount > 100_000 ||
      !value.rightsCleared || !value.safetyReviewed) {
    ctx.addIssue({
      code: "custom",
      message: "Approval requires JCSE ≥35/50, ≤100,000 tokens, rights clearance and safety review.",
    });
  }
});

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
}

export function exemplarContentHash(row: Pick<ExemplarLibraryItem, "title" | "tagline" | "kind" | "body" | "artifactSnapshot">) {
  return createHash("sha256").update(canonical({
    title: row.title, tagline: row.tagline, kind: row.kind,
    body: row.body, snapshot: row.artifactSnapshot,
  })).digest("hex");
}

export function commercialEligibility(row: ExemplarLibraryItem) {
  const reasons: string[] = [];
  if (!COMMERCIAL_KINDS.includes(row.kind as typeof COMMERCIAL_KINDS[number])) {
    reasons.push("Only MA, SPC, MPDD and PDD artifacts can enter Sphinx. F0 reports are advisory only.");
  }
  if (!row.active) reasons.push("Reactivate this library artifact before selecting Sphinx.");
  const snapshot = row.artifactSnapshot as Record<string, unknown> | null;
  if (snapshot && (snapshot.gro === "RED" || snapshot.gro === "GREY")) {
    reasons.push("The source artifact has an unresolved GRO safety state.");
  }
  const review = row.qualification;
  if (!review || review.decision !== "APPROVED") {
    reasons.push(review?.decision === "REJECTED" ? "Internal review did not approve this artifact." : "Internal standards review is required.");
  } else {
    if (review.policyVersion !== POLICY_VERSION || review.contentHash !== exemplarContentHash(row)) {
      reasons.push("Qualification is out of date; review the current artifact again.");
    }
    if (!Number.isInteger(review.jcse) || review.jcse < 35 || review.jcse > 50 ||
        !Number.isInteger(review.tokenCount) || review.tokenCount < 1 || review.tokenCount > 100_000 ||
        !review.rightsCleared || !review.safetyReviewed ||
        !review.documentation?.trim() || !review.tests?.trim() ||
        !SEMVER_RE.test(review.version ?? "") ||
        !review.reviewedBy || !review.reviewedAt) {
      reasons.push("The internal standards evidence is incomplete.");
    }
  }
  return { eligible: reasons.length === 0, reasons };
}

export function libraryMarketplaceSummary(row: ExemplarLibraryItem, viewerId?: string, admin = false) {
  const eligibility = commercialEligibility(row);
  return {
    active: row.active,
    artifactMode: row.artifactMode,
    isOwner: row.ownerUserId === viewerId,
    canReview: admin && COMMERCIAL_KINDS.includes(row.kind as typeof COMMERCIAL_KINDS[number]),
    eligibility,
    qualification: row.qualification ? {
      decision: row.qualification.decision,
      reviewedAt: row.qualification.reviewedAt,
      policyVersion: row.qualification.policyVersion,
      jcse: row.qualification.jcse,
      tokenCount: row.qualification.tokenCount,
      version: row.qualification.version,
      // Internal evidence/notes are never included in the public catalog.
      ...(row.ownerUserId === viewerId || admin ? {
        notes: row.qualification.notes,
        documentation: row.qualification.documentation,
        tests: row.qualification.tests,
      } : {}),
    } : null,
  };
}

export function exemplarSummary(row: ExemplarLibraryItem, viewerId?: string, admin = false) {
  return {
    id: row.id, title: row.title, tagline: row.tagline,
    jcse: row.qualification?.decision === "APPROVED" ? row.qualification.jcse : null,
    certClass: null,
    source: "generated" as const, kind: row.kind,
    sku: `OPEN-${row.kind}-${row.id.slice(0, 8).toUpperCase()}`,
    disc: null, marketplace: "open" as const,
    createdAt: row.createdAt.toISOString(),
    spcPlayer: row.kind === "SPC" ? readSpcPlayerPublication(row.artifactSnapshot) : null,
    ...libraryMarketplaceSummary(row, viewerId, admin),
  };
}
