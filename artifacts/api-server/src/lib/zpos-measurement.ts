import { createHash } from "node:crypto";
import { getEncoding } from "js-tiktoken";
import { z } from "zod/v4";

// One pinned reference encoding permits like-for-like document comparisons.
// It is NOT a claim about the selected provider's billed tokenization.
const encoder = getEncoding("cl100k_base");
const Sections = z.array(z.object({
  key: z.string(), title: z.string(), body: z.string(),
})).min(1);

function sectionBytes(value: unknown): string | null {
  let candidate = value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const doc = value as Record<string, unknown>;
    const parts = ["cheatSheet", "execSummary", "worksheet", "implementation"];
    if (parts.every(key => typeof doc[key] === "string" && (doc[key] as string).trim())) {
      // F6 produces a four-part document, not the F7 section-array shape.
      candidate = parts.map(key => ({ key, title: key, body: doc[key] }));
    } else candidate = doc.sections;
  }
  const parsed = Sections.safeParse(candidate);
  if (!parsed.success || !parsed.data.some(s => s.body.trim())) return null;
  return JSON.stringify(parsed.data.map(s => ({ key: s.key, title: s.title, body: s.body })));
}
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export function measureZposCompression(
  sourceArtifactId: string, sourceSections: unknown, resultSections: unknown,
) {
  const before = sectionBytes(sourceSections);
  const after = sectionBytes(resultSections);
  if (before === null || after === null) return null;
  // Treat apparent special-token text in user artifacts as ordinary text.
  const sourceTokens = encoder.encode(before, [], []).length;
  const resultTokens = encoder.encode(after, [], []).length;
  const tokensReduced = sourceTokens - resultTokens;
  return {
    version: "zpos-document-v1" as const,
    tokenizer: "cl100k_base" as const,
    scope: "document-content-json" as const,
    sourceArtifactId, sourceHash: hash(before), resultHash: hash(after),
    sourceTokens, resultTokens, tokensReduced,
    reductionPct: Math.round(tokensReduced / sourceTokens * 10000) / 100,
    measuredAt: new Date().toISOString(),
  };
}
