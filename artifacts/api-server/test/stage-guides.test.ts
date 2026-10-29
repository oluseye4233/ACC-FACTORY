import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, stageGuidesTable as guides } from "@workspace/db";
import { STAGE_GUIDE_CATALOG, defaultStageScript } from "../src/lib/stage-guide-catalog";
import { generateStageGuide, publishStageGuide, saveStageGuide, stageGuideLibrary, syncStageGuide } from "../src/lib/stage-guides";
const http = vi.fn();
let admin: { id: string; role: string };
const member = () => ({ ...admin, role: "USER" });
const script = () => defaultStageScript("F4", "EXPLAINER");
const draft = (stageKey = "F4") => saveStageGuide(admin, { stageKey, kind: "EXPLAINER", script: script() });
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const consent = { test: false, scriptReviewed: true, creditsAccepted: true };
const publication = { contentReviewed: true, publicSharingAccepted: true };
function queueCreated(videoId = randomUUID()) {
  http.mockImplementationOnce(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    return response({ id: videoId, callbackId: body.callbackId, test: body.test, status: "in_progress", visibility: "private" });
  });
  return videoId;
}
async function completed(test = false) {
  const row = await draft(), videoId = queueCreated();
  await generateStageGuide(admin, row.id!, { ...consent, test });
  http.mockResolvedValueOnce(response({ id: videoId, callbackId: row.id, test, status: "complete", visibility: "private" }));
  await syncStageGuide(admin, row.id!, {});
  return { row, videoId };
}
beforeAll(async () => {
  const [user] = await db.insert(usersTable).values({ clerkUserId: `stage-guides-${randomUUID()}`, email: `guides-${randomUUID()}@example.test`, role: "ADMIN" }).returning();
  admin = { id: user!.id, role: "ADMIN" };
});
beforeEach(async () => {
  await db.delete(guides).where(eq(guides.createdByUserId, admin.id));
  vi.stubEnv("SYNTHESIA_API_KEY", "synthetic-only-not-a-real-key");
  vi.stubGlobal("fetch", http);
  http.mockReset().mockRejectedValue(new Error("Unexpected provider call"));
});
afterAll(async () => {
  if (admin) {
    await db.delete(guides).where(eq(guides.createdByUserId, admin.id));
    await db.delete(usersTable).where(eq(usersTable.id, admin.id));
  }
  vi.unstubAllEnvs(); vi.unstubAllGlobals();
});
describe("shared Synthesia stage guides", () => {
  it("provides all 28 truthful transcript-only guides without any provider call", async () => {
    vi.stubEnv("SYNTHESIA_API_KEY", "");
    const library = await stageGuideLibrary(member());
    expect(library.guides).toHaveLength(28);
    expect(library.configured).toBe(false);
    expect(library.history).toEqual([]);
    expect(library.guides.every(g => !g.published && !g.embedUrl && g.title.startsWith("ARK —"))).toBe(true);
    expect(library.guides.some(g => g.stageKey === "F9.5")).toBe(true);
    expect(library.guides.some(g => g.stageKey === "F12")).toBe(true);
    for (const [stage] of STAGE_GUIDE_CATALOG) for (const kind of ["EXPLAINER", "DEMONSTRATION"] as const) {
      const text = defaultStageScript(stage, kind);
      expect(text.length).toBeLessThanOrEqual(1800);
      expect(text.split(/\s+/).length).toBeLessThanOrEqual(200);
    }
    expect(http).not.toHaveBeenCalled();
  });
  it("does not expose unreviewed admin drafts to subscribers", async () => {
    const saved = await saveStageGuide(admin, { stageKey: "F4", kind: "EXPLAINER", script: `${script()} Internal unpublished revision.` });
    const publicView = await stageGuideLibrary(member(), "F4");
    expect(publicView.guides[0]!.script).not.toContain("Internal unpublished");
    expect(publicView.guides[0]!.id).toBeNull();
    expect((await stageGuideLibrary(admin, "F4")).guides[0]!.id).toBe(saved.id);
  });
  it("requires admin role on every mutation", async () => {
    await expect(saveStageGuide(member(), { stageKey: "F4", kind: "EXPLAINER", script: script() })).rejects.toMatchObject({ status: 403 });
    await expect(generateStageGuide(member(), randomUUID(), consent)).rejects.toMatchObject({ status: 403 });
    await expect(syncStageGuide(member(), randomUUID(), {})).rejects.toMatchObject({ status: 403 });
    await expect(publishStageGuide(member(), randomUUID(), publication)).rejects.toMatchObject({ status: 403 });
    expect(http).not.toHaveBeenCalled();
  });
  it("requires configured key, reviewed script and explicit paid-credit acceptance", async () => {
    const row = await draft();
    await expect(generateStageGuide(admin, row.id!, { ...consent, creditsAccepted: false })).rejects.toMatchObject({ status: 400 });
    await expect(generateStageGuide(admin, row.id!, { ...consent, scriptReviewed: false })).rejects.toMatchObject({ status: 400 });
    vi.stubEnv("SYNTHESIA_API_KEY", "");
    await expect(generateStageGuide(admin, row.id!, consent)).rejects.toMatchObject({ status: 503 });
    expect(http).not.toHaveBeenCalled();
  });
  it("creates one private video for concurrent generation clicks, without project inputs", async () => {
    const row = await draft(); queueCreated();
    const results = await Promise.allSettled([generateStageGuide(admin, row.id!, consent), generateStageGuide(admin, row.id!, consent)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(http).toHaveBeenCalledTimes(1);
    const [url, init] = http.mock.calls[0]!;
    expect(url).toBe("https://api.synthesia.io/v2/videos");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ visibility: "private", callbackId: row.id, test: false, input: [{ scriptText: row.script }] });
    expect(body).not.toHaveProperty("sessionId");
    expect(init.headers.Authorization).toBe("synthetic-only-not-a-real-key");
    expect(JSON.stringify(results)).not.toContain("synthetic-only-not-a-real-key");
  });
  it("keeps uncertain submissions durable and blocks redispatch or replacement", async () => {
    const row = await draft();
    http.mockRejectedValueOnce(new Error("Synthetic timeout"));
    expect(await generateStageGuide(admin, row.id!, consent)).toMatchObject({ state: "UNKNOWN" });
    await expect(generateStageGuide(admin, row.id!, consent)).rejects.toMatchObject({ status: 409 });
    await expect(draft()).rejects.toMatchObject({ status: 409 });
    expect(http).toHaveBeenCalledTimes(1);
  });
  it("never charges for a superseded draft revision", async () => {
    const old = await draft();
    const current = await draft();
    expect(current.version).toBe(2);
    await expect(generateStageGuide(admin, old.id!, consent)).rejects.toMatchObject({ status: 409 });
    expect(http).not.toHaveBeenCalled();
  });
  it("treats malformed accepted responses as uncertain, not safe to retry", async () => {
    const row = await draft();
    http.mockResolvedValueOnce(response({ status: "in_progress" }, 201));
    expect(await generateStageGuide(admin, row.id!, consent)).toMatchObject({ state: "UNKNOWN", providerVideoId: null });
  });
  it("records explicit rejection without exposing provider bodies or credentials", async () => {
    const row = await draft();
    http.mockResolvedValueOnce(response({ error: "do-not-echo-provider-detail" }, 403));
    const result = await generateStageGuide(admin, row.id!, consent);
    expect(result.state).toBe("FAILED");
    expect(JSON.stringify(result)).not.toContain("do-not-echo-provider-detail");
    expect((await draft()).version).toBe(2);
  });
  it("recovers UNKNOWN only with the exact provider callback and test mode", async () => {
    const row = await draft();
    await generateStageGuide(admin, row.id!, consent);
    const videoId = randomUUID();
    http.mockResolvedValueOnce(response({ id: videoId, callbackId: randomUUID(), test: false, status: "complete" }));
    await expect(syncStageGuide(admin, row.id!, { providerVideoId: videoId })).rejects.toMatchObject({ status: 409 });
    http.mockResolvedValueOnce(response({ id: videoId, callbackId: row.id, test: true, status: "complete" }));
    await expect(syncStageGuide(admin, row.id!, { providerVideoId: videoId })).rejects.toMatchObject({ status: 409 });
    http.mockResolvedValueOnce(response({ id: videoId, callbackId: row.id, test: false, status: "complete", visibility: "private" }));
    expect(await syncStageGuide(admin, row.id!, { providerVideoId: videoId })).toMatchObject({ state: "COMPLETE", providerVideoId: videoId, embedUrl: null });
  });
  it("does not mistake moderation-pending or rejected videos for publishable completion", async () => {
    const row = await draft(), videoId = queueCreated();
    await generateStageGuide(admin, row.id!, consent);
    http.mockResolvedValueOnce(response({ id: videoId, callbackId: row.id, test: false, status: "in_progress" }));
    expect((await syncStageGuide(admin, row.id!, {})).state).toBe("GENERATING");
    await expect(publishStageGuide(admin, row.id!, publication)).rejects.toMatchObject({ status: 409 });
    http.mockResolvedValueOnce(response({ id: videoId, callbackId: row.id, test: false, status: "rejected" }));
    expect((await syncStageGuide(admin, row.id!, {})).state).toBe("FAILED");
  });
  it("allows test renders but never publishes their watermarked videos", async () => {
    const { row } = await completed(true);
    await expect(publishStageGuide(admin, row.id!, publication)).rejects.toMatchObject({ status: 409 });
    expect((await stageGuideLibrary(member(), "F4")).guides.every(g => g.embedUrl === null)).toBe(true);
  });
  it("publishes only reviewed non-test completion with confirmed public visibility", async () => {
    const { row, videoId } = await completed();
    await expect(publishStageGuide(admin, row.id!, { ...publication, publicSharingAccepted: false })).rejects.toMatchObject({ status: 400 });
    http.mockResolvedValueOnce(response({ id: videoId, callbackId: row.id, test: false, status: "complete", visibility: "private" }));
    http.mockResolvedValueOnce(response({ id: videoId, callbackId: row.id, test: false, status: "complete", visibility: "public" }));
    const published = await publishStageGuide(admin, row.id!, publication);
    expect(published.embedUrl).toBe(`https://share.synthesia.io/embeds/videos/${videoId}`);
    expect(published.published).toBe(true);
    const count = http.mock.calls.length;
    expect((await stageGuideLibrary(member(), "F4")).guides[0]!.id).toBe(row.id);
    expect(http).toHaveBeenCalledTimes(count);
    await draft();
    expect((await stageGuideLibrary(admin, "F4")).guides[0]!.version).toBe(2);
    expect((await stageGuideLibrary(member(), "F4")).guides[0]!.id).toBe(row.id);
  });
  it("does not publish when public visibility is unconfirmed", async () => {
    const { row, videoId } = await completed();
    const data = { id: videoId, callbackId: row.id, test: false, status: "complete", visibility: "private" };
    http.mockResolvedValueOnce(response(data)).mockResolvedValueOnce(response(data));
    await expect(publishStageGuide(admin, row.id!, publication)).rejects.toMatchObject({ status: 503 });
    expect((await stageGuideLibrary(member(), "F4")).guides[0]!.embedUrl).toBeNull();
  });
  it("limits shared renders across administrators and rejects secret-like scripts", async () => {
    for (const stage of ["F1", "F2", "F3", "F4"]) {
      const row = await draft(stage);
      http.mockResolvedValueOnce(response({ error: "Synthetic rejection" }, 400));
      await generateStageGuide(admin, row.id!, consent);
    }
    const next = await draft("F5");
    await expect(generateStageGuide(admin, next.id!, consent)).rejects.toMatchObject({ status: 429 });
    await expect(saveStageGuide(admin, { stageKey: "F4", kind: "EXPLAINER", script: `${script()} password=synthetic-value` })).rejects.toMatchObject({ status: 400 });
    await expect(saveStageGuide(admin, { stageKey: "F99", kind: "EXPLAINER", script: script() })).rejects.toMatchObject({ status: 400 });
  });
});
