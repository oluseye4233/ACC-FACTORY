import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, usersTable, harnessSessionsTable, harnessArtifactsTable, createdAgentsTable, portalChallengesTable, portalPublicationsTable } from "@workspace/db";
import { unzipSync, strFromU8 } from "fflate";

const mocks = vi.hoisted(() => ({ model: vi.fn(), email: vi.fn(), configured: vi.fn() }));
const objects = new Map<string, Buffer>();
vi.mock("../src/engines/shared", async original => ({
  ...await original<typeof import("../src/engines/shared")>(), callLlmJson: mocks.model,
}));
vi.mock("@workspace/email", () => ({ learningEmailConfigured: mocks.configured, sendPublicationMessage: mocks.email }));
vi.mock("../src/lib/artifact-operations/pdf-font", () => ({ documentPdfFont: async () => "Helvetica" }));
vi.mock("../src/lib/artifact-operations/private-storage", () => ({
  savePrivate: async (key: string, bytes: Buffer) => {
    objects.set(key, Buffer.from(bytes));
    return { key, hash: createHash("sha256").update(bytes).digest("hex"), size: bytes.length };
  },
  readPrivate: async (key: string, hash?: string) => {
    const bytes = objects.get(key);
    if (!bytes || (hash && createHash("sha256").update(bytes).digest("hex") !== hash)) throw new Error("Integrity failure");
    return bytes;
  },
  fileHash: (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex"),
  deletePrivate: vi.fn(),
}));
import { AgentDraftSchema, createAgent, evaluateAgent, runAgent } from "../src/lib/agent-creator";
import { assertGovernance, installGovernance } from "../src/lib/artifact-governance";
import { issuePublicationCode, preparePublication, redeemPublication } from "../src/lib/imprima-portal";
import { publicationZip } from "../src/lib/imprima-portal-render";
import { TARGETS } from "../src/lib/f10-export";

const governance = {
  gro: "SAFE_LIFE" as const,
  zpos: { AEOS: 80, NEXUS: 80, PRISM: 80, QUANTUM: 80, SYNTHESIS: 80 },
  honestyGate: { assumptions: [], limitations: ["Internal model assessment; no independent verification."], unverifiedClaims: [], evidence: [] },
};
const draft = () => AgentDraftSchema.parse({
  ...governance, instructions: "Provide a bounded project checklist as text only. Preserve the supplied specification and disclose uncertainty.",
  cheatSheet: "Accept a project question, then return a scoped checklist and known limitations.",
  jcse: { SYSTEM: 7, ROLE: 7, INSTRUCTION: 8, EXAMPLE: 7, CONSTRAINT: 7, FORMAT: 7, DATA: 7 },
  mathmon: { mathCoherence: 90, applicability: 90, predictiveReliability: 90 },
  evaluationNotes: ["Synthetic test-only assessment, not a provider evaluation."],
});
const users: string[] = [];
let userId: string, sourceId: string, sessionId: string;
beforeAll(() => { vi.stubEnv("SESSION_SECRET", "local-test-publication-key-not-production"); });
beforeEach(async () => {
  mocks.model.mockReset().mockResolvedValue(draft());
  mocks.email.mockReset().mockResolvedValue({ ok: true, id: "synthetic-email-id" });
  mocks.configured.mockReset().mockReturnValue(true);
  const [user] = await db.insert(usersTable).values({ clerkUserId: `agent-portal-${randomUUID()}`, email: `portal-${randomUUID()}@example.test` }).returning();
  userId = user!.id; users.push(userId);
  const [session] = await db.insert(harnessSessionsTable).values({ userId, sessionName: "Portal Regression Project" }).returning();
  sessionId = session!.id;
  const [source] = await db.insert(harnessArtifactsTable).values({
    userId, sessionId, featureId: 5, artifactType: "SPC", name: "Portal Regression Project — SPC",
    artifactContent: installGovernance({ ...governance, sections: [{ title: "Checklist", content: "Produce bounded project checklists." }] }),
  }).returning();
  sourceId = source!.id;
});
afterAll(async () => {
  for (const id of users) {
    await db.delete(createdAgentsTable).where(eq(createdAgentsTable.userId, id));
    await db.delete(usersTable).where(eq(usersTable.id, id));
  }
  objects.clear(); vi.unstubAllEnvs();
});
const prepare = () => preparePublication(userId, { sourceId, sourceType: "ARTIFACT", author: "Synthetic Test Author", rightsConfirmed: true, format: "EDITABLE_ZIP" });
async function issued(publicationId: string) {
  const receipt = await issuePublicationCode(userId, publicationId);
  const text = mocks.email.mock.calls.at(-1)![0].text as string;
  const code = text.match(/\nCode: (\d{6})\n/)?.[1];
  if (!code) throw new Error("Synthetic email did not contain a code");
  return { challengeId: receipt.challengeId, code };
}

describe("governed agent creation/runtime (mocked provider, real development DB)", () => {
  it("saves the SPC Cheat Sheet before model drafting and preserves it unchanged", async () => {
    let savedSheet = "";
    let savedId = "";
    mocks.model.mockImplementationOnce(async (_provider, _system, message) => {
      const input = JSON.parse(message);
      const rows = await db.select().from(harnessArtifactsTable).where(and(
        eq(harnessArtifactsTable.userId, userId), eq(harnessArtifactsTable.artifactType, "AGENT_PACKAGE"),
      ));
      const first = rows.find(row => (row.artifactContent as Record<string, unknown>).preparationPhase === "CHEAT_SHEET_READY");
      expect(first).toBeDefined();
      savedSheet = (first!.artifactContent as { cheatSheet: string }).cheatSheet;
      savedId = first!.id;
      expect(input.savedCheatSheet).toBe(savedSheet);
      const [building] = await db.select().from(createdAgentsTable).where(eq(createdAgentsTable.userId, userId));
      expect(building).toMatchObject({ state: "BUILDING", artifactId: savedId });
      return draft();
    });
    const agent = await createAgent(userId, { sourceArtifactId: sourceId, requestKey: randomUUID() });
    const [result] = await db.select().from(harnessArtifactsTable).where(eq(harnessArtifactsTable.id, agent.artifactId!));
    expect(result!.artifactContent).toMatchObject({ cheatSheet: savedSheet, cheatSheetArtifactId: savedId });
    expect(mocks.model).toHaveBeenCalledOnce();
  });
  it("retains the first-step Cheat Sheet after a later generation failure without redispatch", async () => {
    mocks.model.mockRejectedValueOnce(new Error("Synthetic provider failure"));
    const requestKey = randomUUID();
    await expect(createAgent(userId, { sourceArtifactId: sourceId, requestKey })).rejects.toThrow("Synthetic provider failure");
    const retry = await createAgent(userId, { sourceArtifactId: sourceId, requestKey });
    expect(retry.state).toBe("FAILED");
    expect(retry.cheatSheet).toContain("SPC Cheat Sheet");
    expect(retry.artifactId).toBeTruthy();
    expect(mocks.model).toHaveBeenCalledOnce();
  });
  it("records fresh internal checks and preserves the exact governed package for a real text runtime", async () => {
    const requestKey = randomUUID();
    const agent = await createAgent(userId, { sourceArtifactId: sourceId, requestKey });
    expect(agent.state).toBe("ACTIVE");
    expect(agent.evaluation).toMatchObject({ basis: "INTERNAL_MODEL_ASSESSED", jcse: 50, mathmon: 90, eligible: true });
    const [artifact] = await db.select().from(harnessArtifactsTable).where(eq(harnessArtifactsTable.id, agent.artifactId!));
    expect(() => assertGovernance(artifact!.artifactContent)).not.toThrow();
    expect(artifact!.spartanCert).toBeNull();
    expect(artifact!.forgeVerified).toBe(false);
    await createAgent(userId, { sourceArtifactId: sourceId, requestKey });
    expect(mocks.model).toHaveBeenCalledOnce();
    mocks.model.mockResolvedValue({ answer: "Here is your scoped checklist.", gro: "SAFE_LIFE", disclosure: "Text only; no external actions performed." });
    const runKey = randomUUID();
    const first = await runAgent(userId, agent.id, { input: "Make a checklist.", requestKey: runKey });
    const replay = await runAgent(userId, agent.id, { input: "Make a checklist.", requestKey: runKey });
    expect(first.state).toBe("COMPLETED");
    expect(replay.id).toBe(first.id);
    expect(mocks.model).toHaveBeenCalledTimes(2);
    expect(mocks.model.mock.calls[1]![4]).toMatchObject({ userId, sessionId, engineId: 402 });
  });
  it("does not activate low scores or non-safe GRO", async () => {
    const low = draft(); low.jcse.SYSTEM = 0; low.gro = "GREY";
    expect(evaluateAgent(low).eligible).toBe(false);
    mocks.model.mockResolvedValue(low);
    const agent = await createAgent(userId, { sourceArtifactId: sourceId, requestKey: randomUUID() });
    expect(agent.state).toBe("NEEDS_REWORK");
    await expect(runAgent(userId, agent.id, { input: "Run anyway", requestKey: randomUUID() })).rejects.toMatchObject({ status: 409 });
    expect(mocks.model).toHaveBeenCalledOnce();
  });
  it("rejects foreign ownership and stale source snapshots before executing", async () => {
    const agent = await createAgent(userId, { sourceArtifactId: sourceId, requestKey: randomUUID() });
    await expect(runAgent(randomUUID(), agent.id, { input: "Foreign request", requestKey: randomUUID() })).rejects.toMatchObject({ status: 404 });
    await db.update(harnessArtifactsTable).set({ artifactContent: installGovernance({ ...governance, requirement: "A different requirement" }) }).where(eq(harnessArtifactsTable.id, sourceId));
    await expect(runAgent(userId, agent.id, { input: "Old version", requestKey: randomUUID() })).rejects.toMatchObject({ status: 409 });
    expect(mocks.model).toHaveBeenCalledOnce();
  });
  it("requires an MA's exact Micro PDD and never borrows another artifact's companion", async () => {
    await db.update(harnessArtifactsTable).set({ artifactType: "MA_BIRTH_PACKAGE" }).where(eq(harnessArtifactsTable.id, sourceId));
    await expect(createAgent(userId, { sourceArtifactId: sourceId, requestKey: randomUUID() })).rejects.toMatchObject({ status: 409 });
    expect(mocks.model).not.toHaveBeenCalled();
    const [micro] = await db.insert(harnessArtifactsTable).values({
      userId, sessionId, featureId: 4, artifactType: "MICRO_PDD", name: "Portal Regression Project — Micro PDD",
      artifactContent: installGovernance({ ...governance, sourceArtifactId: sourceId, requirements: ["Preserve the MA scope."] }),
    }).returning();
    const agent = await createAgent(userId, { sourceArtifactId: sourceId, microPddArtifactId: micro!.id, requestKey: randomUUID() });
    expect(agent).toMatchObject({ state: "ACTIVE", kind: "MA", companionArtifactId: micro!.id });
  });
});
describe("IMPRIMA protected publication (mocked email/storage, real development DB)", () => {
  it("retains the selected native F10 target package unchanged inside the publication ZIP", async () => {
    const publication = await preparePublication(userId, { sourceId, sourceType: "F10_EXPORT", format: "EDITABLE_ZIP",
      author: "Synthetic Test Author", rightsConfirmed: true,
      exportOptions: { outputKind: "SPC", family: "IDE", target: TARGETS.IDE[0], deliveryMode: "EXPORT" } });
    const [row] = await db.select().from(portalPublicationsTable).where(eq(portalPublicationsTable.id, publication.id));
    const outer = unzipSync(objects.get(row!.storageKey!)!);
    const native = outer["original/file-target-export.zip"];
    expect(native).toBeTruthy();
    const files = unzipSync(native!);
    expect(Object.keys(files).some(name => name.endsWith("manifest.json"))).toBe(true);
    expect(strFromU8(outer["artifact.json"]!)).toContain(TARGETS.IDE[0]);
  });
  it("issues a profile-bound single-use code and sends the exact frozen bytes to control before returning them", async () => {
    const publication = await prepare();
    const grant = await issued(publication.id);
    const results = await Promise.allSettled([redeemPublication(userId, publication.id, grant), redeemPublication(userId, publication.id, grant)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const success = results.find(result => result.status === "fulfilled");
    if (!success || success.status !== "fulfilled") throw new Error("Missing successful redemption");
    const copy = mocks.email.mock.calls.find(([args]) => args.attachment)?.[0];
    expect(copy.attachment.bytes.equals(success.value.bytes)).toBe(true);
    const zip = unzipSync(success.value.bytes);
    expect(Buffer.from(zip["ATANDA.IMPRIMA-publication.pdf"]!).subarray(0, 4).toString()).toBe("%PDF");
    const metadata = JSON.parse(strFromU8(zip["publication.json"]!));
    expect(metadata.author).toBe("Synthetic Test Author");
    expect(metadata.publisher).toBe("ATANDA");
    expect(metadata.publishedAt).toBeTruthy();
    expect(mocks.email).toHaveBeenCalledTimes(2);
    const [challenge] = await db.select().from(portalChallengesTable).where(eq(portalChallengesTable.id, grant.challengeId));
    expect(challenge!.state).toBe("CONSUMED");
    expect(challenge!.codeHash).not.toBe(grant.code);
  });
  it("sends an owner-requested test copy without replacing the control recipient or profile email", async () => {
    const publication = await prepare(), grant = await issued(publication.id);
    const output = await redeemPublication(userId, publication.id, { ...grant, testCopyEmail: "test-recipient@example.test" });
    const attachments = mocks.email.mock.calls.map(([args]) => args).filter(args => args.attachment);
    expect(attachments).toHaveLength(2);
    expect(attachments[0].to).toBe(process.env.IMPRIMA_CONTROL_EMAIL ?? "atanda.projects@gmail.com");
    expect(attachments[1].to).toBe("test-recipient@example.test");
    expect(attachments.every(args => args.attachment.bytes.equals(output.bytes))).toBe(true);
    await expect(redeemPublication(userId, publication.id, { ...grant, testCopyEmail: "another@example.test" })).rejects.toMatchObject({ status: 403 });
    expect(mocks.email).toHaveBeenCalledTimes(3);
  });
  it("rejects invalid copy recipients and foreign owners before sending", async () => {
    const publication = await prepare(), grant = await issued(publication.id);
    await expect(redeemPublication(userId, publication.id, { ...grant, testCopyEmail: "a@example.test\r\nBcc: other@example.test" })).rejects.toMatchObject({ status: 400 });
    await expect(redeemPublication(randomUUID(), publication.id, { ...grant, testCopyEmail: "test@example.test" })).rejects.toMatchObject({ status: 404 });
    expect(mocks.email).toHaveBeenCalledOnce();
  });
  it("fails closed when the requested test-copy provider rejects delivery", async () => {
    const publication = await prepare(), grant = await issued(publication.id);
    mocks.email.mockResolvedValueOnce({ ok: true, id: "control" }).mockResolvedValueOnce({ ok: false });
    await expect(redeemPublication(userId, publication.id, { ...grant, testCopyEmail: "test@example.test" })).rejects.toMatchObject({ status: 503 });
    await expect(redeemPublication(userId, publication.id, grant)).rejects.toMatchObject({ status: 403 });
  });
  it("locks after five wrong attempts and never sends a control copy", async () => {
    const publication = await prepare(), grant = await issued(publication.id);
    const wrong = grant.code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await expect(redeemPublication(userId, publication.id, { ...grant, code: wrong })).rejects.toMatchObject({ status: 403 });
    await expect(redeemPublication(userId, publication.id, grant)).rejects.toMatchObject({ status: 403 });
    const [challenge] = await db.select().from(portalChallengesTable).where(eq(portalChallengesTable.id, grant.challengeId));
    expect(challenge!.state).toBe("LOCKED");
    expect(challenge!.attempts).toBe(5);
    expect(mocks.email).toHaveBeenCalledOnce();
  });
  it("supersedes an earlier pending email even when its provider response arrives late", async () => {
    const publication = await prepare();
    let release!: (result: { ok: true; id: string }) => void;
    let started!: () => void;
    const began = new Promise<void>(resolve => { started = resolve; });
    mocks.email.mockImplementationOnce(() => new Promise(resolve => { release = resolve; started(); }));
    const first = issuePublicationCode(userId, publication.id).catch(error => error);
    await began;
    const second = await issued(publication.id);
    release({ ok: true, id: "late-synthetic-email" });
    expect(await first).toMatchObject({ status: 409 });
    const rows = await db.select().from(portalChallengesTable).where(and(
      eq(portalChallengesTable.userId, userId), eq(portalChallengesTable.publicationId, publication.id)));
    expect(rows.filter(row => row.state === "ISSUED")).toHaveLength(1);
    expect(rows.filter(row => row.state === "SUPERSEDED")).toHaveLength(1);
    await expect(redeemPublication(userId, publication.id, second)).resolves.toHaveProperty("bytes");
  });
  it("rejects foreign and expired grants without exposing bytes", async () => {
    const publication = await prepare(), grant = await issued(publication.id);
    await expect(redeemPublication(randomUUID(), publication.id, grant)).rejects.toMatchObject({ status: 404 });
    await db.update(portalChallengesTable).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(portalChallengesTable.id, grant.challengeId));
    await expect(redeemPublication(userId, publication.id, grant)).rejects.toMatchObject({ status: 403 });
    expect(mocks.email).toHaveBeenCalledOnce();
  });
  it("does not authorize a download when the control copy fails or email is unconfigured", async () => {
    const publication = await prepare(), grant = await issued(publication.id);
    mocks.email.mockResolvedValueOnce({ ok: false, error: "Synthetic provider refusal" });
    await expect(redeemPublication(userId, publication.id, grant)).rejects.toMatchObject({ status: 503 });
    await expect(redeemPublication(userId, publication.id, grant)).rejects.toMatchObject({ status: 403 });
    mocks.configured.mockReturnValue(false);
    await expect(issuePublicationCode(userId, publication.id)).rejects.toMatchObject({ status: 503 });
  });
  it("requires rights confirmation and refuses ZIP traversal while preserving editable bytes", async () => {
    await expect(preparePublication(userId, { sourceId, sourceType: "ARTIFACT", format: "PDF", author: "Test", rightsConfirmed: false })).rejects.toMatchObject({ status: 400 });
    const doc = { id: randomUUID(), title: "Project", author: "Test", subscriberStamp: "synthetic", createdAt: new Date(),
      sourceHash: "synthetic", sourceType: "ARTIFACT", content: { files: [{ path: "../escape", content: "bad" }] } };
    expect(() => publicationZip(doc, Buffer.from("test PDF"))).toThrow("Unsafe code path");
    doc.content.files = [{ path: "src/main.ts", content: "export const original = true;\n" }];
    const zip = unzipSync(publicationZip(doc, Buffer.from("test PDF")));
    expect(strFromU8(zip["editable-code/src/main.ts"]!)).toBe("export const original = true;\n");
  });
});
