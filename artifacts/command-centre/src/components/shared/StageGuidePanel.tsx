import { useState } from "react";
import { Link } from "wouter";
import { BookOpenText, Film, Play } from "lucide-react";
import { getGetStageGuidesQueryKey, useGetMe, useGetStageGuides, type GetStageGuidesParams, type StageGuide } from "@workspace/api-client-react";

/**
 * Stage guide library query scoped to the authenticated account id (from /api/me),
 * so drafts, history or canManage are never served from cache to another account.
 * The request is gated until identity resolves. Admin tools additionally require
 * the current account role ADMIN; the server's canManage stays authoritative.
 */
export function useViewerStageGuides(params?: GetStageGuidesParams) {
  const me = useGetMe();
  const viewerId = me.data?.id ?? null;
  const q = useGetStageGuides(params, {
    query: {
      queryKey: [...getGetStageGuidesQueryKey(params), { viewer: viewerId }] as unknown as ReturnType<typeof getGetStageGuidesQueryKey>,
      enabled: Boolean(viewerId),
      retry: false,
    },
  });
  const identityPending = me.isLoading;
  const identityError = me.isError && !viewerId;
  const canManage = Boolean(viewerId) && me.data?.role === "ADMIN" && Boolean(q.data?.canManage) && q.isSuccess && !q.isPlaceholderData && !q.isRefetchError;
  return { q, identityPending, identityError, refetchIdentity: me.refetch, canManage, isLoading: identityPending || (Boolean(viewerId) && q.isLoading) };
}

/** Every F-stage that carries a shared teaching guide, in floor order. */
export const STAGE_GUIDE_KEYS = ["F0", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F9.5", "F10", "F11", "F12"] as const;

const EMBED_RE = /^https:\/\/share\.synthesia\.io\/embeds\/videos\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only a genuinely published, non-test guide with an official share embed may be watched. */
export function watchableEmbed(guide: StageGuide): string | null {
  if (!guide.published || guide.isTest || guide.state !== "COMPLETE" || !guide.embedUrl) return null;
  return EMBED_RE.test(guide.embedUrl) ? guide.embedUrl : null;
}

export function guideErrMessage(e: unknown): string {
  const err = e as { status?: number; data?: { error?: string; message?: string }; message?: string } | null;
  if (err?.status === 401 || err?.status === 403) return "You do not have permission for this action.";
  return err?.data?.error ?? err?.data?.message ?? err?.message ?? "Request failed.";
}

const KIND_LABEL: Record<string, string> = { EXPLAINER: "Explainer", DEMONSTRATION: "Worked example" };

/** Transcript plus click-to-load published video. Never autoplays, never calls the provider. */
export function GuideViewer({ guide, idSuffix }: { guide: StageGuide; idSuffix: string }) {
  const [watching, setWatching] = useState(false);
  const embed = watchableEmbed(guide);
  return (
    <article className="rounded-md border bg-background/60 p-3" data-testid={`guide-${idSuffix}`}>
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-primary">{guide.stageKey}</span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{KIND_LABEL[guide.kind] ?? guide.kind}</span>
        <h3 className="w-full text-sm font-semibold leading-snug sm:w-auto">{guide.title}</h3>
        <span className="ml-auto font-mono text-[9px] uppercase text-muted-foreground" data-testid={`text-guide-availability-${idSuffix}`}>
          {embed ? `Narrated synthetic example · v${guide.version}` : "Transcript only"}
        </span>
      </header>
      <div className={embed && watching ? "grid gap-3 md:grid-cols-[3fr_2fr]" : ""}>
        {embed && watching && (
          <div className="relative aspect-video overflow-hidden rounded border bg-muted">
            <iframe
              src={embed}
              title={`${guide.stageKey} guide video: ${guide.title}`}
              loading="lazy"
              referrerPolicy="no-referrer"
              allow="encrypted-media; fullscreen"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
              data-testid={`iframe-guide-${idSuffix}`}
            />
          </div>
        )}
        <section aria-label={`Transcript for ${guide.title}`}>
          <p className="mb-1 font-mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Transcript</p>
          <p className="max-h-64 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-foreground/90" data-testid={`text-transcript-${idSuffix}`}>{guide.script}</p>
        </section>
      </div>
      <dl className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2">
        <div><dt className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">You leave with</dt><dd>{guide.outcome}</dd></div>
        <div><dt className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Limitation</dt><dd>{guide.limitation}</dd></div>
      </dl>
      {embed && !watching && (
        <button type="button" onClick={() => setWatching(true)} className="mt-3 inline-flex items-center gap-1 rounded border border-primary/40 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/10" data-testid={`button-watch-${idSuffix}`}>
          <Play className="h-3 w-3" /> Watch narrated synthetic example
        </button>
      )}
    </article>
  );
}

export const GUIDE_DISCLAIMER = "Narrated synthetic worked examples, not screen recordings of your project. Watching is optional: it is not an assessment or certification, does not change scores, unlock stages or create artifacts.";

/** Inline guide for one stage. Stays on the originating page. */
export function StageGuidePanel({ stageKey }: { stageKey: string }) {
  const v = useViewerStageGuides({ stageKey });
  const q = v.q;
  const guides = (q.data?.guides ?? []).filter((g) => g.stageKey === stageKey);
  return (
    <details className="group mx-auto mt-4 w-full max-w-5xl rounded-lg border border-dashed bg-card/60 px-4" data-testid={`panel-stage-guide-${stageKey}`}>
      <summary className="flex cursor-pointer list-none items-center gap-2 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Film className="h-4 w-4 text-secondary" aria-hidden />
        <span className="font-mono text-xs font-bold uppercase tracking-wider">Stage guide · {stageKey}</span>
        <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-muted-foreground">optional · view here</span>
      </summary>
      <div className="space-y-3 border-t py-3">
        <p className="text-[11px] text-muted-foreground">{GUIDE_DISCLAIMER}</p>
        {v.isLoading && <div className="h-24 animate-pulse rounded bg-muted" data-testid="skeleton-stage-guide" />}
        {v.identityError && (
          <p role="alert" className="text-[11px] text-destructive">
            Could not confirm your account.{" "}
            <button type="button" className="underline" onClick={() => void v.refetchIdentity()} data-testid="button-retry-identity">Retry</button>
          </p>
        )}
        {q.isError && (
          <p role="alert" className="text-[11px] text-destructive">
            Guide unavailable: {guideErrMessage(q.error)}{" "}
            <button type="button" className="underline" onClick={() => void q.refetch()} data-testid="button-retry-stage-guide">Retry</button>
          </p>
        )}
        {q.data && guides.length === 0 && <p className="text-[11px] text-muted-foreground">No guide has been written for {stageKey} yet.</p>}
        {guides.map((g, i) => <GuideViewer key={`${g.id ?? "default"}-${g.kind}-${g.version}`} guide={g} idSuffix={`${stageKey}-${g.kind}-${i}`} />)}
        <Link href={`/stage-guides?stage=${encodeURIComponent(stageKey)}`} className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground" data-testid={`link-stage-guide-library-${stageKey}`}>
          <BookOpenText className="h-3 w-3" /> All stage guides
        </Link>
      </div>
    </details>
  );
}
