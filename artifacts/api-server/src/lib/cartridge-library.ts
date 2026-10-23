import { createHash } from "node:crypto";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { z } from "zod/v4";
import { db, exemplarLibraryItemsTable, type CartridgeLibrarySnapshot } from "@workspace/db";
import { getExemplar, listExemplars } from "../data/exemplars";

const MAX_SOURCE_CHARS = 250_000;
const MAX_TOTAL_CHARS = 1_000_000;
const Selection = z.array(z.string().min(1).max(120)).max(10)
  .refine((ids) => new Set(ids).size === ids.length, "Choose each artifact only once");

export class CartridgeLibraryError extends Error {
  constructor(message: string, public readonly status: number = 400) { super(message); }
}

export function parseCartridgeExemplarIds(raw: unknown): string[] {
  if (raw === undefined) return [];
  try {
    const result = Selection.safeParse(typeof raw === "string" ? JSON.parse(raw) : raw);
    if (!result.success) throw new Error();
    return result.data;
  } catch {
    throw new CartridgeLibraryError("exemplarIds must be a JSON array of up to 10 distinct Exemplar IDs.");
  }
}

function usable(body: string): boolean {
  return body.trim().length >= 20 && body.length <= MAX_SOURCE_CHARS;
}

// Match the authenticated internal catalog's existing active-reference access.
// Withdrawn/archived contributions may only be reused by their owner.
function accessible(userId: string) {
  return or(eq(exemplarLibraryItemsTable.active, true), eq(exemplarLibraryItemsTable.ownerUserId, userId));
}

export async function listCartridgeLibrary(userId: string) {
  const rows = await db.select().from(exemplarLibraryItemsTable)
    .where(accessible(userId))
    .orderBy(desc(exemplarLibraryItemsTable.createdAt), desc(exemplarLibraryItemsTable.id));
  return [
    ...listExemplars().flatMap((item) => {
      const source = getExemplar(item.id);
      return source && usable(source.body) ? [{
        id: item.id, title: item.title, kind: item.kind, active: true,
        source: "curated" as const, characters: source.body.length,
      }] : [];
    }),
    ...rows.filter((row) => usable(row.body)).map((row) => ({
      id: row.id, title: row.title, kind: row.kind, active: row.active,
      source: "library" as const, characters: row.body.length,
    })),
  ];
}

export async function snapshotCartridgeLibrary(userId: string, ids: string[]): Promise<CartridgeLibrarySnapshot[]> {
  if (!ids.length) return [];
  const contributedIds = ids.filter((id) => z.uuid().safeParse(id).success);
  const rows = contributedIds.length
    ? await db.select().from(exemplarLibraryItemsTable).where(and(
      inArray(exemplarLibraryItemsTable.id, contributedIds), accessible(userId),
    )) : [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  let total = 0;
  return ids.map((id) => {
    const curated = getExemplar(id);
    const row = byId.get(id);
    const artifact = curated ?? row;
    if (!artifact) throw new CartridgeLibraryError("A selected library artifact is unavailable. Refresh the library selection.", 404);
    if (!usable(artifact.body)) throw new CartridgeLibraryError(
      `“${artifact.title}” must contain 20–250,000 characters of usable text.`,
    );
    total += artifact.body.length;
    if (total > MAX_TOTAL_CHARS) throw new CartridgeLibraryError("Selected library sources exceed 1,000,000 characters. Choose fewer artifacts.");
    return {
      id, title: artifact.title, kind: artifact.kind,
      active: curated ? true : row!.active,
      source: curated ? "curated" as const : "library" as const,
      characters: artifact.body.length,
      body: artifact.body,
      contentSha256: createHash("sha256").update(artifact.body, "utf8").digest("hex"),
    };
  });
}
