import { useMemo, useState } from "react";
import { useSearch } from "wouter";
import { useGetBoomerangOrigins, getGetBoomerangOriginsQueryKey, type BoomerangOriginKind } from "@workspace/api-client-react";
import { AlertTriangle, CornerDownLeft, RefreshCw } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BoomerangCaseList } from "@/components/boomerang/BoomerangCaseList";
import { BoomerangCreateForm } from "@/components/boomerang/BoomerangCreateForm";
import { BOOMERANG_QUERY, STAGE_ENGINE_ID, apiError, stagesFor } from "@/components/boomerang/boomerang-model";

const lab = "font-mono text-[10px] uppercase tracking-wider text-muted-foreground";
const sel = "h-9 w-full rounded-md border bg-background px-2 font-mono text-xs";

export default function BoomerangPage() {
  const search = new URLSearchParams(useSearch());
  const origins = useGetBoomerangOrigins({ query: { queryKey: getGetBoomerangOriginsQueryKey(), ...BOOMERANG_QUERY } });
  const list = origins.data?.origins ?? [];
  const [originKey, setOriginKey] = useState(() => {
    const k = search.get("originKind"); const id = search.get("originId");
    return k && id ? `${k}:${id}` : "";
  });
  const [stage, setStage] = useState(search.get("stage") ?? "");
  const [scope, setScope] = useState<"ALL" | "ORIGIN" | "STAGE">(originKey ? (stage ? "STAGE" : "ORIGIN") : "ALL");
  const [offset, setOffset] = useState(0);

  const [kind, id] = originKey ? (originKey.split(/:(.*)/s) as [BoomerangOriginKind, string]) : [null, ""];
  const origin = list.find((o) => o.kind === kind && o.id === id);
  const stages = useMemo(() => (kind ? stagesFor(kind, origins.data?.stages) : []), [kind, origins.data?.stages]);
  const effStage = kind === "F0" ? "F0" : stages.includes(stage) ? stage : "";

  const params = scope === "ALL" || !kind ? {} : scope === "ORIGIN" ? { originKind: kind, originId: id } : { originKind: kind, originId: id, ...(effStage ? { stage: effStage } : {}) };

  return (
    <div className="min-h-[100dvh] bg-background">
      <TopNav />
      <main className="container mx-auto px-4 py-6 md:px-6">
        <header className="mb-5">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-primary">ATANDA · SUPPORTING WORK</p>
          <h1 className="font-display text-4xl tracking-wider flex items-center gap-3"><CornerDownLeft className="h-7 w-7 text-secondary" />BOOMERANG</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Send a bounded request out from an exact origin and stage; record what comes back against a frozen source fingerprint. Returns are evidence for your review — never engine execution, stage advancement, certification or release.</p>
        </header>
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <aside className="border rounded p-3 bg-card space-y-3 h-fit" data-testid="panel-boomerang-origin">
            <div className={lab}>Origin</div>
            {origins.isLoading ? <Skeleton className="h-9 w-full" /> : origins.isError ? (
              <div className="font-mono text-xs text-destructive flex items-center gap-2" data-testid="error-origins"><AlertTriangle className="h-4 w-4" />{apiError(origins.error).message}
                <Button size="sm" variant="outline" className="h-7 ml-auto" onClick={() => void origins.refetch()} data-testid="button-retry-origins"><RefreshCw className="h-3 w-3" /></Button></div>
            ) : (
              <select className={sel} value={originKey} onChange={(e) => { setOriginKey(e.target.value); setOffset(0); if (e.target.value && scope === "ALL") setScope("ORIGIN"); }} data-testid="select-boomerang-origin">
                <option value="">Select an owned origin</option>
                {list.map((o) => <option key={`${o.kind}:${o.id}`} value={`${o.kind}:${o.id}`}>{o.kind} · {o.label}</option>)}
                {originKey && !origin && <option value={originKey}>{kind} · {id.slice(0, 8)} (not in your origins)</option>}
              </select>
            )}
            {kind && (
              <label className="block space-y-1">
                <span className={lab}>Stage</span>
                <select className={sel} value={effStage} disabled={kind === "F0"} onChange={(e) => { setStage(e.target.value); setOffset(0); }} data-testid="select-boomerang-stage">
                  {kind !== "F0" && <option value="">Select stage</option>}
                  {stages.map((s) => <option key={s} value={s}>{s}{STAGE_ENGINE_ID[s] != null ? ` (engine ${STAGE_ENGINE_ID[s]})` : ""}{s === "F12" ? " · support-only" : ""}</option>)}
                </select>
              </label>
            )}
            {kind && origin === undefined && !origins.isLoading && <p className="font-mono text-[10px] text-secondary">This origin is not in your owned list; the server will reject requests against it.</p>}
            {kind && effStage ? <BoomerangCreateForm key={`${originKey}:${effStage}`} originKind={kind} originId={id} stage={effStage} /> : <p className="font-mono text-[11px] text-muted-foreground">Pick an origin and stage to request support.</p>}
          </aside>
          <section className="space-y-3 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={lab}>Showing</span>
              {(["ALL", "ORIGIN", "STAGE"] as const).map((s) => (
                <Button key={s} size="sm" variant={scope === s ? "default" : "outline"} className="h-7 font-mono text-[10px]" disabled={s !== "ALL" && !kind} onClick={() => { setScope(s); setOffset(0); }} data-testid={`button-scope-${s}`}>
                  {s === "ALL" ? "All my requests" : s === "ORIGIN" ? "This origin" : "This origin + stage"}
                </Button>
              ))}
            </div>
            <BoomerangCaseList params={params} offset={offset} onOffset={setOffset} emptyText="No supporting-work requests in this view." />
          </section>
        </div>
      </main>
    </div>
  );
}
