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

export function sendBadgeRevoked(args: {
  to: string;
  badgeId: string;
  badgeName: string;
  reason: string;
  appealUrl: string;
  isRepeat?: boolean;
}): Promise<EmailResult> {
  const repeat = args.isRepeat ? " (repeat revocation)" : "";
  const escapedReason = args.reason.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = `<p>An administrator has revoked your <strong>${args.badgeName}</strong> badge${repeat}.</p>
    <p style="font-family:monospace;background:#0d0d0d;padding:12px;border:1px solid #262626;white-space:pre-wrap;">${escapedReason}</p>
    <p>If you believe this was a mistake or you want to appeal, you can re-submit fresh evidence
    on your Quest Badges page. A successful re-submission immediately restores the badge.</p>
    <p><a href="${args.appealUrl}" style="color:#1A6B3A;">Re-submit evidence →</a></p>`;
  const text = `Your ${args.badgeName} badge was revoked${repeat}.\nReason: ${args.reason}\nAppeal / re-submit: ${args.appealUrl}`;
  return send({
    to: args.to,
    subject: `BADGE REVOKED · ${args.badgeId}`,
    html: wrap("BADGE REVOKED", body),
    text,
  });
}

export function sendBadgeRestored(args: {
  to: string;
  badgeId: string;
  badgeName: string;
  note: string | null;
  badgesUrl: string;
}): Promise<EmailResult> {
  const escapedNote = args.note
    ? args.note.replace(/</g, "&lt;").replace(/>/g, "&gt;")
    : null;
  const noteBlock = escapedNote
    ? `<p>Note from the administrator:</p>
    <p style="font-family:monospace;background:#0d0d0d;padding:12px;border:1px solid #262626;white-space:pre-wrap;">${escapedNote}</p>`
    : "";
  const body = `<p>Good news — an administrator has <strong>restored</strong> your <strong>${args.badgeName}</strong> badge.</p>
    <p>The earlier revocation has been cleared and the badge is once again marked as CLAIMED on your profile.
    The original revocation record is preserved in the audit trail.</p>
    ${noteBlock}
    <p><a href="${args.badgesUrl}" style="color:#1A6B3A;">View your badges →</a></p>`;
  const noteText = args.note ? `\nNote: ${args.note}` : "";
  const text = `Your ${args.badgeName} badge has been restored by an administrator.${noteText}\nView: ${args.badgesUrl}`;
  return send({
    to: args.to,
    subject: `BADGE RESTORED · ${args.badgeId}`,
    html: wrap("BADGE RESTORED", body),
    text,
  });
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

export function sendOrgInvite(args: {
  to: string;
  orgName: string;
  acceptUrl: string;
  inviterEmail: string | null;
}): Promise<EmailResult> {
  const from = args.inviterEmail ? ` (invited by ${args.inviterEmail})` : "";
  const body = `<p>You've been invited to join <strong>${args.orgName}</strong> on ATANDA Command Centre${from}.</p>
    <p>Click below to accept. The invite expires in 14 days.</p>
    <p><a href="${args.acceptUrl}" style="display:inline-block;padding:12px 24px;background:#1A6B3A;color:#fff;border-radius:4px;text-decoration:none;letter-spacing:0.1em;font-family:monospace;">ACCEPT INVITE</a></p>
    <p style="font-size:11px;color:#888;">Or paste this URL into your browser:<br/>${args.acceptUrl}</p>`;
  const text = `You've been invited to join ${args.orgName} on ATANDA Command Centre${from}. Accept: ${args.acceptUrl}`;
  return send({ to: args.to, subject: `INVITE · ${args.orgName} on ATANDA`, html: wrap("ORGANIZATION INVITE", body), text });
}

export interface DigestRow {
  label: string;
  count: number;
  costUsd: number;
}

export function sendOrgActivityDigest(args: {
  to: string;
  orgName: string;
  periodStart: Date;
  periodEnd: Date;
  totalRuns: number;
  totalCostUsd: number;
  byEngine: DigestRow[];
  byMember: DigestRow[];
  billingEvents: Array<{ ts: Date; type: string }>;
  activityUrl: string;
  unsubscribeUrl: string;
}): Promise<EmailResult> {
  const fmt = (d: Date): string => d.toISOString().slice(0, 10);
  const fmtUsd = (n: number): string => `$${n.toFixed(2)}`;
  const rowsHtml = (rows: DigestRow[]): string =>
    rows.length === 0
      ? `<p style="color:#888;font-style:italic;">No activity.</p>`
      : `<table style="width:100%;border-collapse:collapse;font-family:monospace;font-size:12px;">
          ${rows
            .map(
              (r) => `<tr>
                <td style="padding:4px 8px;border-bottom:1px solid #262626;">${r.label}</td>
                <td style="padding:4px 8px;border-bottom:1px solid #262626;text-align:right;">${r.count}</td>
                <td style="padding:4px 8px;border-bottom:1px solid #262626;text-align:right;">${fmtUsd(r.costUsd)}</td>
              </tr>`,
            )
            .join("")}
        </table>`;
  const rowsText = (rows: DigestRow[]): string =>
    rows.length === 0
      ? "  (none)"
      : rows.map((r) => `  ${r.label.padEnd(28)} ${String(r.count).padStart(4)}  ${fmtUsd(r.costUsd)}`).join("\n");
  const billingHtml =
    args.billingEvents.length === 0
      ? `<p style="color:#888;font-style:italic;">No billing events.</p>`
      : `<ul style="font-family:monospace;font-size:12px;">${args.billingEvents
          .map((e) => `<li>${fmt(e.ts)} · ${e.type}</li>`)
          .join("")}</ul>`;
  const billingText =
    args.billingEvents.length === 0
      ? "  (none)"
      : args.billingEvents.map((e) => `  ${fmt(e.ts)} · ${e.type}`).join("\n");
  const body = `<p>Weekly activity digest for <strong>${args.orgName}</strong>
    (${fmt(args.periodStart)} → ${fmt(args.periodEnd)}).</p>
    <p style="font-family:monospace;">
      Total engine runs: <strong>${args.totalRuns}</strong><br/>
      Total spend: <strong>${fmtUsd(args.totalCostUsd)}</strong>
    </p>
    <h2 style="font-size:13px;letter-spacing:0.1em;color:#1A6B3A;margin-top:24px;">BY ENGINE</h2>
    ${rowsHtml(args.byEngine)}
    <h2 style="font-size:13px;letter-spacing:0.1em;color:#1A6B3A;margin-top:24px;">BY MEMBER</h2>
    ${rowsHtml(args.byMember)}
    <h2 style="font-size:13px;letter-spacing:0.1em;color:#1A6B3A;margin-top:24px;">BILLING</h2>
    ${billingHtml}
    <p style="margin-top:32px;"><a href="${args.activityUrl}" style="color:#1A6B3A;">Open full activity log →</a></p>
    <p style="margin-top:24px;font-size:11px;color:#888;">
      You're receiving this because you are an owner/admin of ${args.orgName}.
      <a href="${args.unsubscribeUrl}" style="color:#888;">Unsubscribe</a>.
    </p>`;
  const text = `Weekly activity digest · ${args.orgName} · ${fmt(args.periodStart)} → ${fmt(args.periodEnd)}
Total runs: ${args.totalRuns}    Total spend: ${fmtUsd(args.totalCostUsd)}

By engine:
${rowsText(args.byEngine)}

By member:
${rowsText(args.byMember)}

Billing:
${billingText}

Full activity: ${args.activityUrl}
Unsubscribe: ${args.unsubscribeUrl}`;
  return send({
    to: args.to,
    subject: `WEEKLY DIGEST · ${args.orgName}`,
    html: wrap("WEEKLY ACTIVITY DIGEST", body),
    text,
  });
}

export function sendBillingFailureAlert(args: {
  to: string;
  orgName: string | null;
  eventType: string;
  occurredAt: Date;
  billingUrl: string;
  unsubscribeUrl: string;
}): Promise<EmailResult> {
  const scope = args.orgName ? `team subscription for <strong>${args.orgName}</strong>` : `your subscription`;
  const scopeText = args.orgName ? `team subscription for ${args.orgName}` : "your subscription";
  const body = `<p>A billing event on ${scope} needs your attention:
    <strong>${args.eventType}</strong> at ${args.occurredAt.toISOString()}.</p>
    <p>Update billing details to avoid service interruption.</p>
    <p><a href="${args.billingUrl}" style="display:inline-block;padding:12px 24px;background:#7a1a1a;color:#fff;border-radius:4px;text-decoration:none;letter-spacing:0.1em;font-family:monospace;">OPEN BILLING</a></p>
    <p style="margin-top:24px;font-size:11px;color:#888;">
      <a href="${args.unsubscribeUrl}" style="color:#888;">Unsubscribe from these alerts</a>.
    </p>`;
  const text = `Billing event on ${scopeText}: ${args.eventType} at ${args.occurredAt.toISOString()}.
Open billing: ${args.billingUrl}
Unsubscribe: ${args.unsubscribeUrl}`;
  return send({
    to: args.to,
    subject: `BILLING ALERT · ${args.eventType}`,
    html: wrap("BILLING ALERT", body),
    text,
  });
}

export function sendHighCostRunAlert(args: {
  to: string;
  orgName: string | null;
  actorEmail: string | null;
  engineId: number;
  sessionId: string;
  costUsd: number;
  thresholdUsd: number;
  occurredAt: Date;
  activityUrl: string;
  unsubscribeUrl: string;
}): Promise<EmailResult> {
  const scope = args.orgName ? ` on <strong>${args.orgName}</strong>` : "";
  const scopeText = args.orgName ? ` on ${args.orgName}` : "";
  const actor = args.actorEmail ?? "a member";
  const body = `<p>A high-cost engine run${scope} crossed your alert threshold.</p>
    <p style="font-family:monospace;background:#0d0d0d;padding:12px;border:1px solid #262626;">
      Engine: F${args.engineId}<br/>
      Run by: ${actor}<br/>
      Cost: $${args.costUsd.toFixed(4)} (threshold: $${args.thresholdUsd.toFixed(2)})<br/>
      Session: ${args.sessionId}<br/>
      When: ${args.occurredAt.toISOString()}
    </p>
    <p><a href="${args.activityUrl}" style="color:#1A6B3A;">Open activity log →</a></p>
    <p style="margin-top:24px;font-size:11px;color:#888;">
      <a href="${args.unsubscribeUrl}" style="color:#888;">Unsubscribe from these alerts</a>.
    </p>`;
  const text = `High-cost engine run${scopeText}.
Engine: F${args.engineId}  by ${actor}
Cost: $${args.costUsd.toFixed(4)} (threshold: $${args.thresholdUsd.toFixed(2)})
Session: ${args.sessionId}
When: ${args.occurredAt.toISOString()}
Activity: ${args.activityUrl}
Unsubscribe: ${args.unsubscribeUrl}`;
  return send({
    to: args.to,
    subject: `HIGH-COST RUN · F${args.engineId} · $${args.costUsd.toFixed(2)}`,
    html: wrap("HIGH-COST RUN ALERT", body),
    text,
  });
}

export interface RetainerAlertItem {
  urgency: string;
  alert: string;
  recommendedAction: string;
}

export function sendRetainerMonitoringAlert(args: {
  to: string;
  retainerTitle: string;
  capiPosture: string;
  highestUrgency: string;
  alerts: RetainerAlertItem[];
  weeklyCounsel: string;
  occurredAt: Date;
  dashboardUrl: string;
  unsubscribeUrl: string;
}): Promise<EmailResult> {
  const rows = args.alerts
    .map(
      (a) =>
        `      <strong>[${a.urgency}]</strong> ${a.alert}<br/><span style="color:#888;">→ ${a.recommendedAction}</span>`,
    )
    .join("<br/><br/>");
  const body = `<p>Weekly CAPI monitoring for <strong>${args.retainerTitle}</strong> flagged a breach requiring attention.</p>
    <p style="font-family:monospace;background:#0d0d0d;padding:12px;border:1px solid #262626;">
      CAPI posture: ${args.capiPosture}<br/>
      Highest urgency: ${args.highestUrgency}<br/>
      When: ${args.occurredAt.toISOString()}
    </p>
    <p style="font-family:monospace;background:#0d0d0d;padding:12px;border:1px solid #262626;">
${rows}
    </p>
    <p>${args.weeklyCounsel}</p>
    <p><a href="${args.dashboardUrl}" style="color:#1A6B3A;">Open F0 dashboard →</a></p>
    <p style="margin-top:24px;font-size:11px;color:#888;">
      <a href="${args.unsubscribeUrl}" style="color:#888;">Unsubscribe from these alerts</a>.
    </p>`;
  const text = `Weekly CAPI monitoring for ${args.retainerTitle} flagged a breach.
CAPI posture: ${args.capiPosture}
Highest urgency: ${args.highestUrgency}
When: ${args.occurredAt.toISOString()}

${args.alerts.map((a) => `[${a.urgency}] ${a.alert}\n  -> ${a.recommendedAction}`).join("\n\n")}

${args.weeklyCounsel}

Dashboard: ${args.dashboardUrl}
Unsubscribe: ${args.unsubscribeUrl}`;
  return send({
    to: args.to,
    subject: `RETAINER ALERT · ${args.highestUrgency} · ${args.retainerTitle}`,
    html: wrap("RETAINER MONITORING ALERT", body),
    text,
  });
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
