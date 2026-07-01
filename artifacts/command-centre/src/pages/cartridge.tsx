import { useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useStartSessionFromCartridge,
  useGetCartridgeCredits,
  useBillingCartridgeCheckout,
  getListSessionsQueryKey,
  getGetCartridgeCreditsQueryKey,
  type CartridgePackage,
  type CartridgeLinkKind,
} from "@workspace/api-client-react";
import { BILLING_ENABLED, ACCESS_REQUEST_EMAIL } from "@/lib/billing-flag";
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
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";

const ACCEPT =
  ".txt,.md,.markdown,.pdf,.docx,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_BYTES = 1 * 1024 * 1024;
const MAX_FILES = 5;
const MIN_SCOPE = 80;
const MIN_OUTCOME = 12;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SpcDraft {
  label: string;
  body: string;
}
interface LinkDraft {
  kind: CartridgeLinkKind;
  descriptor: string;
  note: string;
}

export default function Cartridge() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 1 — SCOPE (required)
  const [projectName, setProjectName] = useState("");
  const [outcomeOneLiner, setOutcomeOneLiner] = useState("");
  const [scopeStatement, setScopeStatement] = useState("");
  const [targetPlatformHint, setTargetPlatformHint] = useState("");

  // Step 2 — assets
  const [files, setFiles] = useState<File[]>([]);
  const [spcs, setSpcs] = useState<SpcDraft[]>([]);
  const [links, setLinks] = useState<LinkDraft[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [cartridge, setCartridge] = useState<CartridgePackage | null>(null);

  const startSession = useStartSessionFromCartridge();
  const credits = useGetCartridgeCredits({
    query: {
      enabled: BILLING_ENABLED,
      queryKey: getGetCartridgeCreditsQueryKey(),
    },
  });
  const buyCredit = useBillingCartridgeCheckout();
  const available = credits.data?.available ?? 0;

  const scopeReady =
    projectName.trim().length > 0 &&
    outcomeOneLiner.trim().length >= MIN_OUTCOME &&
    scopeStatement.trim().length >= MIN_SCOPE;

  const handleBuyCredit = () => {
    if (!BILLING_ENABLED) {
      window.location.href = `mailto:${ACCESS_REQUEST_EMAIL}?subject=${encodeURIComponent(
        "Early access — Advanced Cartridge project credit",
      )}&body=${encodeURIComponent(
        "Hello,\n\nI'd like to purchase an ATANDA Advanced Cartridge project credit during the private preview.\n\nName:\nOrganisation:\nProject:\n\nThank you.",
      )}`;
      return;
    }
    buyCredit.mutate(
      { data: {} },
      {
        onSuccess: (res) => {
          if (res.url) window.location.href = res.url;
        },
        onError: (err) => {
          toast({
            title: "Checkout unavailable",
            description:
              (err as { data?: { error?: string } })?.data?.error ??
              "Could not start checkout.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleAddFiles = (newFiles: FileList | File[] | null) => {
    if (!newFiles) return;
    const list = Array.from(newFiles);
    const oversize = list.find((f) => f.size > MAX_BYTES);
    if (oversize) {
      toast({
        title: "File too large",
        description: `"${oversize.name}" exceeds the 1 MB per-file limit.`,
        variant: "destructive",
      });
      return;
    }
    const next = [...files, ...list].slice(0, MAX_FILES);
    if (files.length + list.length > MAX_FILES) {
      toast({
        title: "File limit",
        description: `Up to ${MAX_FILES} supporting documents per cartridge.`,
      });
    }
    setFiles(next);
  };

  const handleSubmit = async () => {
    if (!scopeReady) {
      toast({
        title: "Define Project Scope first",
        description:
          "Project name, outcome, and a scope statement of at least 80 characters are required.",
        variant: "destructive",
      });
      return;
    }
    if (BILLING_ENABLED && available < 1) {
      toast({
        title: "No cartridge credit",
        description: "Purchase an Advanced Cartridge to continue.",
        variant: "destructive",
      });
      return;
    }
    const validSpcs = spcs
      .filter((s) => s.label.trim() && s.body.trim().length >= 20)
      .map((s) => ({ label: s.label.trim(), body: s.body.trim() }));
    const validLinks = links
      .filter((l) => l.descriptor.trim().length > 0)
      .map((l) => ({
        kind: l.kind,
        descriptor: l.descriptor.trim(),
        note: l.note.trim() || undefined,
      }));

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("projectName", projectName.trim());
      formData.append("outcomeOneLiner", outcomeOneLiner.trim());
      formData.append("scopeStatement", scopeStatement.trim());
      if (targetPlatformHint.trim())
        formData.append("targetPlatformHint", targetPlatformHint.trim());
      if (validSpcs.length > 0) formData.append("spcs", JSON.stringify(validSpcs));
      if (validLinks.length > 0)
        formData.append("links", JSON.stringify(validLinks));
      for (const f of files) formData.append("files", f);

      const res = await fetch(`${basePath}/api/cartridge`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
          field?: string;
        };
        throw new Error(data?.error || `Cartridge build failed (${res.status})`);
      }
      const data = (await res.json()) as CartridgePackage;
      setCartridge(data);
      qc.invalidateQueries({ queryKey: getGetCartridgeCreditsQueryKey() });
    } catch (err) {
      toast({
        title: "Cartridge build failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartSession = () => {
    if (!cartridge) return;
    startSession.mutate(
      {
        id: cartridge.id,
        data: { sessionName: `Cartridge: ${cartridge.projectName}`.slice(0, 200) },
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
              STANDALONE · PREMIUM PER-PROJECT
            </div>
            <h1 className="font-display text-3xl md:text-5xl tracking-wider mb-3">
              ADVANCED <span className="text-primary">CARTRIDGE</span>
            </h1>
            <p className="font-serif text-base md:text-lg text-muted-foreground leading-relaxed">
              For projects that arrive with{" "}
              <strong className="text-foreground">multiple documents</strong>,{" "}
              <strong className="text-foreground">existing SPCs</strong>, or a
              live <strong className="text-foreground">codebase / database</strong>
              {" "}you want HARNESS to read alongside your scope. Define the
              project scope first — it{" "}
              <strong className="text-foreground">protects every prompt</strong>{" "}
              from F1 → F7 from drifting off-mission, then the HARNESS produces
              a certified PWDD and an MVP-PDD ready for F8 Code ORACLE hand-off
              (Architect tier).
            </p>
          </div>
        </section>

        <section className="container px-4 md:px-6 py-8 md:py-12 max-w-4xl space-y-6">
          {/* Credit balance + purchase CTA — deferred with subscriptions */}
          {BILLING_ENABLED && (
          <Card
            className={
              available > 0
                ? "border-primary/40 bg-primary/5"
                : "border-secondary/40 bg-secondary/5"
            }
            data-testid="card-cartridge-credits"
          >
            <CardContent className="py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                  CARTRIDGE PROJECT CREDITS
                </div>
                {credits.isLoading ? (
                  <div className="font-display text-2xl tracking-wider text-muted-foreground">
                    LOADING…
                  </div>
                ) : available > 0 ? (
                  <>
                    <div className="font-display text-2xl tracking-wider text-primary">
                      {available} CREDIT{available === 1 ? "" : "S"} AVAILABLE
                    </div>
                    <div className="text-xs font-serif text-muted-foreground mt-0.5">
                      Each cartridge consumes one credit. Failed builds are refunded automatically.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-display text-2xl tracking-wider text-secondary">
                      NO CREDITS YET
                    </div>
                    <div className="text-xs font-serif text-muted-foreground mt-0.5">
                      One credit covers one full project cartridge → certified PWDD.
                    </div>
                  </>
                )}
              </div>
              <Button
                onClick={handleBuyCredit}
                variant={available > 0 ? "outline" : "default"}
                disabled={buyCredit.isPending}
                className="font-display tracking-wider"
                data-testid="button-buy-cartridge-credit"
              >
                {buyCredit.isPending
                  ? "OPENING CHECKOUT…"
                  : available > 0
                    ? "BUY ANOTHER"
                    : "BUY A CARTRIDGE CREDIT"}
              </Button>
            </CardContent>
          </Card>
          )}

          {/* Step 1: SCOPE */}
          <Card
            className={cartridge ? "opacity-70" : "border-primary/30"}
            data-testid="card-scope"
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-mono font-bold">
                  1
                </div>
                <CardTitle className="font-display text-xl tracking-wider">
                  DEFINE PROJECT SCOPE
                  <span className="ml-2 text-[10px] font-mono text-primary align-middle">
                    REQUIRED · CANNOT BE SKIPPED
                  </span>
                </CardTitle>
              </div>
              <CardDescription className="font-serif">
                Pinned at the top of every prompt from F1 to F7. Anything that
                contradicts this scope is treated as out-of-bounds by the
                HARNESS. Be specific about what's in and what's out.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <label className="text-xs font-mono font-bold uppercase text-muted-foreground tracking-wider">
                  PROJECT NAME
                </label>
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. CivicLens — public-records portal for journalists"
                  className="mt-2 font-mono text-sm"
                  disabled={Boolean(cartridge)}
                  data-testid="input-project-name"
                  maxLength={255}
                />
              </div>
              <div>
                <label className="text-xs font-mono font-bold uppercase text-muted-foreground tracking-wider">
                  OUTCOME (ONE LINE)
                </label>
                <Input
                  value={outcomeOneLiner}
                  onChange={(e) => setOutcomeOneLiner(e.target.value)}
                  placeholder="What ships at the end. e.g. A web portal where a journalist queries a county records DB and exports verified evidence packs."
                  className="mt-2 font-mono text-sm"
                  disabled={Boolean(cartridge)}
                  data-testid="input-outcome"
                  maxLength={1000}
                />
                <div className="mt-1 text-[10px] font-mono text-muted-foreground text-right">
                  {outcomeOneLiner.trim().length} / min {MIN_OUTCOME}
                </div>
              </div>
              <div>
                <label className="text-xs font-mono font-bold uppercase text-primary tracking-wider">
                  SCOPE STATEMENT (PINNED CONTEXT)
                </label>
                <Textarea
                  value={scopeStatement}
                  onChange={(e) => setScopeStatement(e.target.value)}
                  placeholder={`What the project must do · who it's for · explicit non-goals · hard constraints.\n\nMin ${MIN_SCOPE} chars. The HARNESS treats this block as authoritative.`}
                  className="mt-2 min-h-[200px] font-mono text-xs border-primary/30 bg-primary/5"
                  disabled={Boolean(cartridge)}
                  data-testid="input-scope"
                  maxLength={8000}
                />
                <div className="mt-1 text-[10px] font-mono text-muted-foreground text-right">
                  {scopeStatement.trim().length} / min {MIN_SCOPE}
                </div>
              </div>
              <div>
                <label className="text-xs font-mono font-bold uppercase text-muted-foreground tracking-wider">
                  TARGET PLATFORM HINT (OPTIONAL)
                </label>
                <Input
                  value={targetPlatformHint}
                  onChange={(e) => setTargetPlatformHint(e.target.value)}
                  placeholder="e.g. Next.js + Vercel · React + Vite static · Expo mobile · pnpm monorepo"
                  className="mt-2 font-mono text-sm"
                  disabled={Boolean(cartridge)}
                  data-testid="input-platform-hint"
                  maxLength={500}
                />
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Assets */}
          <Card className={cartridge ? "opacity-70" : ""} data-testid="card-assets">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center text-xs font-mono font-bold text-primary">
                  2
                </div>
                <CardTitle className="font-display text-xl tracking-wider">
                  SUPPORTING ASSETS
                  <span className="ml-2 text-[10px] font-mono text-muted-foreground align-middle">
                    OPTIONAL
                  </span>
                </CardTitle>
              </div>
              <CardDescription className="font-serif">
                Drop the documents, prior SPCs, and code / DB pointers the
                HARNESS should consult. Everything here is summarised and
                embedded in the protected CARTRIDGE CONTEXT block — below the
                scope, never above it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Files */}
              <div>
                <label className="text-xs font-mono font-bold uppercase text-muted-foreground tracking-wider">
                  DOCUMENTS · up to {MAX_FILES} · max 1 MB each
                </label>
                <div
                  className="mt-2 rounded-md border-2 border-dashed border-border bg-muted/20 p-4 md:p-6 flex flex-col items-center gap-3 text-center"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleAddFiles(e.dataTransfer.files);
                  }}
                >
                  <Upload className="h-7 w-7 text-muted-foreground" />
                  <div className="text-sm font-mono text-muted-foreground">
                    Drop files here, or
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={submitting || Boolean(cartridge) || files.length >= MAX_FILES}
                  >
                    <FileUp className="h-4 w-4 mr-2" /> CHOOSE FILES
                  </Button>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    .txt · .md · .pdf · .docx
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPT}
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleAddFiles(e.target.files);
                      e.target.value = "";
                    }}
                    data-testid="input-files"
                  />
                </div>
                {files.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {files.map((f, i) => (
                      <li
                        key={`${f.name}-${i}`}
                        className="flex items-center justify-between gap-2 rounded-md border bg-card/60 px-3 py-2 text-xs font-mono"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <span className="truncate">{f.name}</span>
                          <span className="text-muted-foreground shrink-0">
                            {(f.size / 1024).toFixed(1)} KB
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setFiles(files.filter((_, idx) => idx !== i))
                          }
                          disabled={submitting || Boolean(cartridge)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* SPCs */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-bold uppercase text-muted-foreground tracking-wider">
                    EXISTING SPCs
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setSpcs([...spcs, { label: "", body: "" }])
                    }
                    disabled={submitting || Boolean(cartridge) || spcs.length >= 10}
                    className="text-xs"
                    data-testid="button-add-spc"
                  >
                    <Plus className="h-3 w-3 mr-1" /> ADD SPC
                  </Button>
                </div>
                {spcs.length === 0 ? (
                  <p className="mt-2 text-xs font-serif text-muted-foreground italic">
                    None added. You can paste up to 10 prior SPCs the HARNESS
                    should treat as canon.
                  </p>
                ) : (
                  <div className="mt-2 space-y-3">
                    {spcs.map((s, i) => (
                      <div
                        key={i}
                        className="rounded-md border bg-muted/10 p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Input
                            value={s.label}
                            onChange={(e) => {
                              const next = [...spcs];
                              next[i] = { ...next[i], label: e.target.value };
                              setSpcs(next);
                            }}
                            placeholder={`SPC #${i + 1} label`}
                            className="font-mono text-xs"
                            disabled={submitting || Boolean(cartridge)}
                            maxLength={255}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setSpcs(spcs.filter((_, idx) => idx !== i))
                            }
                            disabled={submitting || Boolean(cartridge)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <Textarea
                          value={s.body}
                          onChange={(e) => {
                            const next = [...spcs];
                            next[i] = { ...next[i], body: e.target.value };
                            setSpcs(next);
                          }}
                          placeholder="Paste the SPC body (min 20 chars)…"
                          className="font-mono text-xs min-h-[100px]"
                          disabled={submitting || Boolean(cartridge)}
                          maxLength={12000}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Links */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-bold uppercase text-muted-foreground tracking-wider">
                    CODEBASE / DATABASE LINKS
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setLinks([
                        ...links,
                        { kind: "git", descriptor: "", note: "" },
                      ])
                    }
                    disabled={submitting || Boolean(cartridge) || links.length >= 10}
                    className="text-xs"
                    data-testid="button-add-link"
                  >
                    <Plus className="h-3 w-3 mr-1" /> ADD LINK
                  </Button>
                </div>
                {links.length === 0 ? (
                  <p className="mt-2 text-xs font-serif text-muted-foreground italic">
                    Optional pointers to a git repo or a database the HARNESS
                    should be aware of (read-only descriptors only — no
                    credentials).
                  </p>
                ) : (
                  <div className="mt-2 space-y-3">
                    {links.map((l, i) => (
                      <div
                        key={i}
                        className="rounded-md border bg-muted/10 p-3 space-y-2"
                      >
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Select
                            value={l.kind}
                            onValueChange={(v) => {
                              const next = [...links];
                              next[i] = {
                                ...next[i],
                                kind: v as CartridgeLinkKind,
                              };
                              setLinks(next);
                            }}
                            disabled={submitting || Boolean(cartridge)}
                          >
                            <SelectTrigger className="w-full sm:w-[140px] font-mono text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="git">git</SelectItem>
                              <SelectItem value="database">database</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            value={l.descriptor}
                            onChange={(e) => {
                              const next = [...links];
                              next[i] = {
                                ...next[i],
                                descriptor: e.target.value,
                              };
                              setLinks(next);
                            }}
                            placeholder={
                              l.kind === "git"
                                ? "github.com/org/repo"
                                : "postgres · 14 tables · public.users, public.orders…"
                            }
                            className="font-mono text-xs flex-1"
                            disabled={submitting || Boolean(cartridge)}
                            maxLength={2000}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setLinks(links.filter((_, idx) => idx !== i))
                            }
                            disabled={submitting || Boolean(cartridge)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <Input
                          value={l.note}
                          onChange={(e) => {
                            const next = [...links];
                            next[i] = { ...next[i], note: e.target.value };
                            setLinks(next);
                          }}
                          placeholder="Optional note (≤ 500 chars)"
                          className="font-mono text-xs"
                          disabled={submitting || Boolean(cartridge)}
                          maxLength={500}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                <Button
                  onClick={handleSubmit}
                  disabled={
                    !scopeReady ||
                    submitting ||
                    Boolean(cartridge) ||
                    (BILLING_ENABLED && available < 1)
                  }
                  className="font-display tracking-wider w-full sm:w-auto"
                  data-testid="button-build-cartridge"
                  title={
                    BILLING_ENABLED && available < 1
                      ? "Purchase a cartridge credit to continue"
                      : !scopeReady
                        ? "Define Project Scope first"
                        : undefined
                  }
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> BUILDING CARTRIDGE…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" /> BUILD CARTRIDGE
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Step 3 — cartridge built, start session */}
          {cartridge && (
            <Card
              className="border-primary/30"
              data-testid="card-cartridge-ready"
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-mono font-bold">
                    3
                  </div>
                  <CardTitle className="font-display text-xl tracking-wider">
                    CARTRIDGE READY · INITIATE SESSION
                  </CardTitle>
                </div>
                <CardDescription className="font-serif">
                  Your cartridge is built and the scope is pinned. Starting the
                  session unlocks F1 → F7 against this protected context. F8
                  Code ORACLE becomes available on the session page (Architect tier
                  required) once F7 certifies the MVP-PDD.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-3 gap-3 text-xs font-mono">
                  <div className="rounded-md border bg-muted/20 p-3">
                    <div className="text-muted-foreground mb-1">DOCUMENTS</div>
                    <div className="font-bold">{cartridge.documents.length}</div>
                  </div>
                  <div className="rounded-md border bg-muted/20 p-3">
                    <div className="text-muted-foreground mb-1">SPCs</div>
                    <div className="font-bold">{cartridge.spcs.length}</div>
                  </div>
                  <div className="rounded-md border bg-muted/20 p-3">
                    <div className="text-muted-foreground mb-1">LINKS</div>
                    <div className="font-bold">{cartridge.links.length}</div>
                  </div>
                </div>
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs font-serif">
                  <div className="font-mono uppercase text-primary tracking-wider mb-1">
                    SCOPE (PINNED)
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed text-foreground/80">
                    {cartridge.scopeStatement}
                  </div>
                </div>
                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setCartridge(null);
                      setProjectName("");
                      setOutcomeOneLiner("");
                      setScopeStatement("");
                      setTargetPlatformHint("");
                      setFiles([]);
                      setSpcs([]);
                      setLinks([]);
                    }}
                    disabled={startSession.isPending}
                    className="font-mono text-xs"
                  >
                    START OVER
                  </Button>
                  <Button
                    onClick={handleStartSession}
                    disabled={startSession.isPending}
                    className="font-display tracking-wider w-full sm:w-auto"
                    data-testid="button-start-cartridge-session"
                  >
                    {startSession.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> CREATING SESSION…
                      </>
                    ) : (
                      <>
                        INITIATE HARNESS SESSION{" "}
                        <ArrowRight className="h-4 w-4 ml-2" />
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
