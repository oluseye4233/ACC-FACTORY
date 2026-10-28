import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  useGetPlatformServices,
  getGetPlatformServicesQueryKey,
  type PlatformService,
} from "@workspace/api-client-react";

type Filter = "ALL" | "STAGE" | "FUNCTION" | "PARTIAL_OR_PLANNED";

const READINESS_LABEL: Record<PlatformService["serviceReadiness"], string> = {
  EXISTING_UNVERIFIED: "IN SOURCE · NOT YET VERIFIED",
  PARTIAL: "PARTIAL · LIMITED",
  PLANNED: "PLANNED · NOT LAUNCHED",
};

const READINESS_TONE: Record<PlatformService["serviceReadiness"], string> = {
  EXISTING_UNVERIFIED: "border-primary/40 text-primary bg-primary/5",
  PARTIAL: "border-amber-600/40 text-amber-700 dark:text-amber-400 bg-amber-500/5",
  PLANNED: "border-muted-foreground/40 text-muted-foreground bg-muted/40 border-dashed",
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(d);
  }
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function StatusChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded border border-border/70 bg-background/60 px-2 py-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-mono text-[11px] text-foreground/80">{value}</span>
    </div>
  );
}

function ServiceCard({ service }: { service: PlatformService }) {
  const [open, setOpen] = useState(false);
  const isPlanned = service.serviceReadiness === "PLANNED";
  return (
    <article
      className={`rounded-lg border bg-card p-5 flex flex-col ${isPlanned ? "border-dashed" : ""}`}
      data-testid={`guide-platform-service-${service.id}`}
      data-readiness={service.serviceReadiness}
    >
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="font-mono text-xs font-semibold text-primary">
          {service.stage ?? service.scope}
        </span>
        <span
          className={`rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wider ${READINESS_TONE[service.serviceReadiness]}`}
          data-testid={`status-readiness-${service.id}`}
        >
          {READINESS_LABEL[service.serviceReadiness]}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">{service.serviceMode}</span>
      </div>
      <h3 className="font-semibold text-lg mb-2">{service.title}</h3>
      <p className="text-sm leading-relaxed mb-2">
        <span className="font-semibold">You get: </span>
        {service.subscriberOutcome}
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed mb-2">
        <span className="font-semibold text-foreground/80">Limits: </span>
        {service.limitations}
      </p>
      {service.blockedReason && (
        <p className="text-sm leading-relaxed mb-2 border-l-2 border-amber-600/60 pl-3" data-testid={`text-blocked-${service.id}`}>
          <span className="font-semibold">Blocked: </span>
          {service.blockedReason}
        </p>
      )}
      <div className="grid grid-cols-2 gap-1.5 my-3">
        <StatusChip label="Local acceptance" value={service.localAcceptance} />
        <StatusChip label="Production acceptance" value={service.productionAcceptance} />
        <StatusChip label="Your eligibility" value={service.sourceEligibility} />
        <StatusChip label="Evidence checked" value={formatDate(service.evidenceCheckedAt)} />
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="self-start text-xs font-mono tracking-wider text-muted-foreground hover:text-primary"
        data-testid={`button-evidence-${service.id}`}
      >
        {open ? "HIDE" : "SHOW"} REQUIRED EVIDENCE ({service.requiredEvidence.length})
      </button>
      {open && (
        <div className="mt-2 text-sm">
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            {service.requiredEvidence.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            Entitlement {service.entitlement} · Assessment {service.assessmentStatus} · Delivery{" "}
            {service.deliveryStatus} · Operation {service.operationStatus}
          </p>
        </div>
      )}
      <div className="mt-auto pt-3">
        {service.href ? (
          <Link
            href={service.href}
            className="text-sm text-primary underline underline-offset-4"
            data-testid={`link-service-${service.id}`}
          >
            Open {service.title}
          </Link>
        ) : (
          <span className="text-xs font-mono text-muted-foreground" data-testid={`text-no-route-${service.id}`}>
            NO ROUTE AVAILABLE
          </span>
        )}
      </div>
    </article>
  );
}

export function PlatformStatus() {
  const query = useGetPlatformServices({
    query: {
      queryKey: getGetPlatformServicesQueryKey(),
      staleTime: 60_000,
      refetchOnWindowFocus: true,
      retry: false,
    },
  });
  const [filter, setFilter] = useState<Filter>("ALL");
  const data = query.data;

  const visible = useMemo(() => {
    const services = data?.services ?? [];
    if (filter === "ALL") return services;
    if (filter === "PARTIAL_OR_PLANNED") return services.filter((s) => s.serviceReadiness !== "EXISTING_UNVERIFIED");
    return services.filter((s) => s.scope === filter);
  }, [data, filter]);

  const filters: { id: Filter; label: string }[] = [
    { id: "ALL", label: `ALL (${data?.totalServices ?? 0})` },
    { id: "STAGE", label: `STAGES (${data?.stageServices ?? 0})` },
    { id: "FUNCTION", label: `SUPPORTING (${data?.supportingServices ?? 0})` },
    { id: "PARTIAL_OR_PLANNED", label: "PARTIAL / PLANNED" },
  ];

  return (
    <section id="platform-status" className="py-12 md:py-16 bg-muted/20 scroll-mt-24" aria-labelledby="platform-status-title">
      <div className="container px-4 md:px-6 max-w-6xl">
        <h2 id="platform-status-title" className="font-display text-3xl md:text-4xl tracking-wide text-primary mb-4">
          CURRENT PLATFORM STATUS
        </h2>
        <p className="text-sm mb-6 max-w-3xl">
          <strong>Available does not mean unrestricted.</strong> This inventory describes what exists in reviewed
          source, not what your account may run today. Sign-in, tier, source eligibility and spend limits still
          apply, and unavailable protections never grant fallback approval. For fresh baseline checks, open{" "}
          <Link href="/status" className="text-primary underline" data-testid="link-current-readiness">
            Check current readiness
          </Link>
          .
        </p>

        {query.isLoading && (
          <div data-testid="platform-status-loading" aria-busy="true" className="grid md:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border bg-card p-5 space-y-3 animate-pulse">
                <div className="h-3 w-24 rounded bg-muted" />
                <div className="h-5 w-2/3 rounded bg-muted" />
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-3 w-5/6 rounded bg-muted" />
              </div>
            ))}
          </div>
        )}

        {query.isError && !data && (
          <div role="alert" data-testid="platform-status-error" className="rounded-lg border border-destructive/40 bg-card p-5">
            <p className="font-semibold mb-1">The service inventory could not be loaded.</p>
            <p className="text-sm text-muted-foreground mb-3">
              No status is shown rather than an outdated one. Retry, or check baseline readiness instead.
            </p>
            <button
              type="button"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
              className="rounded border border-primary/50 px-3 py-1.5 text-sm text-primary hover:bg-primary/10 disabled:opacity-50"
              data-testid="button-retry-platform-status"
            >
              {query.isFetching ? "Retrying" : "Retry"}
            </button>
          </div>
        )}

        {data && (
          <>
            <div className="grid sm:grid-cols-3 gap-3 mb-6" data-testid="platform-status-summary">
              <div className="rounded-lg border bg-card p-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Inventory updated</p>
                <p className="font-mono text-sm" data-testid="text-inventory-updated">{formatDate(data.inventoryUpdatedAt)}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Response generated {formatDate(data.generatedAt)}. Generation time is not a verification time.
                </p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Service contracts</p>
                <p className="font-mono text-sm">
                  {data.totalServices} total · {data.stageServices} stages · {data.supportingServices} supporting
                </p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Accepted (this sprint)</p>
                <p className="font-mono text-sm" data-testid="text-accepted-counts">
                  Local {data.localAccepted} / {data.totalServices} · Production {data.productionAccepted} / {data.totalServices}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1" data-testid="text-accepted-explainer">
                  A count of 0 means not yet verified under the new {data.totalServices}-contract sprint. It does not mean
                  zero working features.
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6 max-w-3xl" data-testid="text-evidence-policy">
              {data.evidencePolicy}
            </p>

            <div className="flex flex-wrap gap-2 mb-5" role="group" aria-label="Filter services">
              {filters.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  aria-pressed={filter === f.id}
                  className={`rounded-full border px-3 py-1 text-xs font-mono tracking-wider transition-colors ${
                    filter === f.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-primary"
                  }`}
                  data-testid={`button-filter-${f.id.toLowerCase()}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {visible.map((s) => (
                <ServiceCard key={s.id} service={s} />
              ))}
            </div>

            {data.upgradeClasses.length > 0 && (
              <div className="mt-8">
                <h3 className="font-display text-xl tracking-wide text-primary mb-3">UPGRADE CLASSES</h3>
                <dl className="grid md:grid-cols-2 gap-4">
                  {data.upgradeClasses.map((u) => (
                    <div key={u.category} className="rounded-lg border bg-card p-4" data-testid={`upgrade-class-${u.category}`}>
                      <dt className="font-mono text-sm font-semibold text-primary mb-1">CLASS {u.category}</dt>
                      <dd className="text-sm mb-2">{u.description}</dd>
                      <dd className="text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground/80">Activation trigger: </span>
                        {u.activationTrigger}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
