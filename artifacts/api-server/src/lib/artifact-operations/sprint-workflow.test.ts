import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, usersTable, harnessSessionsTable, harnessArtifactsTable, harnessFeatureStateTable, shortSprintRunsTable, sprintVerifierAuthoritiesTable, imprimaJobsTable, imprimaFilesTable, vteVerificationFailuresTable } from "@workspace/db";
import { createSprint, sprintCommand, sprintRun, sprintExport } from "./short-sprints";
import { registerAuthority, signingMessage, type SprintReceipt } from "./sprint-evidence";
import { withOperationsActor, type OperationsActor } from "./context";

const memory = vi.hoisted(() => new Map<string, Buffer>());
vi.mock("./private-storage", async importOriginal => {
  const actual = await importOriginal<typeof import("./private-storage")>();
  return { ...actual, savePrivate: async (key: string, value: string | Buffer) => { const bytes = Buffer.from(value); if (memory.has(key)) throw new Error("immutable fixture object"); memory.set(key, bytes); return { key, size: bytes.length, hash: actual.fileHash(bytes) }; }, readPrivate: async (key: string) => { const bytes = memory.get(key); if (!bytes) throw new Error("fixture object missing"); return bytes; }, deletePrivate: async (key: string) => { memory.delete(key); } };
});

describe("persisted short-route lifecycle (synthetic verifier/provider fixtures, not live evidence)", () => {
  let owner: OperationsActor, admin: OperationsActor, stranger: OperationsActor, sessionId: string, artifactId: string;
  const registered: string[] = [];
  const keys = [generateKeyPairSync("ed25519"), generateKeyPairSync("ed25519"), generateKeyPairSync("ed25519")];
  const evalsetHash = "e".repeat(64);
  beforeAll(async () => {
    const people = await db.insert(usersTable).values([
      { clerkUserId: `ops-owner-${randomUUID()}`, displayName: "Fixture Publisher" },
      { clerkUserId: `ops-admin-${randomUUID()}`, displayName: "Fixture Curator", role: "ADMIN" },
      { clerkUserId: `ops-other-${randomUUID()}`, displayName: "Fixture Other Owner" },
    ]).returning();
    [owner, admin, stranger] = people.map(p => ({ id: p.id, displayName: p.displayName, role: p.role }));
    const [session] = await db.insert(harnessSessionsTable).values({ userId: owner!.id, sessionName: "SYNTHETIC short-route lifecycle; not deployed" }).returning();
    sessionId = session!.id;
    const [artifact] = await db.insert(harnessArtifactsTable).values({ userId: owner!.id, sessionId, featureId: 5, artifactType: "SPC", name: "Synthetic SPC", artifactContent: { identity: "Synthetic fixture", forgeCertified: true, score: 99, systemPrompt: "Respond only to the fixture task." }, provider: "claude", createdAt: new Date(Date.now() - 120000) }).returning();
    artifactId = artifact!.id;
    await db.insert(harnessFeatureStateTable).values([5, 6, 7, 8, 9].map(featureId => ({ sessionId, featureId, status: featureId === 5 ? "COMPLETE" as const : featureId === 6 ? "AVAILABLE" as const : "LOCKED" as const })));
    for (const [i, mechanism] of (["DETERMINISTIC", "CROSS_MODEL", "HUMAN"] as const).entries()) {
      const authority = await withOperationsActor(admin!, tx => registerAuthority(tx, admin!, { name: mechanism === "HUMAN" ? "Fixture Independent Reviewer" : `Fixture ${mechanism}`, publicKey: keys[i]!.publicKey.export({ type: "spki", format: "pem" }).toString(), mechanism, scopes: mechanism === "CROSS_MODEL" ? ["J"] : mechanism === "HUMAN" ? ["H", "F11"] : ["SOURCE_CERTIFICATION", "E", "R", "S", "C", "P", "F95", "F10", "F12"], governanceNote: "SYNTHETIC TEST ONLY. Ephemeral signer; no real independent testing or provider deployment is asserted." }));
      registered.push(authority.id);
    }
  });
  afterAll(async () => {
    for (const id of registered) await db.delete(sprintVerifierAuthoritiesTable).where(eq(sprintVerifierAuthoritiesTable.id, id));
    for (const actor of [owner, admin, stranger]) if (actor) await db.delete(usersTable).where(eq(usersTable.id, actor.id));
    memory.clear();
  });
  const manifest = { name: "Synthetic agent", mission: "Lifecycle fixture only", systemPrompt: "Return the fixture result.", inputContract: { type: "object", properties: { zebra: { type: "string" }, a: { type: "number" } }, required: ["zebra"] }, outputContract: { type: "object" }, tools: [], constraints: ["No real deployment"], groRules: "Decline unsafe requests", failClosedRules: "Refuse unsupported work", deployment: "Synthetic provider fixtures only", model: "fixture-model", provider: "claude", dataHandling: "Synthetic data only", monitoring: "Synthetic signed health windows", version: "1", promotionNotes: "No actual promotion requested", evalsetHashes: [evalsetHash] };

  it("enforces a non-bypass operations role, owner isolation, current packages and all staged release gates", async () => {
    const id = await createSprint(owner, sessionId, artifactId, { circuit: "SC_TWO", target: "SOFTWARE", profile: "STANDARD", hostTarget: "Synthetic fixture only", manifest });
    const get = () => withOperationsActor(owner, tx => sprintRun(tx, owner, id));
    const command = async (action: string, options: Record<string, unknown> = {}) => sprintCommand(owner, id, (await get()).revision, action, options);
    const initialRun = await get(), initialExport = await sprintExport(owner, id);
    expect(initialExport.files.map(f => ({ name: f.name, sha256: f.sha256, size: Buffer.byteLength(f.content) }))).toEqual(initialRun.result.shippedFiles);
    const originalSnapshot = memory.get(initialRun.sourceObjectKey)!;
    const damaged = JSON.parse(originalSnapshot.toString());
    damaged.releaseFiles[1].content += "TAMPERED";
    memory.set(initialRun.sourceObjectKey, Buffer.from(JSON.stringify(damaged)));
    await expect(sprintExport(owner, id)).rejects.toThrow("do not match");
    memory.set(initialRun.sourceObjectKey, originalSnapshot);
    const roles = await withOperationsActor(owner, tx => tx.execute(sql`select rolsuper,rolbypassrls from pg_roles where rolname=current_user`));
    expect(roles.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
    const unseen = await withOperationsActor(stranger, tx => tx.select().from(shortSprintRunsTable));
    expect(unseen.some(r => r.id === id)).toBe(false);
    await expect(withOperationsActor(stranger, tx => sprintRun(tx, stranger, id))).rejects.toThrow("not found");
    await expect(command("YES", { reason: "Legacy flags are not certificates" })).rejects.toThrow("trusted evidence");
    let clock = Date.now() - 1000;
    async function proof(scope: SprintReceipt["payload"]["scope"], checks: string[], extra: Partial<SprintReceipt["payload"]> = {}) {
      const run = await get(), index = scope === "J" ? 1 : scope === "F11" || scope === "H" ? 2 : 0;
      clock = Math.max(clock + 20, Date.now() + 20);
      const payload: SprintReceipt["payload"] = { protocol: "ATANDA-SS-1", authorityId: registered[index]!, workflowId: id, sourceHash: run.sourceHash, manifestHash: String(run.result.manifestHash), scope, verdict: "PASS", issuedAt: new Date(clock).toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(), evidenceHash: "a".repeat(64), checks, ...extra };
      const receipt = { payload, signature: sign(null, signingMessage(payload), keys[index]!.privateKey).toString("base64") };
      await command("IMPORT_EVIDENCE", { receipt });
    }
    const fact = (value: boolean | number) => ({ value, evidenceHash: "b".repeat(64) });
    const facts = { sourceStageCertified: fact(true), regulatedTracksAdded: fact(true), toolPermissionsDeclared: fact(true), atomicPromptCount: fact(2), toolCount: fact(0), buildElapsedMinutes: fact(30), interfaceContractPresent: fact(true), hasCodebase: fact(false), openCriticalCount: fact(0), f2Certified: fact(true), jsonIoContractsValid: fact(true), hostDeployableByConfiguration: fact(true), singleAgent: fact(true) };
    await proof("SOURCE_CERTIFICATION", ["FULL_STAGE_BLOCKING_TRACKS", "SOURCE_VERSION_BOUND", "NO_OPEN_CRITICAL"], { facts: facts as SprintReceipt["payload"]["facts"] });
    await command("YES", { reason: "Select the independently evidenced fixture route" });
    const stages = await db.select().from(harnessFeatureStateTable).where(eq(harnessFeatureStateTable.sessionId, sessionId));
    expect(stages.find(s => s.featureId === 5)!.status).toBe("COMPLETE");
    expect(stages.filter(s => s.featureId >= 6).every(s => s.status === "SKIPPED_BY_SC")).toBe(true);
    await command("RUN_PACK");
    expect((await get()).state).toBe("PACK_INCONCLUSIVE");
    await proof("E", ["UNIT_TRAJECTORY", "LYSOSOME_STRESS", "CONTRACT_CONFORMANCE", "FAIL_CLOSED"], { evalsetHash, registeredAt: new Date(Date.now() - 240000).toISOString() });
    await proof("R", ["INJECTION", "POISONED_PREMISE"]);
    await proof("C", ["MANIFEST_CUSTODY"]);
    await proof("J", ["CROSS_MODEL_QUALITY"], { producerFamily: "claude", verifierFamily: "openai" });
    await proof("S", ["SASS_MATCH"]);
    await proof("R", ["INJECTION", "POISONED_PREMISE"], { verdict: "FAIL" });
    await command("RUN_PACK");
    expect((await get()).state).toBe("PACK_FAILED");
    const [failureCase] = await db.select().from(vteVerificationFailuresTable).where(eq(vteVerificationFailuresTable.sprintRunId, id));
    expect(failureCase!.state).toBe("OPEN");
    expect(failureCase!.sourceEvidenceHash).toMatch(/^[a-f0-9]{64}$/);
    await proof("R", ["INJECTION", "POISONED_PREMISE"]);
    await command("RUN_PACK");
    expect((await get()).state).toBe("PACK_PASSED");
    const run = await get(), pack = run.result.pack as { packHash: string }, pkg = run.result.package as { manifestHash: string };
    const bound = { packHash: pack.packHash, sealedManifestHash: pkg.manifestHash };
    await expect(command("SEAL")).rejects.toThrow("open VTE");
    await proof("H", ["VTE_RESOLUTION_APPROVED"], { ...bound, caseId: failureCase!.id, reviewerName: "Fixture Independent Reviewer" });
    const [closed] = await db.select().from(vteVerificationFailuresTable).where(eq(vteVerificationFailuresTable.id, failureCase!.id));
    expect(closed!.state).toBe("CLOSED");
    await expect(command("SEAL")).rejects.toThrow("OSIRIS");
    await proof("F95", ["CUSTODY_SEALED"], bound);
    await command("SEAL");
    await proof("P", ["PROVIDER_TERMS_CURRENT"], bound);
    await proof("F10", ["PROVIDER_READY", "REGRESSION_BASELINE_PASS"], bound);
    await command("RELEASE");
    await proof("F11", ["HANDOFF_COMPLETE", "NAMED_RELEASE_SIGNOFF"], { ...bound, reviewerName: "Fixture Independent Reviewer" });
    await command("RELEASE");
    const health = { ...bound, healthUrl: "https://example.org/synthetic-health-not-live", rollbackReference: "SYNTHETIC_ROLLBACK_ONLY" };
    await proof("F12", ["HEALTH_WINDOW_PASS", "ROLLBACK_READY", "ERROR_BUDGET_PASS"], { ...health, stage: "5" });
    await command("RELEASE");
    expect((await get()).state).toBe("MONITORING");
    await expect(command("RELEASE")).rejects.toThrow("F12_25");
    await proof("F12", ["HEALTH_WINDOW_PASS", "ROLLBACK_READY", "ERROR_BUDGET_PASS"], { ...health, stage: "25" });
    await command("RELEASE");
    expect((await get()).state).toBe("MONITORING");
    expect(((await get()).result.release as { lastStage: string }).lastStage).toBe("25");
    await proof("F12", ["HEALTH_WINDOW_PASS", "ROLLBACK_READY", "ERROR_BUDGET_PASS"], { ...health, stage: "100" });
    await command("RELEASE");
    expect((await get()).state).toBe("LIVE");
    const exported = await sprintExport(owner, id);
    expect(exported.releaseAllowed).toBe(false); // A package download is never a fresh authorization.
    expect(exported.files.map(f => f.name)).toContain("standalone-agent-spec-sheet.json");
    expect(exported.sealedManifestHash).toBe(pkg.manifestHash);
    await proof("F12", ["HEALTH_WINDOW_FAIL", "ROLLBACK_REQUIRED"], { ...health, stage: "100", verdict: "FAIL" });
    expect((await get()).state).toBe("ROLLBACK_REQUIRED");
    await expect(command("WITHDRAW", { reason: "A button does not stop external traffic" })).rejects.toThrow("ROLLBACK_EXECUTED");
    await proof("F12", ["ROLLBACK_EXECUTED"], { ...health, stage: "100" });
    expect((await get()).state).toBe("ROLLED_BACK");
    await command("WITHDRAW", { reason: "Restore the full path after confirmed rollback" });
    expect((await get()).state).toBe("WITHDRAWN");
    await expect(command("IMPORT_EVIDENCE", { receipt: {} })).rejects.toThrow();
    await withOperationsActor(admin, tx => tx.update(sprintVerifierAuthoritiesTable).set({ revokedAt: new Date() }).where(eq(sprintVerifierAuthoritiesTable.id, registered[0]!)));
    await expect(command("PROMOTE", { reason: "A revoked pack cannot authorize promotion" })).rejects.toThrow();
  }, 30000);
  it("cannot restore another active route's skipped stages by withdrawing a different proposal", async () => {
    const a = await createSprint(owner, sessionId, artifactId, { circuit: "SC_TWO", target: "SOFTWARE", profile: "STANDARD", hostTarget: "Synthetic fixture only", manifest });
    const b = await createSprint(owner, sessionId, artifactId, { circuit: "SC_TWO", target: "SOFTWARE", profile: "STANDARD", hostTarget: "Synthetic fixture only", manifest });
    await db.update(shortSprintRunsTable).set({ activeRoute: 1, state: "ROUTED" }).where(eq(shortSprintRunsTable.id, a));
    await db.update(harnessFeatureStateTable).set({ status: "SKIPPED_BY_SC" }).where(and(eq(harnessFeatureStateTable.sessionId, sessionId), eq(harnessFeatureStateTable.featureId, 6)));
    await sprintCommand(owner, b, 0, "WITHDRAW", { reason: "Withdraw this unused proposal only" });
    const [stage] = await db.select().from(harnessFeatureStateTable).where(and(eq(harnessFeatureStateTable.sessionId, sessionId), eq(harnessFeatureStateTable.featureId, 6)));
    expect(stage!.status).toBe("SKIPPED_BY_SC");
    await expect(sprintCommand(owner, b, 0, "WITHDRAW", { reason: "Stale revision" })).rejects.toThrow("changed");
    await sprintCommand(owner, a, 0, "WITHDRAW", { reason: "Clean up the synthetic active route" });
  });
  it("enforces immutable Final and file metadata inside PostgreSQL, not just the buttons", async () => {
    const [job] = await db.insert(imprimaJobsTable).values({ userId: owner.id, sessionId, sourceKind: "F5_SPC", sourceId: artifactId, sourceHash: "c".repeat(64), sourceObjectKey: `synthetic/${randomUUID()}`, version: 1, state: "PUBLISHED", config: { mode: "FINAL" }, result: { contentHash: "d".repeat(64), fixtureOnly: true } }).returning();
    const [file] = await db.insert(imprimaFilesTable).values({ userId: owner.id, jobId: job!.id, format: "HTML", variant: "final", filename: "synthetic-fixture.html", objectKey: `synthetic/${randomUUID()}`, contentHash: "d".repeat(64), fileHash: "e".repeat(64), size: 12, validation: {} }).returning();
    await expect(withOperationsActor(owner, tx => tx.update(imprimaJobsTable).set({ config: { mode: "FINAL", title: "Changed in place" } }).where(eq(imprimaJobsTable.id, job!.id)))).rejects.toThrow();
    await expect(withOperationsActor(owner, tx => tx.update(imprimaFilesTable).set({ filename: "changed.html" }).where(eq(imprimaFilesTable.id, file!.id)))).rejects.toThrow();
    const [unchanged] = await withOperationsActor(owner, tx => tx.select().from(imprimaJobsTable).where(eq(imprimaJobsTable.id, job!.id)));
    expect(unchanged!.config).toEqual({ mode: "FINAL" });
  });
});
