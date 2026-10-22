import { useMemo, useState } from "react";
import { isRec, rec, str } from "@/lib/artifact-ops";
import { lineChanges } from "@/lib/bundle-diff";

export function InternalEditorialChanges({ value, sourceHash }: { value: unknown; sourceHash: string | null }) {
  const evidence = rec(value);
  const edits = Array.isArray(evidence.changes) ? evidence.changes : [];
  const valid = sourceHash && evidence.sourceHash === sourceHash && typeof evidence.reviewedContentHash === "string" &&
    edits.length <= 100 && edits.every(e => isRec(e) && typeof e.blockId === "string" &&
      typeof e.before === "string" && typeof e.after === "string" && e.before.length <= 30000 && e.after.length <= 12000);
  const [blockId, setBlockId] = useState("");
  const changes = edits.map(rec);
  const selected = changes.find(e => e.blockId === blockId) ?? changes[0];
  const diff = useMemo(() => lineChanges(str(selected?.before) ?? "", str(selected?.after) ?? ""), [selected?.before, selected?.after]);
  if (!isRec(value)) return <p className="text-muted-foreground">KLARITY edit evidence was not retained in this assessment. Download its saved review if available; no edits have been inferred.</p>;
  if (!valid) return <p role="alert" className="text-destructive">KLARITY comparison unavailable: its evidence is incomplete or does not match this assessment’s source.</p>;
  return <section className="border rounded p-3 space-y-2" aria-label="KLARITY edit comparison">
    <h4 className="font-semibold">KLARITY · original → edited prose</h4>
    <p className="break-all text-muted-foreground">Source {sourceHash}<br />Reviewed content {String(evidence.reviewedContentHash)}</p>
    <p>Internal model edits only. Protected content remains unchanged. This does not establish truth, external verification or permission to publish.</p>
    {changes.length ? <>
      <label className="block">Edited paragraph
        <select className="block w-full rounded border bg-background p-2" value={str(selected?.blockId) ?? ""} onChange={e => setBlockId(e.target.value)}>
          {changes.map(e => <option key={String(e.blockId)} value={String(e.blockId)}>{String(e.blockId)}</option>)}
        </select>
      </label>
      {diff.fullReplacement && <p>Large paragraph: showing complete removed and added text.</p>}
      <pre className="max-h-72 overflow-auto border rounded p-2" aria-label="KLARITY paragraph changes">
        {diff.lines.map((line, i) => <span key={i} className={`block whitespace-pre-wrap ${line.kind === "removed" ? "bg-destructive/10" : line.kind === "added" ? "bg-primary/10" : ""}`}>
          {line.kind === "removed" ? "− " : line.kind === "added" ? "+ " : "  "}{line.text}
        </span>)}
      </pre>
    </> : <p>No paragraph edits were applied in this assessment.</p>}
  </section>;
}
