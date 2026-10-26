import { and, eq } from "drizzle-orm";
import { db, harnessArtifactsTable } from "@workspace/db";
import { artifactDisplayName } from "@workspace/artifact-naming";

type Artifact = typeof harnessArtifactsTable.$inferSelect;
type Reader = Pick<typeof db, "select">;

/** Call while holding the owned session row lock; numbering is per source lineage. */
export async function nextBoomerangUpgrade(reader: Reader, source: Artifact) {
  let root = source;
  const seen = new Set<string>();
  for (;;) {
    if (seen.has(root.id) || seen.size >= 100) throw new Error("Upgrade lineage requires human review");
    seen.add(root.id);
    const previous = (root.artifactContent as Record<string, unknown> | null)?.boomerangUpgrade as Record<string, unknown> | undefined;
    if (!previous || !root.parentArtifactId || previous.parentArtifactId !== root.parentArtifactId) break;
    const [parent] = await reader.select().from(harnessArtifactsTable).where(and(
      eq(harnessArtifactsTable.id, root.parentArtifactId),
      eq(harnessArtifactsTable.userId, source.userId),
      eq(harnessArtifactsTable.sessionId, source.sessionId),
    )).limit(1);
    if (!parent) throw new Error("Upgrade source lineage is no longer available");
    root = parent;
  }
  const rows = await reader.select({
    content: harnessArtifactsTable.artifactContent,
  }).from(harnessArtifactsTable).where(and(
    eq(harnessArtifactsTable.userId, source.userId),
    eq(harnessArtifactsTable.sessionId, source.sessionId),
  ));
  const numbers = rows.map(row => (row.content as Record<string, unknown> | null)?.boomerangUpgrade as Record<string, unknown> | undefined)
    .filter(meta => meta?.rootArtifactId === root.id)
    .map(meta => meta!.number)
    .filter((n): n is number => Number.isSafeInteger(n) && Number(n) > 0);
  const number = Math.max(0, ...numbers) + 1;
  return {
    number, label: `Upgraded ${number}`, rootArtifactId: root.id,
    parentArtifactId: source.id, rootName: artifactDisplayName(root) === "Untitled artifact"
      ? root.artifactType.replaceAll("_", " ") : artifactDisplayName(root),
    gateState: "NOT_EVALUATED",
  };
}

export function returnedArtifactHref(sessionId: string, featureId: number, artifactId: string) {
  return `/session/${encodeURIComponent(sessionId)}?featureId=${featureId}&artifactId=${encodeURIComponent(artifactId)}#artifact-${encodeURIComponent(artifactId)}`;
}
