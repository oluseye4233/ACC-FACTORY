import { eq } from "drizzle-orm";
import {
  db,
  cartridgePackagesTable,
  cartridgeDocumentsTable,
  cartridgeSpcsTable,
  cartridgeLinksTable,
  harnessSessionsTable,
} from "@workspace/db";

const MAX_CONTEXT_BYTES = 24_000;
const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  block: string | null;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "\n…[truncated]";
}

export function invalidateCartridgeContext(sessionId: string): void {
  cache.delete(sessionId);
}

export async function loadCartridgeContext(
  sessionId: string,
): Promise<string | null> {
  const hit = cache.get(sessionId);
  if (hit && hit.expiresAt > Date.now()) return hit.block;

  const block = await buildCartridgeContext(sessionId);
  cache.set(sessionId, { block, expiresAt: Date.now() + CACHE_TTL_MS });
  return block;
}

async function buildCartridgeContext(sessionId: string): Promise<string | null> {
  const [session] = await db
    .select({
      origin: harnessSessionsTable.origin,
      cartridgeId: harnessSessionsTable.cartridgeId,
    })
    .from(harnessSessionsTable)
    .where(eq(harnessSessionsTable.id, sessionId));
  if (!session || session.origin !== "cartridge" || !session.cartridgeId) {
    return null;
  }
  const [pkg] = await db
    .select()
    .from(cartridgePackagesTable)
    .where(eq(cartridgePackagesTable.id, session.cartridgeId));
  if (!pkg) return null;

  const docs = await db
    .select()
    .from(cartridgeDocumentsTable)
    .where(eq(cartridgeDocumentsTable.cartridgeId, session.cartridgeId));
  const spcs = await db
    .select()
    .from(cartridgeSpcsTable)
    .where(eq(cartridgeSpcsTable.cartridgeId, session.cartridgeId));
  const links = await db
    .select()
    .from(cartridgeLinksTable)
    .where(eq(cartridgeLinksTable.cartridgeId, session.cartridgeId));

  const sections: string[] = [];
  sections.push("=== CARTRIDGE CONTEXT (authoritative · do not contradict) ===");
  sections.push(
    "The following PROJECT SCOPE was authored by the operator and is the SUPREME governing frame for every engine in this session. No downstream engine may contradict, reinterpret, dilute, or expand it. If a user instruction conflicts with this scope, the scope wins and the engine MUST surface the conflict in its diagnostics rather than silently broaden the brief.",
  );
  sections.push("");
  sections.push("## PROJECT SCOPE (HIGHEST PRIORITY)");
  sections.push(`- Project name: ${pkg.projectName}`);
  sections.push(`- Outcome (one liner): ${pkg.outcomeOneLiner}`);
  if (pkg.targetPlatformHint) {
    sections.push(`- Target platform hint: ${pkg.targetPlatformHint}`);
  }
  sections.push("- Scope statement:");
  sections.push(truncate(pkg.scopeStatement, 4000));
  sections.push("");
  sections.push("## SEED PROMPT (engine F1 baseline intent)");
  sections.push(truncate(pkg.seedPrompt, 4000));

  if (docs.length > 0) {
    sections.push("");
    sections.push("## SUPPORTING DOCUMENTS");
    for (const d of docs) {
      sections.push(`- ${d.originalFilename} (${d.fileSizeBytes} bytes):`);
      sections.push(truncate(d.summary, 1500));
    }
  }
  if (spcs.length > 0) {
    sections.push("");
    sections.push("## CANDIDATE SPCs (operator-supplied)");
    for (const s of spcs) {
      sections.push(`- ${s.label}:`);
      sections.push(truncate(s.summary || s.body, 1500));
    }
  }
  if (links.length > 0) {
    sections.push("");
    sections.push("## LINKED ARTEFACTS");
    for (const l of links) {
      sections.push(
        `- ${l.kind.toUpperCase()} :: ${l.descriptor}${l.note ? ` — ${l.note}` : ""}`,
      );
    }
  }
  sections.push("");
  sections.push("=== END CARTRIDGE CONTEXT ===");

  return truncate(sections.join("\n"), MAX_CONTEXT_BYTES);
}
