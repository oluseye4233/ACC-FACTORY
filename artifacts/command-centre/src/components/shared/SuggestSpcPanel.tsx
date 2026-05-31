import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Sparkles, ExternalLink, Search } from "lucide-react";

interface Candidate {
  listingId?: string | null;
  title?: string | null;
  author?: string | null;
  topic?: string | null;
  score?: number | null;
  certTier?: string | null;
  points?: number | null;
  pricePoints?: number | null;
  summary?: string | null;
  listingUrl?: string | null;
}

interface Props {
  /** SPC (or in-progress artifact) to seed the synthesis query from. */
  artifactId?: string;
  /** Fallback topic when there is no named artifact yet. */
  topic?: string;
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "results"; query: string; candidates: Candidate[] }
  | { kind: "not-connected" }
  | { kind: "not-live" }
  | { kind: "error"; message: string };

function pickPoints(c: Candidate): number | null {
  if (typeof c.pricePoints === "number") return c.pricePoints;
  if (typeof c.points === "number") return c.points;
  return null;
}

export function SuggestSpcPanel({ artifactId, topic }: Props) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [selected, setSelected] = useState<string | null>(null);

  const suggest = async () => {
    setStatus({ kind: "loading" });
    setSelected(null);
    try {
      const r = await api.post<{ query: string; candidates: Candidate[] }>(
        "/api/integrations/sphinx/suggest",
        { ...(artifactId ? { artifactId } : {}), ...(topic ? { topic } : {}) },
      );
      setStatus({ kind: "results", query: r.query, candidates: r.candidates ?? [] });
    } catch (e) {
      if (e instanceof ApiError) {
        const code = (e.body as { code?: string } | null)?.code;
        if (code === "SPHINX_NOT_CONNECTED") {
          setStatus({ kind: "not-connected" });
          return;
        }
        if (code === "SPHINX_NOT_CONFIGURED" || code === "SPHINX_UNREACHABLE") {
          setStatus({ kind: "not-live" });
          return;
        }
        setStatus({ kind: "error", message: e.message });
        return;
      }
      setStatus({ kind: "error", message: "Could not reach Sphinx. Try again." });
    }
  };

  return (
    <div
      className="rounded border border-border/40 bg-background/30 p-3"
      data-testid="suggest-spc-panel"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-secondary" />
          <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-secondary">
            Suggest SPC · Synthesis Candidates
          </h4>
        </div>
        <Button
          onClick={suggest}
          size="sm"
          variant="outline"
          className="font-mono text-xs"
          disabled={status.kind === "loading"}
          data-testid="suggest-spc-run"
        >
          <Search className="mr-1 h-3 w-3" />
          {status.kind === "loading" ? "SEARCHING…" : "SUGGEST SPC"}
        </Button>
      </div>

      <p className="mb-2 font-mono text-[9px] leading-relaxed text-muted-foreground/70">
        Routes through the Sphinx Marketplace (the single point of sale) to rank
        the best SPCs you can synthesise with — select, buy on Sphinx, and fold
        into this session.
      </p>

      {status.kind === "not-connected" && (
        <p
          className="font-mono text-[10px] text-muted-foreground"
          data-testid="suggest-spc-not-connected"
        >
          Sphinx is not connected. Open{" "}
          <span className="text-foreground/80">Account → Connected Services</span>{" "}
          to paste your API key.
        </p>
      )}

      {status.kind === "not-live" && (
        <p
          className="font-mono text-[10px] text-muted-foreground"
          data-testid="suggest-spc-not-live"
        >
          The Sphinx Marketplace is not live yet. Synthesis suggestions will
          appear here as soon as the marketplace API is connected.
        </p>
      )}

      {status.kind === "error" && (
        <p
          className="font-mono text-[10px] text-destructive"
          data-testid="suggest-spc-error"
        >
          {status.message}
        </p>
      )}

      {status.kind === "results" && status.candidates.length === 0 && (
        <p
          className="font-mono text-[10px] text-muted-foreground"
          data-testid="suggest-spc-empty"
        >
          No synthesis candidates found on Sphinx for “{status.query}”.
        </p>
      )}

      {status.kind === "results" && status.candidates.length > 0 && (
        <ul className="space-y-2" data-testid="suggest-spc-results">
          {status.candidates.map((c, i) => {
            const id = c.listingId ?? String(i);
            const points = pickPoints(c);
            const isSelected = selected === id;
            return (
              <li
                key={id}
                className={`rounded border p-2 transition-colors ${
                  isSelected
                    ? "border-primary/60 bg-primary/5"
                    : "border-border/40 bg-background/40"
                }`}
                data-testid={`suggest-spc-candidate-${i}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-[11px] font-bold text-foreground/90">
                      {c.title ?? "Untitled SPC"}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] text-muted-foreground">
                      {c.author && <span>by {c.author}</span>}
                      {c.topic && <span>· {c.topic}</span>}
                      {c.certTier && <span>· {c.certTier}</span>}
                      {typeof c.score === "number" && (
                        <span>· match {Math.round(c.score * 100) / 100}</span>
                      )}
                      {points != null && <span>· {points} pts</span>}
                    </div>
                  </div>
                  <Button
                    onClick={() => setSelected(isSelected ? null : id)}
                    size="sm"
                    variant={isSelected ? "default" : "ghost"}
                    className="shrink-0 font-mono text-[10px]"
                    data-testid={`suggest-spc-select-${i}`}
                  >
                    {isSelected ? "SELECTED" : "SELECT"}
                  </Button>
                </div>
                {c.summary && (
                  <p className="mt-1 font-mono text-[9px] leading-relaxed text-muted-foreground/80">
                    {c.summary}
                  </p>
                )}
                {isSelected && c.listingUrl && (
                  <a
                    href={c.listingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 font-mono text-[10px] text-primary hover:underline"
                    data-testid={`suggest-spc-buy-${i}`}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Buy &amp; use on Sphinx
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
