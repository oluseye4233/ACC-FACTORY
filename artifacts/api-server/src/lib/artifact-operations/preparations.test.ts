import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { unzipSync } from "fflate";
import { db, usersTable, harnessSessionsTable, harnessArtifactsTable, shortSprintRunsTable, imprimaJobsTable, harnessFeatureStateTable } from "@workspace/db";
import { createPreparation, preparationDownload, preparationWorkspace } from "./preparations";
import { fileHash } from "./private-storage";
import { withOperationsActor, type OperationsActor } from "./context";

const memory = vi.hoisted(() => new Map<string, Buffer>());
// Simulate the actual production blocker WITHOUT altering shared dev security.
vi.mock("./database-protection", () => ({ databaseProtection: async () => ({ ready: false, checks: [{ id: "restricted_role", ready: false }] }) }));
vi.mock("./private-storage", async original => {
  const actual = await original<typeof import("./private-storage")>();
  return { ...actual,
    savePrivate: async (key: string, value: Buffer | string) => {
      if (memory.has(key)) throw Error("immutable fixture");
      const bytes = Buffer.from(value); memory.set(key, bytes);
      return { key, size: bytes.length, hash: actual.fileHash(bytes) };
    },
    readPrivate: async (key: string, expected?: string) => {
      const bytes = memory.get(key);
      if (!bytes) throw Error("missing fixture");
      if (expected && actual.fileHash(bytes) !== expected) throw Error("integrity failed");
      return bytes;
    },
  };
});
describe("SPARTAN preparation: separate owner-scoped lane, not SQL-guard fallback", () => {
  let owner: OperationsActor, other: OperationsActor, sessionId: string, spcId: string, microId: string, sensitiveId: string;
  const opts = { title: "Private draft", project: "Spartan", formats: ["HTML", "DOCX", "PDF"], mode: "DRAFT", authorIsHuman: true };
  const manifest = { name: "Prepared agent", mission: "Handle a demonstration", systemPrompt: "Return the requested demonstration result.",
    inputContract: { type: "object", properties: { zebra: { type: "string" }, a: { type: "number" } } }, outputContract: { type: "object" },
    tools: [], constraints: ["No deployment"], groRules: "Decline unsafe work", failClosedRules: "Refuse invalid inputs",
    deployment: "Not deployed", model: "not selected", provider: "not selected", dataHandling: "Private only",
    monitoring: "Not connected", version: "1", promotionNotes: "Not promoted" };
  beforeAll(async () => {
    const people = await db.insert(usersTable).values([0, 1].map(i => ({ clerkUserId: `spartan-prep-${i}-${randomUUID()}`, displayName: `Fixture Publisher ${i}` }))).returning();
    [owner, other] = people.map(p => ({ id: p.id, role: p.role, displayName: p.displayName }));
    const [s] = await db.insert(harnessSessionsTable).values({ userId: owner.id, sessionName: "SPARTAN private preparation fixture" }).returning();
    sessionId = s!.id;
    const [birth] = await db.insert(harnessArtifactsTable).values({ userId: owner.id, sessionId, featureId: 3, artifactType: "MA_BIRTH_PACKAGE",
      artifactContent: { mission: "Demonstration", contracts: { z: "last", a: "first" } } }).returning();
    const sourceRows = await db.insert(harnessArtifactsTable).values([
      { userId: owner.id, sessionId, featureId: 5, artifactType: "SPC" as const, artifactContent: { name: "Fixture source", systemPrompt: "Keep marker FIXTURE-731 and value 42 unchanged." } },
      { userId: owner.id, sessionId, featureId: 4, artifactType: "MICRO_PDD" as const, parentArtifactId: birth!.id, artifactContent: { name: "Micro source", contracts: { z: "last", a: "first" } } },
      { userId: owner.id, sessionId, featureId: 6, artifactType: "ATLAS_PDD" as const, artifactContent: { text: "patient treatment" } },
    ]).returning();
    [spcId, microId, sensitiveId] = sourceRows.map(r => r.id);
  });
  afterAll(async () => {
    if (owner) {
      // Explicit child-first cleanup for parent RESTRICT references; no billed calls.
      await db.delete(harnessArtifactsTable).where(and(eq(harnessArtifactsTable.userId, owner.id), inArray(harnessArtifactsTable.artifactType, ["IMPRIMA_PREPARATION", "SHORT_SPRINT_PREPARATION"])));
      await db.delete(harnessArtifactsTable).where(eq(harnessArtifactsTable.id, microId));
    }
    for (const actor of [owner, other]) if (actor) await db.delete(usersTable).where(eq(usersTable.id, actor.id));
    memory.clear();
  });
  it("archives three real draft formats, preserves exact bytes after JSONB, persists and isolates owners while full guards are missing", async () => {
    const p = await createPreparation(owner, "imprima", { sourceId: spcId, sourceKind: "F5_SPC", options: opts });
    expect(p.state).toBe("PREPARED_DRAFT"); expect(p.releaseAllowed).toBe(false);
    const ws = await preparationWorkspace(owner, "imprima", sessionId);
    expect(ws.databaseProtection.ready).toBe(false); expect(ws.items.some(i => i.id === p.id)).toBe(true);
    const hashes = new Set(p.files.filter(f => ["HTML", "PDF", "DOCX"].includes(f.format)).map(f => f.contentHash));
    expect(hashes.size).toBe(1);
    for (const f of p.files) {
      const download = await preparationDownload(owner, "imprima", p.id, f.id);
      expect(fileHash(download.bytes)).toBe(f.fileHash); expect(download.bytes.length).toBe(f.size);
      if (f.format === "PDF") expect(download.bytes.subarray(0, 5).toString()).toBe("%PDF-");
      if (f.format === "DOCX") expect(unzipSync(download.bytes)["word/document.xml"]).toBeDefined();
      if (f.format === "HTML") expect(download.bytes.toString()).toContain("FIXTURE-731");
      if (f.format === "ZIP") {
        const zip = unzipSync(download.bytes);
        const m = JSON.parse(Buffer.from(zip["integrity-manifest.json"]!).toString());
        expect(m.releaseAllowed).toBe(false);
        for (const entry of m.files) expect(fileHash(Buffer.from(zip[entry.filename]!))).toBe(entry.sha256);
      }
    }
    expect((await preparationWorkspace(other, "imprima")).items).toEqual([]);
    await expect(preparationDownload(other, "imprima", p.id, p.files[0]!.id)).rejects.toThrow("not found");
    await expect(createPreparation(other, "imprima", { sourceId: spcId, sourceKind: "F5_SPC", options: opts })).rejects.toThrow("not found");
    await expect(withOperationsActor(owner, async () => "unsafe fallback")).rejects.toThrow("database isolation");
    const key = [...memory.keys()].find(k => k.includes(p.id))!, original = memory.get(key)!;
    memory.set(key, Buffer.from("TAMPERED"));
    await expect(preparationDownload(owner, "imprima", p.id, p.files[0]!.id)).rejects.toThrow("integrity");
    memory.set(key, original);
  });
  it("prepares both circuits, includes the actual birth package/SASS, and never changes stages or creates a release", async () => {
    for (const circuit of ["SC_ONE", "SC_TWO"]) {
      const p = await createPreparation(owner, "short-sprints", { sourceId: circuit === "SC_ONE" ? microId : spcId,
        sourceKind: circuit === "SC_ONE" ? "F4_MICRO_PDD" : "F5_SPC",
        options: { circuit, target: "SOFTWARE", profile: "STANDARD", hostTarget: "Preparation only", manifest } });
      expect(p.state).toBe("PREPARED_PROPOSAL"); expect(p.releaseAllowed).toBe(false);
      const name = circuit === "SC_ONE" ? "cell-birth-package.json" : "standalone-agent-spec-sheet.json";
      expect(p.files.some(f => f.filename === name)).toBe(true);
      for (const f of p.files) expect(fileHash((await preparationDownload(owner, "short-sprints", p.id, f.id)).bytes)).toBe(f.fileHash);
    }
    expect(await db.select().from(shortSprintRunsTable).where(eq(shortSprintRunsTable.userId, owner.id))).toHaveLength(0);
    expect(await db.select().from(imprimaJobsTable).where(eq(imprimaJobsTable.userId, owner.id))).toHaveLength(0);
    expect(await db.select().from(harnessFeatureStateTable).where(eq(harnessFeatureStateTable.sessionId, sessionId))).toHaveLength(0);
  });
  it("rejects Final, safety-sensitive sources, anonymous author profiles and fake release actions without archiving bytes", async () => {
    const before = memory.size;
    await expect(createPreparation(owner, "imprima", { sourceId: spcId, sourceKind: "F5_SPC", options: { ...opts, mode: "FINAL" } })).rejects.toThrow("DRAFT only");
    await expect(createPreparation(owner, "imprima", { sourceId: sensitiveId, sourceKind: "F6_PDD", options: opts })).rejects.toThrow("safety");
    await expect(createPreparation({ ...owner, displayName: null }, "imprima", { sourceId: spcId, sourceKind: "F5_SPC", options: opts })).rejects.toThrow("named human");
    await expect(createPreparation(owner, "short-sprints", { sourceId: spcId, sourceKind: "F5_SPC", options: { action: "RELEASE" } })).rejects.toThrow();
    expect(memory.size).toBe(before);
  });
  it("rejects the thirty-first daily preparation without archiving more bytes", async () => {
    await db.insert(harnessArtifactsTable).values(Array.from({ length: 27 }, () => ({
      userId: owner.id, sessionId, featureId: -210, artifactType: "IMPRIMA_PREPARATION" as const,
      artifactContent: {}, name: "Synthetic quota fixture; no archived files",
    })));
    const before = memory.size;
    await expect(createPreparation(owner, "imprima", {
      sourceId: spcId, sourceKind: "F5_SPC", options: { ...opts, formats: ["HTML"] },
    })).rejects.toMatchObject({ status: 429 });
    expect(memory.size).toBe(before);
  });
});
