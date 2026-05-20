import { useState } from "react";
import type { IngestionDocument } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Check, ChevronDown, ChevronUp, Copy, FileText, ShieldCheck } from "lucide-react";

const KIND_LABEL: Record<IngestionDocument["sourceDocKind"], string> = {
  product_design_document: "Ingestion Product Design Document",
  software_design_document: "Software Design Document",
  concept_note: "Concept Note",
  spec_sheet: "Spec Sheet",
  other: "Source Document",
};

interface Props {
  ingestion: IngestionDocument;
  isF7: boolean;
}

export function IngestionBanner({ ingestion, isF7 }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ingestion.seedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({
        title: "Could not copy",
        description: "Clipboard access denied. Select the text manually.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="mb-4 md:mb-6 rounded-md border border-secondary/30 bg-secondary/5">
      <div className="p-3 md:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="h-9 w-9 rounded-md bg-secondary/15 border border-secondary/40 flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4 text-secondary" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-mono font-bold text-secondary tracking-wider">
              INGESTED · {KIND_LABEL[ingestion.sourceDocKind].toUpperCase()}
            </div>
            <div className="font-mono text-sm truncate">
              {ingestion.detectedTitle ?? ingestion.originalFilename}
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          className="font-mono text-[10px] shrink-0"
          data-testid="button-toggle-seed"
        >
          {open ? (
            <>
              HIDE SEED <ChevronUp className="h-3 w-3 ml-1" />
            </>
          ) : (
            <>
              VIEW SEED PROMPT <ChevronDown className="h-3 w-3 ml-1" />
            </>
          )}
        </Button>
      </div>

      {open && (
        <div className="border-t border-secondary/20 p-3 md:p-4 space-y-3">
          <div>
            <div className="text-[10px] font-mono font-bold text-muted-foreground tracking-wider mb-1">
              EXTRACTED SUMMARY
            </div>
            <p className="text-sm font-serif leading-relaxed text-foreground/90">
              {ingestion.summary}
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-[10px] font-mono font-bold text-primary tracking-wider">
                SEED PROMPT (paste into F1)
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={copy}
                className="h-7 px-2 font-mono text-[10px]"
                data-testid="button-copy-seed"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 mr-1" /> COPIED
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" /> COPY
                  </>
                )}
              </Button>
            </div>
            <pre className="rounded border border-primary/30 bg-primary/5 p-3 font-mono text-xs whitespace-pre-wrap break-words text-foreground">
{ingestion.seedPrompt}
            </pre>
          </div>
        </div>
      )}

      {isF7 && (
        <div className="border-t border-secondary/20 px-3 md:px-4 py-2 flex items-center gap-2 text-[11px] font-mono text-primary bg-primary/5 rounded-b-md">
          <ShieldCheck className="h-3.5 w-3.5" />
          On certification this stage produces a{" "}
          <strong>PromptWare Design Document (PWDD)</strong> — the post-ingestion
          outcome artefact.
        </div>
      )}
    </div>
  );
}
