export type BundleFile = { path: string; content: string };
export type FileChange = { path: string; status: "added" | "removed" | "changed" | "unchanged"; before?: string; after?: string };

export function bundleChanges(before: BundleFile[], after: BundleFile[]): FileChange[] {
  const old = new Map(before.map(f => [f.path, f.content]));
  const next = new Map(after.map(f => [f.path, f.content]));
  return [...new Set([...old.keys(), ...next.keys()])].sort().map(path => ({
    path, before: old.get(path), after: next.get(path),
    status: !old.has(path) ? "added" : !next.has(path) ? "removed" :
      old.get(path) === next.get(path) ? "unchanged" : "changed",
  }));
}

export function bundleFiles(content: unknown): BundleFile[] | null {
  if (!content || typeof content !== "object") return null;
  const files = (content as { files?: unknown }).files;
  if (!Array.isArray(files) || files.length > 12 || files.some(f =>
    !f || typeof f.path !== "string" || typeof f.content !== "string" || f.content.length > 40000)) return null;
  if (new Set(files.map(f => f.path)).size !== files.length) return null;
  return files;
}

/** Exact line changes. Bound LCS work; for huge files use an explicit full
 * replacement rather than freezing the browser or silently truncating evidence.
 */
export function lineChanges(before: string, after: string) {
  const a = before.split("\n"), b = after.split("\n");
  type Line = { kind: "same" | "removed" | "added"; text: string };
  const lines: Line[] = [];
  if (a.length * b.length > 250000) {
    return { fullReplacement: true, lines: [
      ...a.map(text => ({ kind: "removed" as const, text })),
      ...b.map(text => ({ kind: "added" as const, text })),
    ] };
  }
  const width = b.length + 1;
  const grid = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) {
    grid[i * width + j] = a[i] === b[j] ? 1 + grid[(i + 1) * width + j + 1] :
      Math.max(grid[(i + 1) * width + j], grid[i * width + j + 1]);
  }
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { lines.push({ kind: "same", text: a[i++] }); j++; }
    else if (i < a.length && (j === b.length || grid[(i + 1) * width + j] >= grid[i * width + j + 1])) {
      lines.push({ kind: "removed", text: a[i++] });
    } else lines.push({ kind: "added", text: b[j++] });
  }
  return { fullReplacement: false, lines };
}
