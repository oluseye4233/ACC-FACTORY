import { useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useStartSessionFromIngestion,
  getListSessionsQueryKey,
  type IngestionDocument,
} from "@workspace/api-client-react";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  FileUp,
  Loader2,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";

const ACCEPT = ".txt,.md,.markdown,.pdf,.docx,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_BYTES = 1 * 1024 * 1024;

type Kind = IngestionDocument["sourceDocKind"];
const KIND_OPTIONS: { value: Kind; label: string }[] = [
  { value: "product_design_document", label: "Product Design Document (PDD)" },
  { value: "software_design_document", label: "Software Design Document (SDD)" },
  { value: "concept_note", label: "Concept Note" },
  { value: "spec_sheet", label: "Spec Sheet" },
  { value: "other", label: "Other" },
];

const KIND_LABEL: Record<Kind, string> = Object.fromEntries(
  KIND_OPTIONS.map((o) => [o.value, o.label]),
) as Record<Kind, string>;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Ingest() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [declaredKind, setDeclaredKind] = useState<Kind | "auto">("auto");
  const [submitting, setSubmitting] = useState(false);
  const [ingestion, setIngestion] = useState<IngestionDocument | null>(null);
  const [editedSeed, setEditedSeed] = useState("");
  const [editedTitle, setEditedTitle] = useState("");

  const startSession = useStartSessionFromIngestion();

  const handleFileChange = (f: File | null) => {
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > MAX_BYTES) {
      toast({
        title: "File too large",
        description: "Maximum upload size is 1 MB.",
        variant: "destructive",
      });
      return;
    }
    setFile(f);
    setPastedText("");
  };

  const handleIngest = async () => {
    if (!file && pastedText.trim().length < 50) {
      toast({
        title: "Nothing to ingest",
        description: "Upload a file (≤ 1 MB) or paste at least 50 characters.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      if (file) formData.append("file", file);
      if (!file && pastedText) formData.append("pastedText", pastedText);
      if (declaredKind !== "auto") formData.append("sourceDocKind", declaredKind);

      const res = await fetch(`${basePath}/api/ingest`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Ingestion failed (${res.status})`);
      }
      const data = (await res.json()) as IngestionDocument;
      setIngestion(data);
      setEditedSeed(data.seedPrompt);
      setEditedTitle(data.detectedTitle ?? data.originalFilename);
    } catch (err) {
      toast({
        title: "Ingestion failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSession = async () => {
    if (!ingestion) return;
    startSession.mutate(
      {
        id: ingestion.id,
        data: {
          sessionName: `Ingested: ${editedTitle.slice(0, 200)}`,
          seedPrompt: editedSeed.trim(),
          detectedTitle: editedTitle.trim(),
        },
      },
      {
        onSuccess: (s) => {
          qc.invalidateQueries({ queryKey: getListSessionsQueryKey() });
          setLocation(`/session/${s.id}`);
        },
        onError: (err) => {
          toast({
            title: "Could not create session",
            description:
              (err as { data?: { error?: string } })?.data?.error ??
              "An unexpected error occurred",
            variant: "destructive",
          });
        },
      },
    );
  };

  const inputReady = Boolean(file) || pastedText.trim().length >= 50;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <TopNav />
      <main className="flex-1">
        <section className="border-b bg-gradient-to-b from-secondary/5 to-background">
          <div className="container px-4 md:px-6 py-8 md:py-12 max-w-4xl">
            <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4">
              <Link href="/command" className="gap-2 text-muted-foreground">
                <ArrowLeft className="h-4 w-4" /> RETURN TO COMMAND
              </Link>
            </Button>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-mono text-primary mb-3">
              <Sparkles className="h-3 w-3" />
              PRE-SESSION FUNCTION · PRACTITIONER+
            </div>
            <h1 className="font-display text-3xl md:text-5xl tracking-wider mb-3">
              INGESTION <span className="text-primary">ENGINE</span>
            </h1>
            <p className="font-serif text-base md:text-lg text-muted-foreground leading-relaxed">
              Already have a <strong className="text-foreground">Product Design Document</strong>
              {", "}
              <strong className="text-foreground">SDD</strong>, concept note, or spec
              sheet? Drop it in. The engine extracts the intent, normalises it
              into a seed prompt, then runs it through the 7-stage HARNESS to
              produce a{" "}
              <strong className="text-primary">PromptWare Design Document (PWDD)</strong>
              {" "}— a HARNESS-certified outcome artefact.
            </p>
            <div className="mt-4 grid sm:grid-cols-2 gap-3 text-xs font-mono">
              <div className="rounded-md border bg-card/60 p-3">
                <div className="text-muted-foreground mb-1">INPUT</div>
                <div className="font-bold">Product Design Document</div>
                <div className="text-muted-foreground mt-1">
                  Pre-ingestion · human-authored
                </div>
              </div>
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                <div className="text-primary mb-1">OUTPUT</div>
                <div className="font-bold">PromptWare Design Document (PWDD)</div>
                <div className="text-muted-foreground mt-1">
                  Post-ingestion · HARNESS-certified
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="container px-4 md:px-6 py-8 md:py-12 max-w-4xl space-y-6">
          {/* Step 1: source */}
          <Card className={ingestion ? "opacity-70" : ""}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center text-xs font-mono font-bold text-primary">
                  1
                </div>
                <CardTitle className="font-display text-xl tracking-wider">
                  PROVIDE THE SOURCE DOCUMENT
                </CardTitle>
              </div>
              <CardDescription className="font-serif">
                Upload a .txt, .md, .pdf, or .docx (max 1 MB) — or paste the
                document text directly. Tell us what kind of document it is so
                the engine frames it correctly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <label className="text-xs font-mono font-bold uppercase text-muted-foreground tracking-wider">
                  SOURCE DOCUMENT KIND
                </label>
                <Select
                  value={declaredKind}
                  onValueChange={(v) => setDeclaredKind(v as Kind | "auto")}
                  disabled={Boolean(ingestion)}
                >
                  <SelectTrigger className="mt-2 font-mono text-sm" data-testid="select-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detect</SelectItem>
                    {KIND_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-mono font-bold uppercase text-muted-foreground tracking-wider">
                  FILE UPLOAD
                </label>
                <div
                  className={`mt-2 rounded-md border-2 border-dashed transition-colors p-4 md:p-6 flex flex-col items-center gap-3 text-center ${
                    file ? "border-primary/50 bg-primary/5" : "border-border bg-muted/20"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0] ?? null;
                    handleFileChange(f);
                  }}
                >
                  {file ? (
                    <>
                      <FileText className="h-8 w-8 text-primary" />
                      <div className="font-mono text-sm text-foreground break-all">
                        {file.name}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {(file.size / 1024).toFixed(1)} KB
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleFileChange(null)}
                        disabled={submitting || Boolean(ingestion)}
                      >
                        REMOVE
                      </Button>
                    </>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <div className="text-sm font-mono text-muted-foreground">
                        Drop a file here, or
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={submitting || Boolean(ingestion)}
                      >
                        <FileUp className="h-4 w-4 mr-2" /> CHOOSE FILE
                      </Button>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        .txt · .md · .pdf · .docx · max 1 MB
                      </div>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPT}
                    className="hidden"
                    onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                    data-testid="input-file"
                  />
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden>
                  <div className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-card px-3 text-[10px] font-mono uppercase text-muted-foreground tracking-wider">
                    or paste text
                  </span>
                </div>
              </div>

              <Textarea
                placeholder="Paste the body of your Product Design Document, SDD, concept note, or spec sheet here…"
                value={pastedText}
                onChange={(e) => {
                  setPastedText(e.target.value);
                  if (e.target.value && file) setFile(null);
                }}
                className="min-h-[160px] font-mono text-xs"
                disabled={submitting || Boolean(ingestion) || Boolean(file)}
                data-testid="input-paste"
              />

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                <Button
                  onClick={handleIngest}
                  disabled={!inputReady || submitting || Boolean(ingestion)}
                  className="font-display tracking-wider w-full sm:w-auto"
                  data-testid="button-ingest"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> NORMALISING…
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" /> NORMALISE TO SEED PROMPT
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Step 2: review + create session */}
          {ingestion && (
            <Card className="border-primary/30">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-mono font-bold">
                    2
                  </div>
                  <CardTitle className="font-display text-xl tracking-wider">
                    REVIEW &amp; INITIATE SESSION
                  </CardTitle>
                </div>
                <CardDescription className="font-serif">
                  The engine extracted the intent below. You can edit the seed
                  prompt before it goes to F1. The session that's created from
                  this will run through F1 → F7 and end with a certified PWDD.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="rounded-md border bg-muted/20 p-3">
                    <div className="text-muted-foreground mb-1">SOURCE</div>
                    <div className="break-all">{ingestion.originalFilename}</div>
                  </div>
                  <div className="rounded-md border bg-muted/20 p-3">
                    <div className="text-muted-foreground mb-1">DETECTED KIND</div>
                    <div>{KIND_LABEL[ingestion.sourceDocKind]}</div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-mono font-bold uppercase text-muted-foreground tracking-wider">
                    DETECTED TITLE
                  </label>
                  <Input
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="mt-2 font-mono text-sm"
                    data-testid="input-title"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono font-bold uppercase text-muted-foreground tracking-wider">
                    EXTRACTED SUMMARY
                  </label>
                  <div className="mt-2 p-3 rounded-md border bg-muted/20 text-sm font-serif leading-relaxed">
                    {ingestion.summary}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-mono font-bold uppercase text-primary tracking-wider">
                    SEED PROMPT (editable, becomes F1 input)
                  </label>
                  <Textarea
                    value={editedSeed}
                    onChange={(e) => setEditedSeed(e.target.value)}
                    className="mt-2 min-h-[180px] font-mono text-sm border-primary/30 bg-primary/5"
                    data-testid="input-seed"
                  />
                  <div className="mt-1 text-[10px] font-mono text-muted-foreground text-right">
                    {editedSeed.length} chars
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIngestion(null);
                      setFile(null);
                      setPastedText("");
                      setEditedSeed("");
                      setEditedTitle("");
                    }}
                    disabled={startSession.isPending}
                    className="font-mono text-xs"
                  >
                    START OVER
                  </Button>
                  <Button
                    onClick={handleCreateSession}
                    disabled={startSession.isPending || editedSeed.trim().length < 20}
                    className="font-display tracking-wider w-full sm:w-auto"
                    data-testid="button-create-session"
                  >
                    {startSession.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> CREATING SESSION…
                      </>
                    ) : (
                      <>
                        INITIATE HARNESS SESSION <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
