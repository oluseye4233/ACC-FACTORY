import { useMemo, useState } from "react";
import {
  useListF10Sources,
  useDownloadF10Export,
  type F10Source,
  type F10ExportInput,
  type HarnessArtifact,
} from "@workspace/api-client-react";
import { buildArtifactFilename } from "@workspace/artifact-naming";
import { Download, ExternalLink, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { extractApiError } from "@/lib/sse";

/** Fixed, allowlisted official consoles and signup pages. No credentials are ever requested here. */
export const HOSTING_PROVIDER_LINKS = [
  { id: "replit", name: "Replit", console: "https://replit.com/~", signup: "https://replit.com/signup" },
  { id: "vercel", name: "Vercel", console: "https://vercel.com/dashboard", signup: "https://vercel.com/signup" },
  { id: "netlify", name: "Netlify", console: "https://app.netlify.com/", signup: "https://app.netlify.com/signup" },
  { id: "render", name: "Render", console: "https://dashboard.render.com/", signup: "https://dashboard.render.com/register" },
  { id: "railway", name: "Railway", console: "https://railway.com/dashboard", signup: "https://railway.com/login" },
  { id: "fly", name: "Fly.io", console: "https://fly.io/dashboard", signup: "https://fly.io/app/sign-up" },
  { id: "aws", name: "AWS", console: "https://console.aws.amazon.com/", signup: "https://portal.aws.amazon.com/billing/signup" },
  { id: "azure", name: "Azure", console: "https://portal.azure.com/", signup: "https://azure.microsoft.com/free/" },
  { id: "gcp", name: "Google Cloud", console: "https://console.cloud.google.com/", signup: "https://cloud.google.com/free" },
] as const;

const PACKAGES = {
  GENERIC: { label: "Source/runtime package (TypeScript/Node)", family: "PROGRAMMING_ENVIRONMENT", target: "TypeScript/Node" },
  REPLIT: { label: "Replit Agent handoff package", family: "VIBE_APP", target: "Replit Agent" },
} as const;
type PackageKey = keyof typeof PACKAGES;

/**
 * Resolve only the selected bundle or its verified child within this session.
 * F8 keeps the original CODEBASE_BUNDLE and creates a VERIFIED child.
 */
export function selectVerifiedBundle(sources: F10Source[], artifacts: HarnessArtifact[], preferredId?: string | null): F10Source | null {
  const verified = artifacts.filter(a => a.artifactType === "VERIFIED_CODEBASE_BUNDLE" && a.verificationStatus === "VERIFIED");
  const eligible = sources.filter(s => s.artifactType === "VERIFIED_CODEBASE_BUNDLE" && verified.some(a => a.id === s.id));
  if (preferredId) {
    const exact = eligible.find(s => s.id === preferredId);
    if (exact) return exact;
    const original = artifacts.find(a => a.id === preferredId && a.artifactType === "CODEBASE_BUNDLE");
    if (!original) return null;
    return eligible.find(s => verified.some(a => a.id === s.id && a.parentArtifactId === original.id)) ?? null;
  }
  return [...eligible].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

export function F11SubscriptionHandoff({ artifacts, preferredSourceId }: { artifacts: HarnessArtifact[]; preferredSourceId?: string | null }) {
  const { data: sources = [], isLoading, isError, refetch } = useListF10Sources();
  const download = useDownloadF10Export();
  const [pkg, setPkg] = useState<PackageKey>("GENERIC");
  const [error, setError] = useState<string | null>(null);
  const [downloadedPackage, setDownloadedPackage] = useState<{ id: string; pkg: PackageKey } | null>(null);
  const bundle = useMemo(() => selectVerifiedBundle(sources, artifacts, preferredSourceId), [sources, artifacts, preferredSourceId]);

  const onDownload = async () => {
    if (!bundle) return;
    setError(null);
    const choice = PACKAGES[pkg];
    const input: F10ExportInput = { sourceArtifactId: bundle.id, outputKind: "CODE_DJ", family: choice.family, target: choice.target, deliveryMode: "EXPORT" };
    try {
      const blob = await download.mutateAsync({ data: input });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = buildArtifactFilename({ type: "F10_EXPORT", title: bundle.name ?? "F11 hosting handoff", id: bundle.id, extension: "zip" });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadedPackage({ id: bundle.id, pkg });
    } catch (cause) {
      setError(extractApiError(cause).message);
    }
  };

  return (
    <Card className="border-amber-500/30 bg-amber-500/5 p-5" data-testid="f11-subscription-handoff" aria-labelledby="f11-handoff-title">
      <div className="mb-3 flex items-center gap-2 text-amber-500">
        <PackageOpen className="h-4 w-4" aria-hidden="true" />
        <h3 id="f11-handoff-title" className="font-mono text-[10px] font-bold uppercase tracking-wider">Manual handoff · your own hosting subscription</h3>
      </div>
      <p className="max-w-3xl font-mono text-xs leading-relaxed text-muted-foreground">
        Download the F10 CODE_DJ export of your verified F8 bundle and continue in a hosting account you own. This is a source/runtime handoff, not a provider deployment.
        It is separate from H4 staging, H7 promotion and H8 hosting evidence; downloading or opening a provider does not complete any H stage.
        Subscriptions and charges are between you and the provider. ATANDA does not sell them or guarantee plan eligibility.
      </p>

      <div className="mt-4" aria-live="polite">
        {isLoading ? (
          <div className="h-10 w-full max-w-md animate-pulse rounded bg-muted/40" aria-label="Loading verified bundles" />
        ) : isError ? (
          <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-destructive">
            Could not load exportable sources.
            <Button size="sm" variant="outline" onClick={() => void refetch()}>Retry</Button>
          </div>
        ) : !bundle ? (
          <p className="font-mono text-xs text-muted-foreground">
            {preferredSourceId
              ? `The bundle referenced by this hosting plan (${preferredSourceId.slice(0, 10)}...) is not yet a verified exportable code bundle. Verification may still be pending; no other bundle is substituted.`
              : "No verified F8 code bundle is available for export. Complete F8 verification first."}
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div className="grid gap-1">
              <label htmlFor="f11-handoff-package" className="font-mono text-[10px] uppercase text-muted-foreground">Package for bundle {bundle.name ?? bundle.id.slice(0, 10)}</label>
              <select id="f11-handoff-package" value={pkg} onChange={e => setPkg(e.target.value as PackageKey)} className="h-10 rounded-md border border-input bg-background px-3 font-mono text-xs">
                {Object.entries(PACKAGES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <Button onClick={onDownload} disabled={download.isPending} className="font-mono text-xs">
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />{download.isPending ? "Preparing export..." : "Download handoff package"}
            </Button>
            <p className="break-all font-mono text-[10px] text-muted-foreground md:col-span-2">Verified artifact: {bundle.name || "Untitled code bundle"} · {bundle.id}</p>
            {downloadedPackage?.id === bundle.id && downloadedPackage.pkg === pkg && <p className="font-mono text-[10px] text-muted-foreground md:col-span-2">Package downloaded. Nothing is hosted until you deploy it in your own account.</p>}
            {error && <p role="alert" className="font-mono text-xs text-destructive md:col-span-2">{error}</p>}
          </div>
        )}
      </div>

      <div className="mt-5">
        <p className="mb-2 font-mono text-[10px] uppercase text-muted-foreground">Continue in your provider account, or sign up there</p>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {HOSTING_PROVIDER_LINKS.map(p => (
            <li key={p.id} className="flex items-center justify-between gap-2 border border-border/50 bg-background/60 px-3 py-2 font-mono text-xs">
              <span>{p.name}</span>
              <span className="flex gap-3">
                <a href={p.console} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Console<ExternalLink className="h-3 w-3" aria-hidden="true" /><span className="sr-only"> for {p.name} (opens in a new tab)</span></a>
                <a href={p.signup} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:underline">Sign up<span className="sr-only"> for {p.name} (opens in a new tab)</span></a>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
