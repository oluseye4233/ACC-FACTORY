import { describe, expect, it } from "vitest";
import { buildIcs, icsEscape, isHttpsUrl, isoToLocal, localToIso, tallyDeliveries } from "./convener-model";

const m = { id: "abc", title: "Gate review, F3", agenda: "Bring; notes\nand PDD", startsAt: "2030-01-02T10:00:00.000Z", endsAt: "2030-01-02T11:00:00.000Z", meetingUrl: "https://meet.example.org/x", state: "SCHEDULED", updatedAt: "2030-01-01T00:00:00.000Z" } as const;

describe("convener model", () => {
  it("escapes ICS text", () => { expect(icsEscape("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne"); });
  it("builds ICS with stable UID", () => {
    const a = buildIcs(m); const b = buildIcs({ ...m, title: "Renamed" });
    expect(a).toContain("UID:abc@ffe.atanda"); expect(b).toContain("UID:abc@ffe.atanda");
    expect(a).toContain("DTSTART:20300102T100000Z"); expect(a).toContain("SUMMARY:Gate review\\, F3");
    expect(buildIcs({ ...m, state: "CANCELLED" })).toContain("STATUS:CANCELLED");
  });
  it("round-trips local datetimes", () => { const iso = localToIso("2030-05-06T07:08")!; expect(isoToLocal(iso)).toBe("2030-05-06T07:08"); expect(localToIso("")).toBeNull(); });
  it("accepts https only", () => { expect(isHttpsUrl("https://x.org")).toBe(true); expect(isHttpsUrl("http://x.org")).toBe(false); });
  it("tallies deliveries", () => { expect(tallyDeliveries([{ state: "SENT" }, { state: "FAILED" }, { state: "SENT" }])).toMatchObject({ SENT: 2, FAILED: 1 }); });
  it("escapes bare carriage returns and folds Unicode without corrupting characters", () => {
    expect(icsEscape("review\rATTENDEE:someone")).toBe("review\\nATTENDEE:someone");
    const title = "Review " + "工程".repeat(35);
    const calendar = buildIcs({ ...m, title });
    const encoder = new TextEncoder();
    for (const line of calendar.split("\r\n")) expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    expect(calendar.replace(/\r\n /g, "")).toContain(`SUMMARY:${title}`);
  });
});
