/** Never reuse a transient report until both source IDs are actually known. */
export function pfpContextMatches(
  context: { bundleId: string; sourceId: string } | undefined,
  bundleId: string | undefined,
  sourceId: string | undefined,
): boolean {
  return Boolean(context && bundleId && sourceId &&
    context.bundleId === bundleId && context.sourceId === sourceId);
}
