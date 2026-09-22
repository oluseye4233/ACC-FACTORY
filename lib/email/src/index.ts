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

/**
 * HTML-escape a dynamic value before interpolating it into an email body.
 * Every user-controlled or LLM-generated string (session names, org names,
 * reasons, alert text, URLs placed in attributes) must pass through this —
 * raw interpolation lets a crafted name inject markup into recipients'
 * inboxes. Escapes quotes too, so it is safe inside href="..." attributes.
 */
const esc = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

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
  const body = `<p>Your session <strong>${esc(args.sessionName)}</strong> has been compressed and certified.</p>
    <p style="font-family:monospace;background:#0d0d0d;padding:12px;border:1px solid #262626;">
      Cert ID: ${esc(args.certId)}<br/>Class: ${esc(args.certClass)}
    </p>
    <p><a href="${esc(args.verifyUrl)}" style="color:#1A6B3A;">Verify certificate →</a></p>`;
  const text = `MVP PDD certified.\nSession: ${args.sessionName}\nCert: ${args.certId} (${args.certClass})\nVerify: ${args.verifyUrl}`;
  return send({ to: args.to, subject: `MVP PDD CERTIFIED · ${args.certId}`, html: wrap("MVP PDD CERTIFIED", body), text });
}

export function sendEscalationGranted(args: {
  to: string;
  engine: string;
  sessionName: string;
}): Promise<EmailResult> {
  const body = `<p>An escalation has been granted on session <strong>${esc(args.sessionName)}</strong> for engine <strong>${esc(args.engine)}</strong>.</p>
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
  const body = `<p>Payment received for tier <strong>${esc(args.tier)}</strong>.</p>
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
  const body = `<p>An administrator has revoked your <strong>${esc(args.badgeName)}</strong> badge${repeat}.</p>
    <p style="font-family:monospace;background:#0d0d0d;padding:12px;border:1px solid #262626;white-space:pre-wrap;">${esc(args.reason)}</p>
    <p>If you believe this was a mistake or you want to appeal, you can re-submit fresh evidence
    on your Quest Badges page. A successful re-submission immediately restores the badge.</p>
    <p><a href="${esc(args.appealUrl)}" style="color:#1A6B3A;">Re-submit evidence →</a></p>`;
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
  const noteBlock = args.note
    ? `<p>Note from the administrator:</p>
    <p style="font-family:monospace;background:#0d0d0d;padding:12px;border:1px solid #262626;white-space:pre-wrap;">${esc(args.note)}</p>`
    : "";
  const body = `<p>Good news — an administrator has <strong>restored</strong> your <strong>${esc(args.badgeName)}</strong> badge.</p>
    <p>The earlier revocation has been cleared and the badge is once again marked as CLAIMED on your profile.
    The original revocation record is preserved in the audit trail.</p>
    ${noteBlock}
    <p><a href="${esc(args.badgesUrl)}" style="color:#1A6B3A;">View your badges →</a></p>`;
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
  const body = `<p>Your <strong>${esc(args.tier)}</strong> subscription has been cancelled.</p>
  <p>Access continues until: <strong>${period}</strong>.</p>`;
  const text = `Subscription cancelled · ${args.tier} · access until ${period}`;
  return send({ to: args.to, subject: `SUBSCRIPTION CANCELLED · ${args.tier}`, html: wrap("SUBSCRIPTION CANCELLED", body), text });
}

export function sendPaymentFailed(args: {
  to: string;
  tier: string;
}): Promise<EmailResult> {
  const body = `<p>A payment for your <strong>${esc(args.tier)}</strong> subscription failed.</p>
    <p>Please update your billing details to avoid service interruption.</p>`;
  const text = `Payment failed for ${args.tier}. Update billing to avoid interruption.`;
  return send({ to: args.to, subject: `PAYMENT FAILED · action required`, html: wrap("PAYMENT FAILED", body), text });
}

export function sendWelcome(args: {
  to: string;
  displayName: string | null;
}): Promise<EmailResult> {
  const name = args.displayName?.trim() || "Operator";
  const body = `<p>Welcome to ATANDA Command Centre, <strong>${esc(name)}</strong>.</p>
    <p>You now have access to the FORGE.BONSAI HARNESS — eight atomic-prompt engines that walk a raw idea
    through prompt → SPC → PDD → certified MVP-PDD.</p>
    <p>Your first session is one click away from the Command dashboard.</p>`;
  const text = `Welcome to ATANDA Command Centre, ${name}. Start your first FORGE.BONSAI session from the Command dashboard.`;
  return send({ to: args.to, subject: `WELCOME · ATANDA COMMAND CENTRE`, html: wrap("WELCOME, OPERATOR", body), text });
}

export function sendF10ReconciliationPaused(args: {
  to: string;
  provider: string;
  target: string;
  reason: string;
  reconnectUrl: string;
}): Promise<EmailResult> {
  const body = `<p>Automatic deployment status checks have paused for <strong>${esc(args.provider)}</strong>.</p>
    <p style="font-family:monospace;background:#0d0d0d;padding:12px;border:1px solid #262626;">
      Target: ${esc(args.target)}<br/>Reason: ${esc(args.reason)}
    </p>
    <p>Reconnect the provider account in F10 to resume automatic status checks. The accepted delivery receipt has not changed.</p>
    <p><a href="${esc(args.reconnectUrl)}" style="color:#1A6B3A;">Reconnect ${esc(args.provider)} →</a></p>`;
  const text = `F10 deployment status checks paused.\nProvider: ${args.provider}\nTarget: ${args.target}\nReason: ${args.reason}\nReconnect the provider account to resume checks: ${args.reconnectUrl}\nThe accepted delivery receipt has not changed.`;
  return send({
    to: args.to,
    subject: `F10 CHECKS PAUSED · reconnect ${args.provider}`,
    html: wrap("F10 STATUS CHECKS PAUSED", body),
    text,
  });
}

export function sendOrgInvite(args: {
  to: string;
  orgName: string;
  acceptUrl: string;
  inviterEmail: string | null;
}): Promise<EmailResult> {
  const fromHtml = args.inviterEmail ? ` (invited by ${esc(args.inviterEmail)})` : "";
  const fromText = args.inviterEmail ? ` (invited by ${args.inviterEmail})` : "";
  const body = `<p>You've been invited to join <strong>${esc(args.orgName)}</strong> on ATANDA Command Centre${fromHtml}.</p>
    <p>Click below to accept. The invite expires in 14 days.</p>
    <p><a href="${esc(args.acceptUrl)}" style="display:inline-block;padding:12px 24px;background:#1A6B3A;color:#fff;border-radius:4px;text-decoration:none;letter-spacing:0.1em;font-family:monospace;">ACCEPT INVITE</a></p>
    <p style="font-size:11px;color:#888;">Or paste this URL into your browser:<br/>${esc(args.acceptUrl)}</p>`;
  const text = `You've been invited to join ${args.orgName} on ATANDA Command Centre${fromText}. Accept: ${args.acceptUrl}`;
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
                <td style="padding:4px 8px;border-bottom:1px solid #262626;">${esc(r.label)}</td>
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
          .map((e) => `<li>${fmt(e.ts)} · ${esc(e.type)}</li>`)
          .join("")}</ul>`;
  const billingText =
    args.billingEvents.length === 0
      ? "  (none)"
      : args.billingEvents.map((e) => `  ${fmt(e.ts)} · ${e.type}`).join("\n");
  const body = `<p>Weekly activity digest for <strong>${esc(args.orgName)}</strong>
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
    <p style="margin-top:32px;"><a href="${esc(args.activityUrl)}" style="color:#1A6B3A;">Open full activity log →</a></p>
    <p style="margin-top:24px;font-size:11px;color:#888;">
      You're receiving this because you are an owner/admin of ${esc(args.orgName)}.
      <a href="${esc(args.unsubscribeUrl)}" style="color:#888;">Unsubscribe</a>.
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
  const scope = args.orgName ? `team subscription for <strong>${esc(args.orgName)}</strong>` : `your subscription`;
  const scopeText = args.orgName ? `team subscription for ${args.orgName}` : "your subscription";
  const body = `<p>A billing event on ${scope} needs your attention:
    <strong>${esc(args.eventType)}</strong> at ${args.occurredAt.toISOString()}.</p>
    <p>Update billing details to avoid service interruption.</p>
    <p><a href="${esc(args.billingUrl)}" style="display:inline-block;padding:12px 24px;background:#7a1a1a;color:#fff;border-radius:4px;text-decoration:none;letter-spacing:0.1em;font-family:monospace;">OPEN BILLING</a></p>
    <p style="margin-top:24px;font-size:11px;color:#888;">
      <a href="${esc(args.unsubscribeUrl)}" style="color:#888;">Unsubscribe from these alerts</a>.
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
  const scope = args.orgName ? ` on <strong>${esc(args.orgName)}</strong>` : "";
  const scopeText = args.orgName ? ` on ${args.orgName}` : "";
  const actor = args.actorEmail ?? "a member";
  const body = `<p>A high-cost engine run${scope} crossed your alert threshold.</p>
    <p style="font-family:monospace;background:#0d0d0d;padding:12px;border:1px solid #262626;">
      Engine: F${args.engineId}<br/>
      Run by: ${esc(actor)}<br/>
      Cost: $${args.costUsd.toFixed(4)} (threshold: $${args.thresholdUsd.toFixed(2)})<br/>
      Session: ${esc(args.sessionId)}<br/>
      When: ${args.occurredAt.toISOString()}
    </p>
    <p><a href="${esc(args.activityUrl)}" style="color:#1A6B3A;">Open activity log →</a></p>
    <p style="margin-top:24px;font-size:11px;color:#888;">
      <a href="${esc(args.unsubscribeUrl)}" style="color:#888;">Unsubscribe from these alerts</a>.
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
        `      <strong>[${esc(a.urgency)}]</strong> ${esc(a.alert)}<br/><span style="color:#888;">→ ${esc(a.recommendedAction)}</span>`,
    )
    .join("<br/><br/>");
  const body = `<p>Weekly CAPI monitoring for <strong>${esc(args.retainerTitle)}</strong> flagged a breach requiring attention.</p>
    <p style="font-family:monospace;background:#0d0d0d;padding:12px;border:1px solid #262626;">
      CAPI posture: ${esc(args.capiPosture)}<br/>
      Highest urgency: ${esc(args.highestUrgency)}<br/>
      When: ${args.occurredAt.toISOString()}
    </p>
    <p style="font-family:monospace;background:#0d0d0d;padding:12px;border:1px solid #262626;">
${rows}
    </p>
    <p>${esc(args.weeklyCounsel)}</p>
    <p><a href="${esc(args.dashboardUrl)}" style="color:#1A6B3A;">Open F0 dashboard →</a></p>
    <p style="margin-top:24px;font-size:11px;color:#888;">
      <a href="${esc(args.unsubscribeUrl)}" style="color:#888;">Unsubscribe from these alerts</a>.
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

/**
 * Company-wide LLM spend threshold alert, sent to each ADMIN_EMAILS address
 * the first time monthly spend crosses 80% / 95% / 100% of
 * STAFF_MONTHLY_COST_CAP_USD (exactly once per threshold per UTC month).
 */
export function sendCostCapThresholdAlert(args: {
  to: string;
  thresholdPercent: number;
  usedUsd: number;
  capUsd: number;
  percentUsed: number;
  resetsAt: Date;
}): Promise<EmailResult> {
  const atCap = args.thresholdPercent >= 100;
  const resetDay = args.resetsAt.toISOString().slice(0, 10);
  const headline = atCap
    ? "The company-wide monthly LLM spend cap has been <strong>reached</strong>. Engine routes are now refusing new runs with 402 COST_CAP_EXCEEDED."
    : `Company-wide monthly LLM spend has crossed <strong>${args.thresholdPercent}%</strong> of the monthly cap.`;
  const body = `<p>${headline}</p>
    <p style="font-family:monospace;background:#0d0d0d;padding:12px;border:1px solid #262626;">
      Used: $${args.usedUsd.toFixed(2)}<br/>
      Cap: $${args.capUsd.toFixed(2)}<br/>
      Percent used: ${args.percentUsed.toFixed(1)}%
    </p>
    <p>The counter resets at the start of the next UTC month: <strong>${resetDay} 00:00 UTC</strong>.</p>
    <p>To raise the ceiling sooner, update the <span style="font-family:monospace;">STAFF_MONTHLY_COST_CAP_USD</span> environment variable, or pace usage until the reset.</p>`;
  const text = `${
    atCap
      ? "The company-wide monthly LLM spend cap has been REACHED. Engine routes are refusing new runs (402 COST_CAP_EXCEEDED)."
      : `Company-wide monthly LLM spend has crossed ${args.thresholdPercent}% of the monthly cap.`
  }
Used: $${args.usedUsd.toFixed(2)}
Cap: $${args.capUsd.toFixed(2)}
Percent used: ${args.percentUsed.toFixed(1)}%
Resets: ${resetDay} 00:00 UTC (start of next UTC month)
Raise STAFF_MONTHLY_COST_CAP_USD to lift the ceiling sooner.`;
  const subject = atCap
    ? `LLM SPEND CAP REACHED · $${args.usedUsd.toFixed(2)} / $${args.capUsd.toFixed(2)}`
    : `LLM SPEND ALERT · ${args.thresholdPercent}% OF MONTHLY CAP`;
  return send({
    to: args.to,
    subject,
    html: wrap(atCap ? "LLM SPEND CAP REACHED" : "LLM SPEND ALERT", body),
    text,
  });
}

export function sendCronTargetStaleAlert(args: {
  to: string;
  target: string;
  label: string;
  schedule: string;
  lastTickAt: Date | null;
  staleAfterMinutes: number;
  overdueMinutes: number;
}): Promise<EmailResult> {
  const lastTickLine = args.lastTickAt
    ? `${args.lastTickAt.toISOString().replace("T", " ").slice(0, 16)} UTC`
    : "NEVER (no tick recorded since this monitor started)";
  const body = `<p>The Scheduled-Deployment cron tick for <strong>${esc(args.label)}</strong> (<span style="font-family:monospace;">${esc(args.target)}</span>) has <strong>stopped arriving</strong>. The safety net this schedule provides is currently degraded.</p>
    <p style="font-family:monospace;background:#0d0d0d;padding:12px;border:1px solid #262626;">
      Expected: ${esc(args.schedule)}<br/>
      Last tick: ${lastTickLine}<br/>
      Overdue by: ~${args.overdueMinutes} min beyond the ${args.staleAfterMinutes}-min stale window
    </p>
    <p>Likely causes: the Scheduled Deployment was never created (or was deleted), <span style="font-family:monospace;">CRON_SECRET</span> / <span style="font-family:monospace;">PUBLIC_BASE_URL</span> drifted, or the deployment was re-published with Private visibility (Replit's auth wall 307-blocks external cron ticks — it must be Public).</p>
    <p>Check the Scheduled Deployment's logs, then verify a manual run of <span style="font-family:monospace;">cron-tick -- ${esc(args.target)}</span> succeeds. This email is sent once per outage; a new alert only fires if the schedule recovers and dies again.</p>`;
  const text = `Cron schedule stale: ${args.label} (${args.target})
Expected: ${args.schedule}
Last tick: ${lastTickLine}
Overdue by ~${args.overdueMinutes} min beyond the ${args.staleAfterMinutes}-min stale window.
Likely causes: Scheduled Deployment missing/deleted, CRON_SECRET or PUBLIC_BASE_URL drift, or deployment re-published Private (auth wall blocks cron ticks).
Verify with: cron-tick -- ${args.target}. One email per outage.`;
  return send({
    to: args.to,
    subject: `CRON SCHEDULE STALE · ${args.target}`,
    html: wrap("CRON SCHEDULE STALE", body),
    text,
  });
}

export function sendCronTargetRecoveredAlert(args: {
  to: string;
  target: string;
  label: string;
  schedule: string;
  /** First successful tick after the outage. */
  recoveredAt: Date;
  /** Reference point the (latest) stale episode was anchored to. */
  staleSince: Date | null;
}): Promise<EmailResult> {
  const fmt = (d: Date) => `${d.toISOString().replace("T", " ").slice(0, 16)} UTC`;
  const staleSinceLine = args.staleSince ? fmt(args.staleSince) : "unknown";
  const body = `<p>The Scheduled-Deployment cron tick for <strong>${args.label}</strong> (<span style="font-family:monospace;">${args.target}</span>) is <strong>ticking again</strong>. The safety net this schedule provides is restored.</p>
    <p style="font-family:monospace;background:#0d0d0d;padding:12px;border:1px solid #262626;">
      Schedule: ${args.schedule}<br/>
      Outage anchored at: ${staleSinceLine}<br/>
      First tick after outage: ${fmt(args.recoveredAt)}
    </p>
    <p>No action needed. This all-clear is sent once per outage; if the schedule stalls again a new stale alert will fire.</p>`;
  const text = `Cron schedule recovered: ${args.label} (${args.target})
Schedule: ${args.schedule}
Outage anchored at: ${staleSinceLine}
First tick after outage: ${fmt(args.recoveredAt)}
No action needed. One all-clear per outage; a new stall fires a new stale alert.`;
  return send({
    to: args.to,
    subject: `CRON SCHEDULE RECOVERED · ${args.target}`,
    html: wrap("CRON SCHEDULE RECOVERED", body),
    text,
  });
}

/**
 * Flaky (degraded, not dead) cron schedule alert: the target is still
 * ticking, but its trailing-24h tick count fell materially below expected
 * for two consecutive monitor checks. Sent exactly once per flaky episode.
 */
export function sendCronTargetFlakyAlert(args: {
  to: string;
  target: string;
  label: string;
  schedule: string;
  expectedTicks: number;
  observedTicks: number;
  lastTickAt: Date | null;
}): Promise<EmailResult> {
  const pct =
    args.expectedTicks > 0
      ? Math.round((args.observedTicks / args.expectedTicks) * 100)
      : 0;
  const lastTickLine = args.lastTickAt
    ? `${args.lastTickAt.toISOString().replace("T", " ").slice(0, 16)} UTC`
    : "NEVER (no tick recorded since this monitor started)";
  const body = `<p>The Scheduled-Deployment cron tick for <strong>${esc(args.label)}</strong> (<span style="font-family:monospace;">${esc(args.target)}</span>) has turned <strong>flaky</strong>: it is still ticking, but well below its expected rate. Left alone, this kind of degradation usually becomes a full outage.</p>
    <p style="font-family:monospace;background:#0d0d0d;padding:12px;border:1px solid #262626;">
      Expected: ${esc(args.schedule)}<br/>
      Ticks in last 24h: ${args.observedTicks} of ${args.expectedTicks} expected (${pct}%)<br/>
      Last tick: ${lastTickLine}
    </p>
    <p>Likely causes: intermittent failures in the Scheduled Deployment's runs (check its logs for errors/timeouts), the deployment host being flaky, or the target's handler intermittently failing so the tick never records.</p>
    <p>Verify a manual run of <span style="font-family:monospace;">cron-tick -- ${esc(args.target)}</span> succeeds and check the Ops Health page for the per-tick history. This email is sent once per flaky episode; a new alert only fires if the schedule recovers and degrades again.</p>`;
  const text = `Cron schedule flaky: ${args.label} (${args.target})
Expected: ${args.schedule}
Ticks in last 24h: ${args.observedTicks} of ${args.expectedTicks} expected (${pct}%)
Last tick: ${lastTickLine}
Likely causes: intermittent Scheduled Deployment failures (check its logs), flaky host, or the handler intermittently failing.
Verify with: cron-tick -- ${args.target}. One email per flaky episode.`;
  return send({
    to: args.to,
    subject: `CRON SCHEDULE FLAKY · ${args.target}`,
    html: wrap("CRON SCHEDULE FLAKY", body),
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
