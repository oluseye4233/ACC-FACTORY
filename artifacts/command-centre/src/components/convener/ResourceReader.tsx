import type { CohortResource } from "@workspace/api-client-react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { downloadText, fmtWhen, slugFile } from "./convener-model";

export function downloadResource(r: CohortResource) {
  const text = `# ${r.title}\n\nKind: ${r.kind}\nShared: ${r.createdAt}\n${r.notes ? `\nConvener notes:\n${r.notes}\n` : ""}\n---\n\n${r.body}\n`;
  downloadText(slugFile(r.title, "md"), text, "text/markdown;charset=utf-8");
}

/** Read-only snapshot viewer. Body is rendered as plain preformatted text. */
export function ResourceReader({ resource, onClose }: { resource: CohortResource | null; onClose: () => void }) {
  return (
    <Dialog open={!!resource} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85dvh] flex flex-col" data-testid="dialog-resource">
        {resource && <>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{resource.title}</DialogTitle>
            <DialogDescription className="font-mono text-[10px] uppercase tracking-[0.14em]">{resource.kind} · snapshot shared {fmtWhen(resource.createdAt)}</DialogDescription>
          </DialogHeader>
          {resource.notes && <p className="text-sm border-l-2 border-secondary pl-3 whitespace-pre-wrap">{resource.notes}</p>}
          <pre className="flex-1 overflow-auto rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap font-mono" data-testid="text-resource-body">{resource.body || "This snapshot has no body."}</pre>
          <div className="flex justify-end"><Button size="sm" variant="outline" onClick={() => downloadResource(resource)} data-testid="button-download-resource-dialog"><Download className="h-3.5 w-3.5 mr-1" /> Download snapshot</Button></div>
        </>}
      </DialogContent>
    </Dialog>
  );
}
