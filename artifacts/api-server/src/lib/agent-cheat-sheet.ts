/** A deterministic source extract, not a new paid generation or a safety verdict. */
export function spcCheatSheet(projectName: string, sourceId: string, source: Record<string, unknown>) {
  const sections = Array.isArray(source.sections) ? source.sections : [];
  const excerpts = sections.slice(0, 15).map((value, index) => {
    const s = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const title = String(s.title ?? s.key ?? `Section ${index + 1}`).slice(0, 100);
    const body = typeof s.body === "string" ? s.body : typeof s.content === "string" ? s.content : "";
    return `## ${title}\n${body.slice(0, 220)}${body.length > 220 ? "\n[Excerpt: consult the full source SPC.]" : ""}`;
  });
  return `# ${projectName.slice(0, 150)} — SPC Cheat Sheet

Source artifact: ${sourceId}
Preparation method: source extracts; not an independent evaluation.
Use: describe your task, follow the SPC workflow, and review its output before acting.
Runtime: text only. No tools, browsing, execution, deployment or external side effects.
Governance: preserve GRO, ZPOS and Honesty Gate. Stop/escalate unsafe or unauthorized requests.
The complete source SPC remains authoritative. Excerpts are not a replacement for its requirements, safety rules or evidence.

${excerpts.length ? excerpts.join("\n\n") : "No structured sections were supplied. Review the complete source SPC before use."}
`.slice(0, 6000);
}
