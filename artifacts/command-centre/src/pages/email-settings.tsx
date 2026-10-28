import { useEffect, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetEmailDeliverySettingsQueryKey,
  getGetImprimaPortalQueryKey,
  useGetEmailDeliverySettings,
  useSaveEmailDeliverySettings,
  useTestEmailDeliverySettings,
  useVerifyEmailDeliverySettings,
  type EmailDeliveryInput,
  type EmailDeliverySettings,
} from "@workspace/api-client-react";
import { ArrowLeft, KeyRound, Loader2, Lock, Mail, Send, ShieldCheck } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErr } from "@/lib/portal";

type Mode = "MANAGED" | "OWN_PROVIDER";
type Provider = "RESEND" | "POSTMARK";

const lab = "font-mono text-[10px] uppercase tracking-wider text-muted-foreground";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STATUS: Record<string, { label: string; tone: string; note: string }> = {
  ACTIVE: { label: "Active", tone: "border-primary/50 bg-primary/10 text-primary", note: "Notification and publication emails for this scope are sent with these settings." },
  PENDING_VERIFICATION: { label: "Pending verification", tone: "border-secondary/60 bg-secondary/10 text-secondary", note: "Saved, but not active. Send a test and enter the six-digit code from your inbox to activate it." },
  UNCONFIGURED: { label: "Not configured", tone: "border-dashed text-muted-foreground", note: "No delivery is configured for this scope, so publication codes cannot be emailed yet." },
  ERROR: { label: "Error", tone: "border-destructive/50 bg-destructive/10 text-destructive", note: "The last delivery attempt failed. Check the sender and key, save again, then test." },
};

const PROVIDER_HELP: Record<Provider, { name: string; steps: string[] }> = {
  RESEND: { name: "Resend", steps: [
    "In Resend, add and verify your sending domain (Domains > Add domain, then publish the DNS records it shows).",
    "Create an API key with Sending access (API Keys > Create). Paste it below; it is never shown again here.",
    "Use a From address on that verified domain, for example notices@yourdomain.com.",
  ] },
  POSTMARK: { name: "Postmark", steps: [
    "In Postmark, verify a Sender Signature or the whole domain (Sender Signatures > Add Domain or Signature).",
    "Open your Server > API Tokens and copy the Server API token. Paste it below; it is never shown again here.",
    "Use a From address that matches the verified signature or domain.",
  ] },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.ERROR;
  return <span className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${s.tone}`} data-testid="status-email-delivery">{s.label}</span>;
}

/** Build the PUT body. Empty optional text is omitted so the server stores it as cleared (null). */
export function buildEmailInput(f: { mode: Mode; provider: Provider | ""; senderName: string; fromEmail: string; replyTo: string; credential: string }, organizationId: string | null): EmailDeliveryInput {
  const out: EmailDeliveryInput = { mode: f.mode };
  if (organizationId) out.organizationId = organizationId;
  if (f.senderName.trim()) out.senderName = f.senderName.trim();
  if (f.replyTo.trim()) out.replyTo = f.replyTo.trim();
  if (f.mode === "OWN_PROVIDER") {
    if (f.provider) out.provider = f.provider;
    if (f.fromEmail.trim()) out.fromEmail = f.fromEmail.trim();
    if (f.credential) out.credential = f.credential;
  }
  return out;
}

function fromSettings(s: EmailDeliverySettings) {
  return { mode: s.mode as Mode, provider: (s.provider ?? "") as Provider | "", senderName: s.senderName ?? "", fromEmail: s.fromEmail ?? "", replyTo: s.replyTo ?? "" };
}

/** Everything (form, credential, test and code state) lives in this component; the page keys it by scope so a switch drops it all. */
export function EmailDeliveryPanel({ organizationId }: { organizationId: string | null }) {
  const qc = useQueryClient();
  const params = organizationId ? { organizationId } : undefined;
  const q = useGetEmailDeliverySettings(params);
  const save = useSaveEmailDeliverySettings({ mutation: { retry: false } });
  const test = useTestEmailDeliverySettings({ mutation: { retry: false } });
  const verify = useVerifyEmailDeliverySettings({ mutation: { retry: false } });

  const [form, setForm] = useState({ mode: "MANAGED" as Mode, provider: "" as Provider | "", senderName: "", fromEmail: "", replyTo: "" });
  const [credential, setCredential] = useState("");
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const loaded = useRef(false);

  // Refetches only refresh the form while the user has no unsaved edits.
  useEffect(() => {
    if (!q.data || (dirty && loaded.current)) return;
    loaded.current = true;
    setForm(fromSettings(q.data));
  }, [q.data, dirty]);

  if (q.isLoading) return <div className="space-y-3" data-testid="email-settings-loading"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (q.isError || !q.data) return <p role="alert" className="text-sm text-destructive">Email settings unavailable: {apiErr(q.error)} <button className="underline" onClick={() => void q.refetch()} data-testid="button-retry-email-settings">Retry</button></p>;

  const s = q.data;
  const ro = !s.canManage;
  const edit = (patch: Partial<typeof form>) => {
    // Never accidentally submit a credential typed for a different provider.
    if (patch.provider !== undefined || patch.mode !== undefined) setCredential("");
    setForm((f) => ({ ...f, ...patch })); setDirty(true); setMsg(null);
  };
  const own = form.mode === "OWN_PROVIDER";
  const keepsKey = s.hasCredential && !!form.provider && s.provider === form.provider;
  const needsKey = own && !keepsKey;
  const errors: string[] = [];
  if (own && !form.provider) errors.push("Choose a provider.");
  if (own && !EMAIL.test(form.fromEmail.trim())) errors.push("Enter a valid From address on a verified sender.");
  if (needsKey && !credential) errors.push(s.hasCredential ? "A new key is required because the provider changed." : "Paste the provider API key.");
  if (form.replyTo.trim() && !EMAIL.test(form.replyTo.trim())) errors.push("Reply-to must be a valid address or left blank.");
  if (form.senderName.length > 80) errors.push("Sender name is limited to 80 characters.");
  if (credential.length > 500) errors.push("The key is longer than 500 characters.");

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: getGetEmailDeliverySettingsQueryKey(params) });
    void qc.invalidateQueries({ queryKey: getGetEmailDeliverySettingsQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetImprimaPortalQueryKey() });
  };

  const onSave = async () => {
    setMsg(null);
    try {
      const next = await save.mutateAsync({ data: buildEmailInput({ ...form, credential }, organizationId) });
      setCredential(""); setChallenge(null); setCode(""); setDirty(false);
      if (next) { qc.setQueryData(getGetEmailDeliverySettingsQueryKey(params), next); setForm(fromSettings(next)); }
      invalidate();
      setMsg({ ok: true, text: next?.status === "PENDING_VERIFICATION" ? "Saved. Send a test and enter the code to activate." : "Saved." });
    } catch (e) { setCredential(""); setMsg({ ok: false, text: apiErr(e) }); }
  };
  const onTest = async () => {
    setMsg(null);
    try {
      const r = await test.mutateAsync({ data: organizationId ? { organizationId } : {} });
      setCode("");
      setChallenge(r.expiresAt);
      setMsg({ ok: true, text: r.expiresAt ? `${r.message} Enter the six-digit code before ${new Date(r.expiresAt).toLocaleString()}.` : r.message });
    } catch (e) { setMsg({ ok: false, text: apiErr(e) }); }
  };
  const onVerify = async () => {
    setMsg(null);
    try {
      await verify.mutateAsync({ data: { ...(organizationId ? { organizationId } : {}), code } });
      setChallenge(null); setCode("");
      invalidate();
      setMsg({ ok: true, text: "Verified. Delivery for this scope is now active." });
    } catch (e) { setMsg({ ok: false, text: apiErr(e) }); }
  };

  const help = form.provider ? PROVIDER_HELP[form.provider] : null;
  return (
    <div className="space-y-6" data-testid={`email-delivery-${organizationId ?? "personal"}`}>
      <section className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_auto]" data-testid="panel-email-status">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={s.status} />
            <span className="font-mono text-[10px] text-muted-foreground">{s.configured ? "configured" : "not configured"}</span>
          </div>
          <p className="text-xs text-foreground/85" data-testid="text-email-status-note">{(STATUS[s.status] ?? STATUS.ERROR).note}</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {s.mode === "MANAGED" ? "Platform-managed delivery" : `Your ${s.provider ?? "provider"} account`}
            {s.fromEmail ? ` · from ${s.fromEmail}` : ""}{s.hasCredential ? " · key stored (hidden)" : ""}
            {s.verificationExpiresAt && s.status === "PENDING_VERIFICATION" ? ` · code expires ${new Date(s.verificationExpiresAt).toLocaleString()}` : ""}
          </p>
        </div>
        {ro && <span className="inline-flex items-center gap-1 self-start rounded border border-dashed px-2 py-1 font-mono text-[10px] uppercase text-muted-foreground" data-testid="badge-readonly"><Lock className="h-3 w-3" /> Read only</span>}
      </section>

      {ro && <p className="rounded border border-dashed p-3 text-xs text-muted-foreground" data-testid="text-readonly">Only organization owners and admins can change these settings. You can see what is in use.</p>}

      <fieldset disabled={ro || save.isPending || test.isPending || verify.isPending} className="space-y-5 rounded-lg border bg-card p-4" data-testid="form-email-delivery">
        <legend className="px-1 font-display text-xl tracking-wider">Delivery</legend>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Delivery mode">
          {([["MANAGED", "Platform-managed", "Default. Uses the platform's verified sender when platform delivery is configured."], ["OWN_PROVIDER", "Your own provider", "Sent from your verified Resend or Postmark sender, billed by that provider."]] as const).map(([m, t, d]) => (
            <label key={m} className={`cursor-pointer rounded-md border p-3 ${form.mode === m ? "border-primary bg-primary/5" : ""}`}>
              <span className="flex items-center gap-2 text-sm font-semibold"><input type="radio" name="mode" checked={form.mode === m} onChange={() => edit({ mode: m })} data-testid={`radio-mode-${m}`} /> {t}</span>
              <span className="mt-1 block text-[11px] text-muted-foreground">{d}</span>
            </label>
          ))}
        </div>

        {own && (
          <div className="space-y-4 rounded-md border border-dashed p-3" data-testid="panel-own-provider">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1"><span className={lab}>Provider</span>
                <select className="h-9 w-full rounded-md border bg-background px-2 font-mono text-xs" value={form.provider} onChange={(e) => edit({ provider: e.target.value as Provider | "" })} data-testid="select-email-provider">
                  <option value="">Select a provider</option><option value="RESEND">Resend</option><option value="POSTMARK">Postmark</option>
                </select>
              </label>
              <label className="block space-y-1"><span className={lab}>From address (verified sender)</span>
                <Input type="email" maxLength={254} value={form.fromEmail} onChange={(e) => edit({ fromEmail: e.target.value })} placeholder="notices@yourdomain.com" data-testid="input-from-email" />
              </label>
            </div>
            <label className="block space-y-1"><span className={lab}>API key</span>
              <Input type="password" autoComplete="new-password" maxLength={500} value={credential} onChange={(e) => { setCredential(e.target.value); setMsg(null); }}
                placeholder={keepsKey ? "Stored key retained. Leave blank to keep it." : "Paste the provider key"} data-testid="input-credential" />
              <span className="block text-[10px] text-muted-foreground">{keepsKey ? "A key for this provider is stored and never displayed. Enter a new one only to replace it." : "Required for a new connection or a provider change. It is sent once over HTTPS and never shown again."}</span>
            </label>
            {help && (
              <div className="rounded bg-muted/40 p-3 text-[11px]" data-testid={`help-${form.provider}`}>
                <p className="flex items-center gap-1 font-mono text-[10px] font-bold uppercase"><ShieldCheck className="h-3 w-3" /> {help.name} verified sender</p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-4">{help.steps.map((t) => <li key={t}>{t}</li>)}</ol>
                <p className="mt-1 text-muted-foreground">After saving, delivery stays pending until a test code sent to your account email is verified.</p>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1"><span className={lab}>Sender name (optional branding)</span>
            <Input maxLength={80} value={form.senderName} onChange={(e) => edit({ senderName: e.target.value })} placeholder="Leave blank for the default" data-testid="input-sender-name" />
          </label>
          <label className="block space-y-1"><span className={lab}>Reply-to (optional)</span>
            <Input type="email" maxLength={254} value={form.replyTo} onChange={(e) => edit({ replyTo: e.target.value })} placeholder="Leave blank for no reply-to" data-testid="input-reply-to" />
          </label>
        </div>

        {!ro && dirty && errors.length > 0 && <ul className="list-disc pl-5 text-[11px] text-destructive" data-testid="list-email-errors">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        {!ro && (
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={errors.length > 0 || save.isPending || (!dirty && !credential)} onClick={onSave} data-testid="button-save-email">
              {save.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <KeyRound className="mr-1 h-4 w-4" />} Save settings
            </Button>
            {dirty && <button type="button" className="text-[11px] underline" onClick={() => { setDirty(false); setCredential(""); setForm(fromSettings(s)); }} data-testid="button-discard-email">Discard changes</button>}
          </div>
        )}
      </fieldset>

      {!ro && (
        <section className="space-y-3 rounded-lg border bg-card p-4" data-testid="panel-email-test">
          <h2 className="flex items-center gap-2 font-display text-xl tracking-wider"><Mail className="h-4 w-4" /> Test and verify</h2>
          <p className="text-xs text-muted-foreground">A test goes only to the email on your own signed-in profile. Nothing is sent automatically and failed sends are not retried.</p>
          <Button variant="outline" disabled={!s.configured && s.status === "UNCONFIGURED" || dirty || test.isPending} onClick={onTest} data-testid="button-test-email">
            {test.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />} {challenge ? "Send a new test code" : "Send test to my account email"}
          </Button>
          {dirty && <p className="text-[11px] text-muted-foreground">Save your changes before testing.</p>}
          {challenge && (
            <div className="flex flex-wrap items-center gap-2" data-testid="panel-verify-code">
              <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" className="w-32 font-mono" data-testid="input-verify-code" />
              <Button disabled={code.length !== 6 || verify.isPending} onClick={onVerify} data-testid="button-verify-email">{verify.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Verify and activate</Button>
            </div>
          )}
        </section>
      )}
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-xs ${msg.ok ? "text-foreground/80" : "text-destructive"}`} data-testid="text-email-msg">{msg.text}</p>}
    </div>
  );
}

export default function EmailSettings() {
  const params = new URLSearchParams(useSearch());
  const organizationId = params.get("organizationId") || null;
  return (
    <div className="min-h-[100dvh] bg-background">
      <TopNav />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <Link href={organizationId ? `/orgs/${encodeURIComponent(organizationId)}` : "/account"} className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-primary" data-testid="link-email-back"><ArrowLeft className="h-3 w-3" /> {organizationId ? "Back to organization" : "Back to account"}</Link>
        <header>
          <p className={lab}>{organizationId ? `Organization ${organizationId.slice(0, 8)}` : "Personal account"}</p>
          <h1 className="font-display text-4xl tracking-wider">Email delivery</h1>
          <p className="mt-1 text-sm text-muted-foreground">How notifications and IMPRIMA Portal publication codes are sent for this {organizationId ? "organization" : "account"}.</p>
        </header>
        <p className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs" data-testid="text-auth-separate">
          Sign-in, SSO and identity verification emails are separate. They stay with your login provider and are not changed by anything on this page, and your account email address is not edited here.
        </p>
        <EmailDeliveryPanel key={organizationId ?? "personal"} organizationId={organizationId} />
      </main>
    </div>
  );
}
