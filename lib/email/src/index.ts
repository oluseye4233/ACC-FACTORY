export type EmailResult =
  | { ok: true; id: string; dryRun?: boolean }
  | { ok: false; error: string };

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

const FROM = process.env.EMAIL_FROM ?? "ATANDA Command Centre <no-reply@atanda.local>";

async function send(args: SendArgs): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Dry-run: keep dev/test working without a key.
    // eslint-disable-next-line no-console
    console.log(
      `[email:dry-run] -> ${args.to} :: ${args.subject}\n${args.text.slice(0, 240)}`,
    );
    return { ok: true, id: `dryrun-${Date.now()}`, dryRun: true };
  }
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(key);
    const result = await resend.emails.send({
      from: FROM,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    });
    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true, id: result.data?.id ?? "unknown" };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

const wrap = (title: string, body: string): string =>
  `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#0d0d0d;color:#f2f2f2;padding:32px;">
  <div style="max-width:560px;margin:0 auto;border:1px solid #262626;border-radius:8px;padding:32px;background:#121212;">
    <h1 style="font-size:18px;letter-spacing:0.1em;color:#1A6B3A;margin:0 0 24px;">${title}</h1>
    ${body}
    <p style="margin-top:32px;font-size:11px;color:#888;letter-spacing:0.1em;">ATANDA · FORGE.BONSAI HARNESS</p>
  </div>
</body></html>`;

export function sendCertIssued(args: {
  to: string;
  certId: string;
  certClass: string;
  sessionName: string;
  verifyUrl: string;
}): Promise<EmailResult> {
  const body = `<p>Your session <strong>${args.sessionName}</strong> has been compressed and certified.</p>
    <p style="font-family:monospace;background:#0d0d0d;padding:12px;border:1px solid #262626;">
      Cert ID: ${args.certId}<br/>Class: ${args.certClass}
    </p>
    <p><a href="${args.verifyUrl}" style="color:#1A6B3A;">Verify certificate →</a></p>`;
  const text = `MVP PDD certified.\nSession: ${args.sessionName}\nCert: ${args.certId} (${args.certClass})\nVerify: ${args.verifyUrl}`;
  return send({ to: args.to, subject: `MVP PDD CERTIFIED · ${args.certId}`, html: wrap("MVP PDD CERTIFIED", body), text });
}

export function sendEscalationGranted(args: {
  to: string;
  engine: string;
  sessionName: string;
}): Promise<EmailResult> {
  const body = `<p>An escalation has been granted on session <strong>${args.sessionName}</strong> for engine <strong>${args.engine}</strong>.</p>
  <p>Tier gating is bypassed for this session.</p>`;
  const text = `Escalation granted · ${args.engine} · ${args.sessionName}`;
  return send({ to: args.to, subject: `ESCALATION GRANTED · ${args.engine}`, html: wrap("ESCALATION GRANTED", body), text });
}

export function sendSubscriptionReceipt(args: {
  to: string;
  tier: string;
  amountUsd: number;
  periodEnd: Date | null;
}): Promise<EmailResult> {
  const period = args.periodEnd ? args.periodEnd.toISOString().slice(0, 10) : "—";
  const body = `<p>Payment received for tier <strong>${args.tier}</strong>.</p>
    <p style="font-family:monospace;">Amount: $${args.amountUsd.toFixed(2)}<br/>Period ends: ${period}</p>`;
  const text = `Payment received · ${args.tier} · $${args.amountUsd.toFixed(2)} · period ends ${period}`;
  return send({ to: args.to, subject: `PAYMENT RECEIVED · ${args.tier}`, html: wrap("PAYMENT RECEIVED", body), text });
}

export function sendSubscriptionCancelled(args: {
  to: string;
  tier: string;
  periodEnd: Date | null;
}): Promise<EmailResult> {
  const period = args.periodEnd ? args.periodEnd.toISOString().slice(0, 10) : "immediately";
  const body = `<p>Your <strong>${args.tier}</strong> subscription has been cancelled.</p>
  <p>Access continues until: <strong>${period}</strong>.</p>`;
  const text = `Subscription cancelled · ${args.tier} · access until ${period}`;
  return send({ to: args.to, subject: `SUBSCRIPTION CANCELLED · ${args.tier}`, html: wrap("SUBSCRIPTION CANCELLED", body), text });
}

export function sendPaymentFailed(args: {
  to: string;
  tier: string;
}): Promise<EmailResult> {
  const body = `<p>A payment for your <strong>${args.tier}</strong> subscription failed.</p>
    <p>Please update your billing details to avoid service interruption.</p>`;
  const text = `Payment failed for ${args.tier}. Update billing to avoid interruption.`;
  return send({ to: args.to, subject: `PAYMENT FAILED · action required`, html: wrap("PAYMENT FAILED", body), text });
}

export function sendWelcome(args: {
  to: string;
  displayName: string | null;
}): Promise<EmailResult> {
  const name = args.displayName?.trim() || "Operator";
  const body = `<p>Welcome to ATANDA Command Centre, <strong>${name}</strong>.</p>
    <p>You now have access to the FORGE.BONSAI HARNESS — eight atomic-prompt engines that walk a raw idea
    through prompt → SPC → PDD → certified MVP-PDD.</p>
    <p>Your first session is one click away from the Command dashboard.</p>`;
  const text = `Welcome to ATANDA Command Centre, ${name}. Start your first FORGE.BONSAI session from the Command dashboard.`;
  return send({ to: args.to, subject: `WELCOME · ATANDA COMMAND CENTRE`, html: wrap("WELCOME, OPERATOR", body), text });
}

export function sendAccountDeleted(args: {
  to: string;
}): Promise<EmailResult> {
  const body = `<p>Your ATANDA Command Centre account has been permanently deleted.</p>
    <p>All sessions, artifacts, badges and subscriber records have been removed. Active Stripe subscriptions
    were cancelled by Clerk identity removal but you may wish to verify in your bank/card statement.</p>
    <p>If this was not you, contact support immediately.</p>`;
  const text = `Your ATANDA Command Centre account and all associated data have been permanently deleted.`;
  return send({ to: args.to, subject: `ACCOUNT DELETED · ATANDA`, html: wrap("ACCOUNT DELETED", body), text });
}
