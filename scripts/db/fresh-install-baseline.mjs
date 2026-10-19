import { createHash } from "node:crypto";

export const sha256 = text => createHash("sha256").update(text).digest("hex");

export function baselinePayload(source) {
  const start = source.indexOf("/*");
  const end = source.lastIndexOf("*/");
  if (start < 0 || end < start || source.slice(end + 2).trim()) {
    throw new Error("Unexpected introspection baseline format; review required.");
  }
  return source.slice(start + 2, end).split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean);
}

// A separate, versioned fresh-install baseline recipe. The historical source
// must match exactly; new source changes require explicit review, not heuristics.
export function freshInstallBaseline(source, manifest) {
  if (manifest.version !== "FRESH-INSTALL-1" || sha256(source) !== manifest.sourceSha256) {
    throw new Error("Fresh-install baseline source checksum/version mismatch; review required.");
  }
  const statements = baselinePayload(source);
  const replaced = new Set();
  for (const replacement of manifest.replacements) {
    const matches = statements.flatMap((statement, index) => statement === replacement.before ? [index] : []);
    if (matches.length !== 1 || replaced.has(matches[0])) throw new Error("Fresh-install baseline replacement mismatch; review required.");
    statements[matches[0]] = replacement.after;
    replaced.add(matches[0]);
  }
  const executedSql = statements.join("\n--> statement-breakpoint\n");
  return { statements, hash: sha256(executedSql), manifestHash: sha256(JSON.stringify(manifest)) };
}
