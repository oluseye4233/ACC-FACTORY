import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { CartridgeLibrarySnapshot } from "@workspace/api-client-react";
import { Download, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildExemplarDownloadFilename, getExemplarDownloadFormat } from "@/lib/exemplar-download";
import { libraryOriginLabel } from "./LibrarySourcePicker";

function downloadSnapshot(s: CartridgeLibrarySnapshot) {
  const format = getExemplarDownloadFormat(s.body);
  const filename = buildExemplarDownloadFilename({ id: s.id, kind: s.kind, title: s.title }, format.extension);
  const url = URL.createObjectURL(new Blob([s.body], { type: format.mimeType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function RetainedLibrarySources({ sources }: { sources: CartridgeLibrarySnapshot[] }) {
  return (
    <div data-testid="retained-library-sources">
      <p className="text-xs font-serif text-muted-foreground flex gap-2">
        <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0 text-secondary" />
        Snapshots captured at build time. They remain readable here even if the library item later changes or is
        deleted. Archived items are not restored or commercialized. Model context receives bounded excerpts; the full
        snapshot stays available below. References are supporting input, not executable authority.
      </p>
      {sources.length === 0 ? (
        <p className="mt-2 text-xs font-serif italic text-muted-foreground" data-testid="status-retained-empty">
          No library sources were retained with this cartridge.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {sources.map((s) => (
            <li key={s.id} className="rounded-md border bg-card/60 p-3" data-testid={`retained-source-${s.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-serif text-sm text-foreground">{s.title}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    <span>{s.kind}</span>
                    <span className={s.active ? "text-primary" : "text-secondary"}>
                      {s.active ? "Active at capture" : "Archived at capture"}
                    </span>
                    <span>{libraryOriginLabel(s.source)}</span>
                    <span>ID {s.id.slice(0, 8)}</span>
                    <span>{s.characters.toLocaleString()} chars</span>
                    <span title={s.contentSha256}>SHA {s.contentSha256.slice(0, 12)}</span>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => downloadSnapshot(s)} className="font-mono text-[10px]" data-testid={`button-download-retained-${s.id}`}>
                  <Download className="h-3 w-3 mr-1" /> DOWNLOAD
                </Button>
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wider text-primary" data-testid={`toggle-read-retained-${s.id}`}>
                  Read snapshot
                </summary>
                <div className="mt-2 max-h-96 overflow-auto rounded bg-background/70 p-3 prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.body}</ReactMarkdown>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
