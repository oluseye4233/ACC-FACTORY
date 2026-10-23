import type { CohortMeeting } from "@workspace/api-client-react";

export const lab = "font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground";

/** datetime-local value ("YYYY-MM-DDTHH:mm") -> ISO string, or null when blank/invalid. */
export function localToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO -> datetime-local value in the viewer's zone. */
export function isoToLocal(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function isHttpsUrl(v: string): boolean {
  try { return new URL(v).protocol === "https:"; } catch { return false; }
}

export function fmtWhen(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
}

function icsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function fold(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let part = "", bytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 74) {
      parts.push(part);
      part = " ";
      bytes = 1;
    }
    part += character;
    bytes += size;
  }
  parts.push(part);
  return parts.join("\r\n");
}

/** Stable UID per meeting id so re-downloads update the same calendar entry. */
export function buildIcs(m: Pick<CohortMeeting, "id" | "title" | "agenda" | "startsAt" | "endsAt" | "meetingUrl" | "state" | "updatedAt">, cohortTitle?: string): string {
  const desc = [m.agenda, m.meetingUrl ? `Join: ${m.meetingUrl}` : ""].filter(Boolean).join("\n\n");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ATANDA//FORGE Field Engineer//EN", "CALSCALE:GREGORIAN",
    `METHOD:${m.state === "CANCELLED" ? "CANCEL" : "PUBLISH"}`,
    "BEGIN:VEVENT",
    `UID:${m.id}@ffe.atanda`,
    `DTSTAMP:${icsDate(m.updatedAt)}`,
    `DTSTART:${icsDate(m.startsAt)}`,
    `DTEND:${icsDate(m.endsAt)}`,
    `SUMMARY:${icsEscape(cohortTitle ? `${m.title} · ${cohortTitle}` : m.title)}`,
    `DESCRIPTION:${icsEscape(desc)}`,
    ...(m.meetingUrl ? [`URL:${icsEscape(m.meetingUrl)}`, `LOCATION:${icsEscape(m.meetingUrl)}`] : []),
    `STATUS:${m.state === "CANCELLED" ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT", "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function downloadText(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadIcs(m: Parameters<typeof buildIcs>[0], cohortTitle?: string) {
  const slug = m.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "meeting";
  downloadText(`${slug}.ics`, buildIcs(m, cohortTitle), "text/calendar;charset=utf-8");
}

export function slugFile(title: string, ext: string) {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50) || "resource"}.${ext}`;
}

export type DeliveryState = "PENDING" | "SENDING" | "SENT" | "FAILED";
export const DELIVERY_COPY: Record<DeliveryState, { label: string; cls: string }> = {
  PENDING: { label: "Pending", cls: "border-muted-foreground/40 text-muted-foreground" },
  SENDING: { label: "Sending · outcome uncertain", cls: "border-secondary text-secondary-foreground bg-secondary/20" },
  SENT: { label: "Accepted by provider", cls: "border-primary/60 text-primary bg-primary/10" },
  FAILED: { label: "Failed", cls: "border-destructive/60 text-destructive bg-destructive/10" },
};

export function tallyDeliveries(ds: { state: string }[]) {
  const t: Record<DeliveryState, number> = { PENDING: 0, SENDING: 0, SENT: 0, FAILED: 0 };
  for (const d of ds) if (d.state in t) t[d.state as DeliveryState]++;
  return t;
}

export function audienceLabel(ids: string[], names: Map<string, string>): string {
  if (ids.length === 0) return "All active trainees";
  const n = ids.map((i) => names.get(i) ?? i.slice(0, 8));
  return n.length <= 3 ? n.join(", ") : `${n.slice(0, 3).join(", ")} +${n.length - 3}`;
}

export function newRequestId(): string {
  return crypto.randomUUID();
}

export const STALE = 30_000;
