import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckCircle2, FileText, Image as ImageIcon, Lock, RefreshCw, Upload, X } from "lucide-react";
import {
  useGetAutoCommandCatalog,
  useGetAutoCommandWorkspace,
  getGetAutoCommandWorkspaceQueryKey,
  useCreateAutoCommandDraft,
  type AutoCommandCatalog,
  type AutoCommandDraft,
  type AutoCommandDraftInput,
  type AutoCommandDraftInputDocumentType,
  type AutoCommandDraftInputIntakeMode,
  type AutoCommandDraftInputPackageType,
  type AutoCommandDraftInputTargetsItem,
  type AutoCommandUpload,
} from "@workspace/api-client-react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { useMarketingMeta } from "@/components/marketing/use-marketing-meta";
import { StudentSignOut, useStudentIdentity } from "@/components/learning-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { autoCommandClerkConfigured } from "@/pages/autocommand-auth";
import { AutoCommandOrders } from "@/components/autocommand-orders";

const base = import.meta.env.BASE_URL.replace(/\/$/, "");
const money = (c: number | null | undefined, cur = "USD") =>
  c == null ? "Unavailable" : new Intl.NumberFormat("en-US", { style: "currency", currency: cur, minimumFractionDigits: 0 }).format(c / 100);
const errText = (e: unknown) => (e instanceof Error && e.message ? e.message : "The request failed. Please retry.");
const humanize = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());

type Form = Omit<AutoCommandDraftInput, "requestKey">;
const EMPTY: Form = {
  projectName: "", packageType: "BASIC_AGENT", intakeMode: "PROMPT", documentType: "PRODUCT_BRIEF",
  specification: "", targetEmail: "", contactName: "", phone: "", ownerName: "", creatorName: "",
  companyName: "", logoUploadId: undefined, documentUploadId: undefined, cartridgeContext: "", targets: [], rightsConfirmed: false,
};
type FileRef = { id: string; filename: string; extractedCharacters?: number; reopened?: boolean };

const LIMITS = {
  DOCUMENT: { accept: ".txt,.md,.pdf,.docx", max: 5_000_000, ext: /\.(txt|md|pdf|docx)$/i, label: "TXT, MD, PDF or DOCX up to 5 MB" },
  LOGO: { accept: "image/png,image/jpeg,.png,.jpg,.jpeg", max: 2_000_000, ext: /\.(png|jpe?g)$/i, label: "PNG or JPEG up to 2 MB" },
} as const;

/** Multipart upload to the IMPRIMA Portal. Bytes are never kept client-side after the request. */
export async function uploadAutoCommandFile(file: File, purpose: "DOCUMENT" | "LOGO"): Promise<AutoCommandUpload> {
  const lim = LIMITS[purpose];
  if (!lim.ext.test(file.name)) throw new Error(`Unsupported file type. Use ${lim.label}.`);
  if (file.size > lim.max) throw new Error(`File is too large. Use ${lim.label}.`);
  const body = new FormData();
  body.append("file", file);
  body.append("purpose", purpose);
  const res = await fetch(`${base}/api/imprima-portal/autocommand/uploads`, { method: "POST", body, credentials: "include" });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const d = data as Record<string, unknown> | string | null;
    const msg = typeof d === "string" ? d : d && (d.message ?? d.error ?? d.detail ?? d.title);
    throw new Error(`Upload failed (${res.status}): ${typeof msg === "string" && msg.trim() ? msg : res.statusText || "unknown error"}`);
  }
  return data as AutoCommandUpload;
}

const FLOOR = [
  { f: "F1", t: "Intake brief", d: "Your idea, constraints and owner declarations are bound to one snapshot." },
  { f: "F0", t: "Business document", d: "The chosen F0 document is prepared as editable DOCX for human completion." },
  { f: "F2–F8", t: "Applicable stages only", d: "Specification stages relevant to the package. Inapplicable stages are skipped with a stated reason. F8 yields implementation guidance, not a codebase." },
];

function Kicker({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-secondary">{children}</p>;
}

export default function AutoCommandPage() {
  useMarketingMeta("ATANDA AutoCommand | AI-driven Fast Consulting",
    "Compare governed AI-agent and web-application specification packages. Save a private intake with verified email. Checkout and automatic fulfillment are not open yet.");
  const identity = useStudentIdentity();
  const clerkReady = autoCommandClerkConfigured();
  const qc = useQueryClient();
  const catalog = useGetAutoCommandCatalog();
  const workspace = useGetAutoCommandWorkspace({
    query: {
      queryKey: getGetAutoCommandWorkspaceQueryKey(),
      retry: 1,
      staleTime: 10_000,
      refetchInterval: (q) => !identity.isSignedIn ? false
        : !q.state.data?.authenticated || q.state.data.orders.some(order => order.state === "RUNNING") ? 2500 : 15_000,
    },
  });
  const ws = workspace.data;
  const signedOutBug = identity.isLoaded && !identity.isSignedIn && ws?.authenticated;

  // Re-check workspace whenever the individual identity changes.
  const lastIdentity = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!identity.isLoaded) return;
    const k = `${identity.isSignedIn}:${identity.userId ?? ""}`;
    if (lastIdentity.current !== undefined && lastIdentity.current !== k) void workspace.refetch();
    lastIdentity.current = k;
  }, [identity.isLoaded, identity.isSignedIn, identity.userId, workspace]);

  const owner = ws?.authenticated && !signedOutBug ? ws.verifiedEmail : null;

  return (
    <MarketingShell>
      <div className="relative">
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0 opacity-[0.035] [background-image:radial-gradient(hsl(var(--foreground))_1px,transparent_1px)] [background-size:22px_22px]" />
        <Hero catalog={catalog.data} />
        <LaunchNotice catalog={catalog.data} />
        <Catalog q={catalog} />
        <FloorPlan />
        <Governance />
        <section id="intake" className="relative mx-auto max-w-7xl scroll-mt-20 px-4 py-16 md:px-6">
          <Kicker>Private intake desk</Kicker>
          <h2 className="mt-3 font-display text-5xl md:text-6xl">Write the brief. Keep it.</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">A saved draft is a private record tied to your verified email. It is not an order, a payment, a reserved price or a claimed free package.</p>
          <div className="mt-10">
            {!clerkReady ? (
              <Notice tone="warn" title="Individual sign-in is not configured here">Private drafts require a verified individual identity, which is unavailable in this environment. The catalog above is still accurate.</Notice>
            ) : !identity.isLoaded || (workspace.isLoading && !ws) ? (
              <div className="space-y-3" aria-busy="true"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-64 w-full" /></div>
            ) : !identity.isSignedIn ? (
              <SignInPrompt />
            ) : workspace.isError && !ws ? (
              <Notice tone="error" title="We could not load your workspace" action={<RetryButton onClick={() => void workspace.refetch()} />}>{errText(workspace.error)}</Notice>
            ) : !owner ? (
              <Notice tone="warn" title="Confirming your verified email" action={<RetryButton onClick={() => void workspace.refetch()} />}>
                You are signed in, but the server has not yet confirmed a verified primary email for this identity. We re-check automatically. If this persists, verify your email address and sign in again.
              </Notice>
            ) : (
              <div>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                  <p className="text-sm text-muted-foreground">Verified customer: {owner}</p>
                  <StudentSignOut redirectPath="/autocommand" />
                </div>
                <Desk key={`${identity.userId ?? ""}:${owner}`} owner={owner} catalog={catalog.data} drafts={ws?.drafts ?? []}
                  checkoutReady={false}
                  onSaved={() => void qc.invalidateQueries({ queryKey: getGetAutoCommandWorkspaceQueryKey() })} />
                <AutoCommandOrders key={`orders:${identity.userId ?? ""}:${owner}`}
                  drafts={ws?.drafts ?? []} orders={ws?.orders ?? []} />
              </div>
            )}
          </div>
        </section>
      </div>
    </MarketingShell>
  );
}

function RetryButton({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="inline-flex h-10 items-center gap-2 border px-4 font-mono text-xs uppercase tracking-wider hover:bg-foreground/5" data-testid="button-retry"><RefreshCw className="h-3.5 w-3.5" aria-hidden />Retry</button>;
}

function Notice({ tone, title, children, action }: { tone: "warn" | "error" | "ok"; title: string; children: ReactNode; action?: ReactNode }) {
  const c = tone === "error" ? "border-destructive/50" : tone === "ok" ? "border-primary/50" : "border-secondary/60";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`ac-rise border-l-4 ${c} bg-card p-5 md:p-6`}>
      <p className="font-display text-2xl tracking-wide">{title}</p>
      <div className="mt-2 max-w-3xl text-sm text-muted-foreground">{children}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function Hero({ catalog }: { catalog?: AutoCommandCatalog }) {
  const prices = catalog?.packages.filter((p) => p.priceCents != null).map((p) => p.priceCents as number) ?? [];
  return (
    <section className="relative overflow-hidden border-b">
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-[1.4fr_1fr] md:px-6 md:py-24">
        <div className="ac-rise">
          <Kicker>ATANDA AutoCommand · Fast Consulting</Kicker>
          <h1 className="mt-5 font-display text-[clamp(3rem,8vw,7rem)] leading-[0.92]">
            Your idea, <span className="text-primary">specified.</span><br />Your package, <span className="text-secondary">owned.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">Describe what you want to build. ATANDA turns it into a governed specification package with your name as owner and your creator recorded beside it, ready to carry into the tools you already use.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#intake" className="inline-flex h-12 items-center gap-2 bg-primary px-6 font-display text-xl tracking-wider text-primary-foreground hover:opacity-90" data-testid="link-hero-intake">Start a private brief <ArrowRight className="h-4 w-4" aria-hidden /></a>
            <a href="#packages" className="inline-flex h-12 items-center border border-foreground/30 px-6 font-display text-xl tracking-wider hover:bg-foreground/5" data-testid="link-hero-packages">Compare packages</a>
          </div>
        </div>
        <div className="ac-rise ac-d2 self-end border bg-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Standard package prices</p>
          {catalog ? (
            <p className="mt-2 font-display text-6xl" data-testid="text-hero-prices">{prices.length ? prices.map((p) => money(p, catalog.currency)).join(" · ") : "Unavailable"}</p>
          ) : <Skeleton className="mt-3 h-14 w-3/4" />}
          <p className="mt-3 text-sm text-muted-foreground">Your first package is free, once per verified email address. Eligibility is confirmed at checkout when ordering opens.</p>
        </div>
      </div>
    </section>
  );
}

function LaunchNotice({ catalog }: { catalog?: AutoCommandCatalog }) {
  const r = catalog?.readiness;
  const rows: [string, boolean | undefined][] = [
    ["Private intake drafts", r?.intakeEnabled], ["Checkout", r?.checkoutEnabled],
    ["Automatic production", r?.automaticProductionEnabled], ["Email delivery", r?.emailDeliveryEnabled],
  ];
  return (
    <section className="relative border-b bg-secondary/10" aria-labelledby="launch-notice" data-testid="notice-launch">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:grid-cols-[1fr_auto] md:items-center md:px-6">
        <div>
          <p id="launch-notice" className="font-display text-2xl tracking-wide">Intake-only launch</p>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">You can read the real catalog and save private briefs. No money is collected, no package is generated or delivered, and no free-package claim is made yet.</p>
          {!!r?.blockers.length && <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">{r.blockers.map((b) => <li key={b}>{b}</li>)}</ul>}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-xs uppercase tracking-wider">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className={v ? "text-primary" : "text-foreground"} data-testid={`status-readiness-${k.split(" ")[0].toLowerCase()}`}>{v === undefined ? "Checking" : v ? "Open" : "Not open"}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Catalog({ q }: { q: { data?: AutoCommandCatalog; isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown } }) {
  const c = q.data;
  return (
    <section id="packages" className="relative mx-auto max-w-7xl scroll-mt-20 px-4 py-16 md:px-6">
      <Kicker>Catalog</Kicker>
      <h2 className="mt-3 font-display text-5xl md:text-6xl">Three ways to begin</h2>
      {q.isLoading ? (
        <div className="mt-10 grid gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-80" />)}</div>
      ) : q.isError || !c ? (
        <div className="mt-8"><Notice tone="error" title="Catalog unavailable" action={<RetryButton onClick={() => void q.refetch()} />}>{errText(q.error)}</Notice></div>
      ) : (
        <>
          <ol className="mt-10 grid gap-px border bg-border md:grid-cols-3">
            {c.packages.map((p, i) => (
              <li key={p.id} className={`ac-rise flex flex-col bg-card p-6 md:p-8 ${i === 1 ? "md:-my-3 md:border-t-4 md:border-secondary" : ""}`} style={{ animationDelay: `${i * 80}ms` }} data-testid={`card-package-${p.id}`}>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">0{i + 1}</p>
                <h3 className="mt-2 font-display text-3xl">{p.name}</h3>
                <p className="mt-2 font-display text-6xl text-primary" data-testid={`text-price-${p.id}`}>{money(p.priceCents, c.currency)}</p>
                <p className="mt-3 text-sm text-muted-foreground">{p.description}</p>
                <ul className="mt-5 space-y-2 text-sm">
                  {p.artifacts.map((a) => <li key={a} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />{a}</li>)}
                </ul>
                {!p.available && <p className="mt-4 font-mono text-xs uppercase text-muted-foreground">Not currently available</p>}
                <div className="mt-auto pt-6">
                  <button type="button" disabled aria-describedby="checkout-why" className="w-full cursor-not-allowed border border-dashed px-4 py-3 font-mono text-xs uppercase tracking-wider text-muted-foreground" data-testid={`button-checkout-${p.id}`}>
                    <Lock className="mr-2 inline h-3.5 w-3.5" aria-hidden />Checkout not open
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <p id="checkout-why" className="mt-4 max-w-3xl text-sm text-muted-foreground">Checkout is disabled because payment, automatic production and delivery have not passed launch acceptance. Save a brief now; nothing is charged or reserved.</p>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            <div><p className="font-display text-xl">Every package includes</p><ul className="mt-2 space-y-1 text-sm text-muted-foreground">{c.commonArtifacts.map((a) => <li key={a}>{a}</li>)}</ul></div>
            <div><p className="font-display text-xl">F0 document choices</p><ul className="mt-2 space-y-1 text-sm text-muted-foreground">{c.documentTypes.map((d) => <li key={d.id}>{d.name}</li>)}</ul></div>
            <div><p className="font-display text-xl">Guidance targets</p><p className="mt-2 text-sm text-muted-foreground">{c.targets.map(humanize).join(" · ")}</p><p className="mt-2 text-xs text-muted-foreground">Guidance for these tools; nothing is deployed to them.</p></div>
          </div>
          <div className="mt-8 border-l-4 border-secondary bg-card p-5 text-sm" data-testid="text-promotion">
            <p className="font-display text-xl">{humanize(c.promotion.policy)}</p>
            <p className="mt-1 text-muted-foreground">{c.promotion.description}</p>
          </div>
        </>
      )}
    </section>
  );
}

function FloorPlan() {
  return (
    <section className="relative border-y bg-card">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <Kicker>Planned flow · not live progress</Kicker>
        <h2 className="mt-3 font-display text-5xl">How a package will be made</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">This is the planned route once automatic production opens. It does not represent the status of any brief. F9 through F12 (build, deployment and later stages) are excluded from this service.</p>
        <ol className="mt-10 grid gap-6 md:grid-cols-3" aria-label="Planned stage sequence">
          {FLOOR.map((s, i) => (
            <li key={s.f} className="relative border-t-2 border-foreground/20 pt-5">
              <span className="font-mono text-xs text-muted-foreground">Step {i + 1}</span>
              <p className="font-display text-5xl text-primary">{s.f}</p>
              <p className="font-display text-xl">{s.t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 font-mono text-xs uppercase tracking-wider text-muted-foreground">Excluded: F9 · F10 · F11 · F12</p>
      </div>
    </section>
  );
}

function Governance() {
  const items = [
    { t: "GRO", d: "Governance requirements travel with every stage, so the package records what was asked, assumed and left open." },
    { t: "Honesty Gate", d: "Missing requirements are reported as missing, not invented. An internal assessment without independent verification is never shown as a PASS." },
    { t: "ZPOS token management", d: "A design discipline for bounding model usage per stage. It is a governance control, not a proven or promised saving." },
  ];
  return (
    <section className="relative mx-auto max-w-7xl px-4 py-16 md:px-6">
      <Kicker>Governance by design</Kicker>
      <h2 className="mt-3 max-w-3xl font-display text-5xl">Ethics written into the process, not stamped on the result</h2>
      <dl className="mt-10 grid gap-8 md:grid-cols-[1fr_1fr_1fr]">
        {items.map((x) => <div key={x.t}><dt className="font-display text-2xl text-primary">{x.t}</dt><dd className="mt-2 text-sm text-muted-foreground">{x.d}</dd></div>)}
      </dl>
      <p className="mt-8 text-xs text-muted-foreground">These are internal design controls. They are not independent certification, legal review or copyright registration. Ownership is a recorded declaration and contractual term.</p>
    </section>
  );
}

function SignInPrompt() {
  return (
    <div className="ac-rise grid gap-6 border bg-card p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8" data-testid="panel-signin">
      <div>
        <p className="font-display text-3xl">Sign in with your own verified email</p>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">Briefs are private to one individually verified email address. Staff access codes do not apply here.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/autocommand/login" className="inline-flex h-11 items-center bg-primary px-5 font-display text-lg tracking-wider text-primary-foreground hover:opacity-90" data-testid="link-signin">Sign in</Link>
        <Link href="/autocommand/register" className="inline-flex h-11 items-center border px-5 font-display text-lg tracking-wider hover:bg-foreground/5" data-testid="link-register">Create identity</Link>
      </div>
    </div>
  );
}

const field = "mt-1 w-full border bg-background px-3 py-2.5 text-sm outline-none focus-visible:border-primary";
const lbl = "block text-sm font-medium";

function Desk({ owner, catalog, drafts, onSaved, checkoutReady }: { owner: string; catalog?: AutoCommandCatalog; drafts: AutoCommandDraft[]; onSaved: () => void; checkoutReady: boolean }) {
  const [f, setF] = useState<Form>(EMPTY);
  const [docFile, setDocFile] = useState<FileRef | null>(null);
  const [logoFile, setLogoFile] = useState<FileRef | null>(null);
  const [uploading, setUploading] = useState<null | "DOCUMENT" | "LOGO">(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<AutoCommandDraft | null>(null);
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [corporate, setCorporate] = useState(false);
  const keyRef = useRef<{ key: string; sig: string } | null>(null);
  const create = useCreateAutoCommandDraft();
  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setF((p) => ({ ...p, [k]: v })); setSaved(null); };

  const payload = useMemo<Form>(() => ({
    ...f,
    projectName: f.projectName.trim(), specification: f.specification.trim(), targetEmail: f.targetEmail.trim(),
    contactName: f.contactName.trim(), phone: f.phone.trim(), creatorName: f.creatorName.trim(),
    companyName: corporate && f.companyName?.trim() ? f.companyName.trim() : undefined,
    ownerName: corporate && f.companyName?.trim() ? f.companyName.trim() : f.ownerName.trim(),
    logoUploadId: corporate ? f.logoUploadId : undefined,
    documentUploadId: f.intakeMode === "INTAKE" ? f.documentUploadId : undefined,
    cartridgeContext: f.intakeMode === "CARTRIDGE" && f.cartridgeContext?.trim() ? f.cartridgeContext.trim() : undefined,
  }), [f, corporate]);

  const reopen = (d: AutoCommandDraft) => {
    const i = d.input;
    setF({ ...EMPTY, ...i, companyName: i.companyName ?? "", cartridgeContext: i.cartridgeContext ?? "", targets: [...i.targets] });
    setCorporate(Boolean(i.companyName || i.logoUploadId));
    const ups = d.uploads;
    const find = (id?: string) => (id ? ups.find((u) => u.id === id) : undefined);
    const doc = find(i.documentUploadId), logo = find(i.logoUploadId);
    setDocFile(i.documentUploadId ? { id: i.documentUploadId, filename: doc?.filename ?? "Source file record not returned", extractedCharacters: doc?.extractedCharacters, reopened: true } : null);
    setLogoFile(i.logoUploadId ? { id: i.logoUploadId, filename: logo?.filename ?? "Logo file record not returned", extractedCharacters: logo?.extractedCharacters, reopened: true } : null);
    setOpenedId(d.id); setSaved(null); setFormErr(null); setUploadErr(null); keyRef.current = null;
    document.getElementById("intake-form")?.scrollIntoView({ block: "start" });
  };
  const reset = () => { setF(EMPTY); setDocFile(null); setLogoFile(null); setOpenedId(null); setSaved(null); setCorporate(false); keyRef.current = null; };

  const upload = async (file: File | undefined, purpose: "DOCUMENT" | "LOGO") => {
    if (!file) return;
    setUploadErr(null); setUploading(purpose);
    try {
      const r = await uploadAutoCommandFile(file, purpose);
      const ref = { id: r.id, filename: r.filename || file.name, extractedCharacters: r.extractedCharacters };
      if (purpose === "DOCUMENT") { setDocFile(ref); set("documentUploadId", r.id); } else { setLogoFile(ref); set("logoUploadId", r.id); }
    } catch (e) { setUploadErr(errText(e)); } finally { setUploading(null); }
  };

  const validate = (): string | null => {
    const p = payload;
    if (p.projectName.length < 2) return "Project name needs at least 2 characters.";
    if (p.specification.length < 40) return `Specification needs at least 40 characters (currently ${p.specification.length}).`;
    if (!/^\S+@\S+\.\S+$/.test(p.targetEmail)) return "Enter a valid destination email.";
    if (p.contactName.length < 2) return "Contact name is required.";
    if (p.phone.length < 5) return "Phone needs at least 5 characters.";
    if (p.ownerName.length < 2) return "Owner name is required.";
    if (p.creatorName.length < 2) return "Creator name is required.";
    if (!p.targets.length) return "Choose at least one guidance target.";
    if (corporate && !p.companyName) return "Corporate branding needs a company name (a logo requires one).";
    if (p.intakeMode === "CARTRIDGE" && (p.cartridgeContext?.length ?? 0) < 20) return "Cartridge brief needs at least 20 characters of SPC or reference context.";
    if (p.intakeMode === "INTAKE" && !p.documentUploadId) return "Intake mode needs an uploaded source document.";
    if (!p.rightsConfirmed) return "Confirm you have the rights to submit this material.";
    return null;
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = validate(); setFormErr(v); if (v) return;
    const sig = JSON.stringify(payload);
    // Unchanged retries keep the same key so an uncertain save is not duplicated.
    if (!keyRef.current || keyRef.current.sig !== sig) keyRef.current = { key: crypto.randomUUID(), sig };
    create.mutate({ data: { ...payload, requestKey: keyRef.current.key } }, {
      onSuccess: (d) => { setSaved(d); setOpenedId(d.id); onSaved(); },
    });
  };

  const disabled = create.isPending || uploading !== null;
  const targets = catalog?.targets ?? [];
  const pkgs = catalog?.packages ?? [];
  const docs = catalog?.documentTypes ?? [];

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
      <form id="intake-form" onSubmit={submit} noValidate className="ac-rise scroll-mt-24 space-y-10" aria-describedby="desk-owner">
        <p id="desk-owner" className="font-mono text-xs text-muted-foreground">Saving as <span className="text-foreground" data-testid="text-verified-email">{owner}</span>{openedId && <> · editing a copy of draft <span data-testid="text-opened-draft">{openedId}</span></>}</p>

        <fieldset className="space-y-4">
          <legend className="font-display text-3xl">1 · The package</legend>
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Package">
            {pkgs.map((p) => (
              <label key={p.id} className={`cursor-pointer border p-4 transition-colors ${f.packageType === p.id ? "border-primary bg-primary/5" : "hover:bg-foreground/5"} ${!p.available ? "opacity-50" : ""}`}>
                <input type="radio" name="pkg" className="sr-only" value={p.id} checked={f.packageType === p.id} disabled={!p.available} onChange={() => set("packageType", p.id as AutoCommandDraftInputPackageType)} data-testid={`radio-package-${p.id}`} />
                <span className="block font-display text-xl">{p.name}</span>
                <span className="font-mono text-xs text-muted-foreground">Standard {money(p.priceCents, catalog?.currency)}</span>
              </label>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={lbl}>Project name<input className={field} value={f.projectName} maxLength={160} onChange={(e) => set("projectName", e.target.value)} data-testid="input-project-name" /></label>
            <label className={lbl}>F0 business document
              <select className={field} value={f.documentType} onChange={(e) => set("documentType", e.target.value as AutoCommandDraftInputDocumentType)} data-testid="select-document-type">
                {docs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="font-display text-3xl">2 · Your idea</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Intake mode">
            {(["PROMPT", "INTAKE", "CARTRIDGE"] as AutoCommandDraftInputIntakeMode[]).map((m) => (
              <label key={m} className={`cursor-pointer border px-4 py-2 font-mono text-xs uppercase tracking-wider ${f.intakeMode === m ? "border-primary bg-primary text-primary-foreground" : "hover:bg-foreground/5"}`}>
                <input type="radio" name="mode" className="sr-only" checked={f.intakeMode === m} onChange={() => set("intakeMode", m)} data-testid={`radio-mode-${m}`} />{m === "PROMPT" ? "Prompt" : m === "INTAKE" ? "Document intake" : "Cartridge brief"}
              </label>
            ))}
          </div>
          <label className={lbl}>Specification <span className="font-mono text-xs text-muted-foreground">({f.specification.trim().length} / 40,000, min 40)</span>
            <textarea className={`${field} min-h-48`} maxLength={40000} value={f.specification} onChange={(e) => set("specification", e.target.value)} placeholder="Who is it for, what must it do, what must it never do, and how will you know it works?" data-testid="input-specification" />
          </label>
          {f.intakeMode === "INTAKE" && (
            <FilePick purpose="DOCUMENT" file={docFile} busy={uploading === "DOCUMENT"} onPick={(x) => void upload(x, "DOCUMENT")}
              onClear={() => { setDocFile(null); set("documentUploadId", undefined); }} hint="Uploaded privately through IMPRIMA Portal." />
          )}
          {f.intakeMode === "CARTRIDGE" && (
            <div>
              <label className={lbl}>SPC or reference context
                <textarea className={`${field} min-h-32 font-mono`} maxLength={20000} value={f.cartridgeContext ?? ""} onChange={(e) => set("cartridgeContext", e.target.value)} data-testid="input-cartridge-context" />
              </label>
              <p className="mt-1 text-xs text-muted-foreground">This is saved as part of your brief. It is not yet processed by the standard-floor cartridge compiler.</p>
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="font-display text-3xl">3 · People and ownership</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={lbl}>Contact name<input className={field} autoComplete="name" value={f.contactName} onChange={(e) => set("contactName", e.target.value)} data-testid="input-contact-name" /></label>
            <label className={lbl}>Phone<input className={field} type="tel" autoComplete="tel" maxLength={40} value={f.phone} onChange={(e) => set("phone", e.target.value)} data-testid="input-phone" /></label>
            <label className={`${lbl} sm:col-span-2`}>Delivery email (where a future package would go)<input className={field} type="email" autoComplete="email" maxLength={320} value={f.targetEmail} onChange={(e) => set("targetEmail", e.target.value)} data-testid="input-target-email" /></label>
            <label className={lbl}>Owner<span className="block text-xs font-normal text-muted-foreground">The person or company that will own the package.</span><input className={`${field} read-only:opacity-70`} readOnly={corporate} value={corporate ? f.companyName ?? "" : f.ownerName} onChange={(e) => set("ownerName", e.target.value)} data-testid="input-owner-name" />{corporate && <span className="mt-1 block text-xs font-normal text-muted-foreground">With corporate branding, the company is the owner; this follows the company name. The creator stays the individual.</span>}</label>
            <label className={lbl}>Creator<span className="block text-xs font-normal text-muted-foreground">The individual member who authored the brief.</span><input className={field} value={f.creatorName} onChange={(e) => set("creatorName", e.target.value)} data-testid="input-creator-name" /></label>
          </div>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={corporate} onChange={(e) => { setCorporate(e.target.checked); setSaved(null); }} data-testid="checkbox-corporate" />Add corporate branding (optional)</label>
          {corporate && (
            <div className="ac-rise grid gap-4 border-l-2 border-secondary pl-4 sm:grid-cols-2">
              <label className={lbl}>Company name<input className={field} maxLength={160} value={f.companyName ?? ""} onChange={(e) => set("companyName", e.target.value)} data-testid="input-company-name" /></label>
              <FilePick purpose="LOGO" file={logoFile} busy={uploading === "LOGO"} onPick={(x) => void upload(x, "LOGO")} onClear={() => { setLogoFile(null); set("logoUploadId", undefined); }} hint="Shown on branded documents." />
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="font-display text-3xl">4 · Where you will build</legend>
          <p className="text-sm text-muted-foreground">Choose 1 to 8 targets for implementation guidance. Nothing is deployed.</p>
          <div className="flex flex-wrap gap-2">
            {targets.map((t) => {
              const on = f.targets.includes(t as AutoCommandDraftInputTargetsItem);
              return (
                <button key={t} type="button" aria-pressed={on} onClick={() => set("targets", on ? f.targets.filter((x) => x !== t) : [...f.targets, t as AutoCommandDraftInputTargetsItem].slice(0, 8))}
                  className={`border px-3 py-2 text-sm transition-colors ${on ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5"}`} data-testid={`button-target-${t}`}>{humanize(t)}</button>
              );
            })}
          </div>
        </fieldset>

        <label className="flex gap-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" checked={f.rightsConfirmed} onChange={(e) => set("rightsConfirmed", e.target.checked)} data-testid="checkbox-rights" />I have the right to submit this material, and the owner and creator named above are accurate.</label>

        <div aria-live="polite" className="space-y-3">
          {uploadErr && <Notice tone="error" title="Upload failed">{uploadErr}</Notice>}
          {formErr && <Notice tone="error" title="Check the brief">{formErr}</Notice>}
          {create.isError && <Notice tone="error" title="Draft not confirmed" action={<button type="submit" className="underline">Retry with the same request</button>}>{errText(create.error)} Retrying an unchanged brief reuses the same request key, so it will not create a duplicate.</Notice>}
          {saved && (
            <Notice tone="ok" title="Draft saved">
              <span data-testid="text-saved-draft">Draft <b className="font-mono text-foreground">{saved.id}</b> · state <b className="text-foreground">{saved.state}</b>. This is a private saved brief. It is not an order, no payment was taken, and free-package eligibility will be checked at checkout.</span>
            </Notice>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t pt-6">
          <button type="submit" disabled={disabled} aria-busy={create.isPending} className="inline-flex h-12 items-center gap-2 bg-primary px-6 font-display text-xl tracking-wider text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-save-draft">
            {create.isPending ? "Saving draft" : uploading ? "Waiting for upload" : "Save private draft"}
          </button>
          <button type="button" disabled title="Checkout is not open in this launch" className="inline-flex h-12 cursor-not-allowed items-center gap-2 border border-dashed px-5 font-mono text-xs uppercase tracking-wider text-muted-foreground" data-testid="button-checkout">
            <Lock className="h-3.5 w-3.5" aria-hidden />{checkoutReady ? "Checkout" : "Checkout not open"}
          </button>
          <button type="button" onClick={reset} className="ml-auto font-mono text-xs uppercase tracking-wider underline" data-testid="button-new-brief">Start a blank brief</button>
        </div>
      </form>

      <aside aria-labelledby="drafts-h" className="lg:sticky lg:top-24 lg:self-start">
        <h3 id="drafts-h" className="font-display text-2xl">Your saved drafts</h3>
        {drafts.length === 0 ? (
          <div className="mt-3 border border-dashed p-5 text-sm text-muted-foreground" data-testid="empty-drafts">
            <FileText className="mb-2 h-5 w-5" aria-hidden />No saved briefs yet. Your first draft will appear here, private to {owner}.
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {drafts.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => reopen(d)} className={`w-full border p-3 text-left transition-colors hover:bg-foreground/5 ${openedId === d.id ? "border-primary" : ""}`} data-testid={`button-reopen-${d.id}`}>
                  <span className="block font-display text-lg leading-tight">{d.projectName}</span>
                  <span className="block font-mono text-[11px] text-muted-foreground">{humanize(d.packageType)} · {money(d.standardPriceCents, catalog?.currency)} standard · {d.state}</span>
                  <span className="block font-mono text-[11px] text-muted-foreground">{new Date(d.createdAt).toLocaleString()}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">Reopening loads a copy. Saving changes creates a new draft record.</p>
      </aside>
    </div>
  );
}

function FilePick({ purpose, file, busy, onPick, onClear, hint }: { purpose: "DOCUMENT" | "LOGO"; file: FileRef | null; busy: boolean; onPick: (f: File | undefined) => void; onClear: () => void; hint: string }) {
  const lim = LIMITS[purpose];
  const id = `file-${purpose.toLowerCase()}`;
  const Icon = purpose === "LOGO" ? ImageIcon : Upload;
  return (
    <div>
      <span className={lbl}>{purpose === "LOGO" ? "Logo" : "Source document"}</span>
      {file ? (
        <div className="mt-1 flex items-center gap-3 border bg-background p-3 text-sm" data-testid={`text-${id}`}>
          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{file.filename}</span>
            <span className="block font-mono text-[11px] text-muted-foreground">ID {file.id}{file.extractedCharacters != null ? ` · ${file.extractedCharacters.toLocaleString()} characters read` : ""}{file.reopened ? " · from saved draft" : ""}</span>
          </span>
          <button type="button" onClick={onClear} aria-label="Remove file" className="p-1 hover:bg-foreground/5" data-testid={`button-clear-${id}`}><X className="h-4 w-4" /></button>
        </div>
      ) : (
        <label htmlFor={id} className={`mt-1 flex cursor-pointer items-center gap-3 border border-dashed p-4 text-sm hover:bg-foreground/5 ${busy ? "opacity-60" : ""}`}>
          {busy ? <AlertTriangle className="h-4 w-4 text-secondary" aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}
          <span>{busy ? "Uploading, please wait" : `Choose file · ${lim.label}`}<span className="block text-xs text-muted-foreground">{hint}</span></span>
          <input id={id} type="file" className="sr-only" accept={lim.accept} disabled={busy} onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ""; }} data-testid={`input-${id}`} />
        </label>
      )}
    </div>
  );
}
