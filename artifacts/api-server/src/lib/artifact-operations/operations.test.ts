import { describe, it, expect } from "vitest";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { unzipSync, strFromU8 } from "fflate";
import { publishRequest, normaliseDocument, applyClarity, documentFilename, hashContent, sourceSafety } from "./imprima-model";
import { renderImprima } from "./imprima-render";
import { authoritySchema, signingMessage, verifiedSprintReceipt, type SprintReceipt } from "./sprint-evidence";
import { assessSprintPack } from "./short-sprints";
import { publicHandoff } from "./public-handoff";
import type { OperationsTx } from "./context";

const config = publishRequest.parse({ formats: ["HTML", "DOCX", "PDF"], title: "Release Review", project: "QA Project", author: "Independent Reviewer", authorIsHuman: true });
const raw = { overview: "The service accepts requests safely.", prompt: "NEVER alter ID-001 or the quoted instruction.", limit: 42, code: "<script>alert('example')</script>" };
const cdm = normaliseDocument("F6_PDD", randomUUID(), raw, config);
const renderContext = { renderedAt: new Date("2026-10-16T16:20:00Z"), version: 1, collision: 1, approval: null };

describe("IMPRIMA source fidelity and real formats", () => {
  it("edits prose but preserves every protected block", () => {
    const prose = cdm.blocks.find(b => b.type === "paragraph" && !b.protected)!;
    expect(prose).toBeTruthy();
    const changed = applyClarity(cdm, { edits: [{ blockId: prose.id, text: "The service safely accepts requests." }], clarity: 80, summary: null, glossary: [] }).cdm;
    expect(changed.blocks.filter(b => b.protected).map(b => b.text)).toEqual(cdm.blocks.filter(b => b.protected).map(b => b.text));
    expect(hashContent(raw)).toBe(cdm.sourceHash);
  });
  it("rejects edits to protected prompts", () => {
    const protectedBlock = cdm.blocks.find(b => b.protected && b.type === "code")!;
    expect(() => applyClarity(cdm, { edits: [{ blockId: protectedBlock.id, text: "Changed prompt" }], clarity: 90, summary: null, glossary: [] })).toThrow();
  });
  it("does not let a clarity edit introduce numeric claims", () => {
    const prose = cdm.blocks.find(b => b.type === "paragraph" && !b.protected)!;
    expect(() => applyClarity(cdm, { edits: [{ blockId: prose.id, text: "The service is 100% reliable." }], clarity: 99, summary: null, glossary: [] })).toThrow();
  });
  it("uses exactly five filename tokens and a local timezone stamp", () => {
    const name = documentFilename(config, "PDF", renderContext.renderedAt);
    expect(name.split("__")).toHaveLength(5);
    expect(name).toMatch(/20261016-1120CDT/);
    expect(name.length).toBeLessThanOrEqual(180);
    expect(name).not.toMatch(/[<>:"/\\|?*\s]/);
  });
  it("contains secrets and adds a professional-advice warning for SAFE_LIFE", () => {
    expect(sourceSafety({ api_key: "fake-example-only-value-not-a-real-key" }, config).secrets).toBe(true);
    const sensitive = normaliseDocument("F0_SERVICE", randomUUID(), { text: "General considerations" }, { ...config, riskDomain: "LEGAL" });
    expect(sensitive.blocks.some(b => b.text.includes("NOT PROFESSIONAL ADVICE"))).toBe(true);
  });
  it("creates escaped, self-contained HTML rather than executable source", async () => {
    const file = await renderImprima(cdm, "HTML", renderContext);
    const html = file.bytes.toString();
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain('lang="en"');
    expect(html).toContain(cdm.sourceHash);
    expect(file.contentHash).toBe(hashContent(cdm));
  });
  it("creates a real DOCX with matching core metadata and a native heading", async () => {
    const file = await renderImprima(cdm, "DOCX", renderContext);
    const zip = unzipSync(file.bytes);
    const core = strFromU8(zip["docProps/core.xml"]!);
    expect(strFromU8(zip["word/document.xml"]!)).toContain(file.contentHash);
    expect(strFromU8(zip["word/document.xml"]!)).toContain("Heading1");
    expect(core).toContain("2026-10-16T16:20:00.000Z");
    expect(core).toContain("Independent-Reviewer");
  });
  it("creates an embedded-font, tagged PDF without claiming independent WCAG certification", async () => {
    const file = await renderImprima(cdm, "PDF", renderContext);
    expect(file.bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(file.bytes.includes(Buffer.from("/StructTreeRoot"))).toBe(true);
    expect(file.bytes.includes(Buffer.from("/FontFile2"))).toBe(true);
    expect(file.validation.accessibility.wcagConformance).toBe("NOT_ASSERTED");
    expect(file.validation.design.score).toBeGreaterThanOrEqual(43);
  });
  it("gives all three formats the identical CDM hash", async () => {
    const files = await Promise.all((["HTML", "DOCX", "PDF"] as const).map(f => renderImprima(cdm, f, renderContext)));
    expect(new Set(files.map(f => f.contentHash)).size).toBe(1);
    expect(new Set(files.map(f => f.fileHash)).size).toBe(3);
  });
});

describe("SHORT SPRINTS independent signed evidence", () => {
  const keys = generateKeyPairSync("ed25519");
  const authorityId = randomUUID(), workflowId = randomUUID();
  const subject = { id: workflowId, sourceHash: "a".repeat(64), sourceCreatedAt: new Date(Date.now() - 86400000).toISOString(), producerFamily: "claude" };
  function authority(mechanism = "DETERMINISTIC", revokedAt: Date | null = null) {
    return { id: authorityId, publicKey: keys.publicKey.export({ type: "spki", format: "pem" }).toString(), name: "Independent Reviewer", mechanism, scopes: ["E", "R", "J", "H", "F11", "F12", "SOURCE_CERTIFICATION"], revokedAt };
  }
  const tx = (a = authority()) => ({ select: () => ({ from: () => ({ where: async () => [a] }) }) }) as unknown as OperationsTx;
  function receipt(extra: Partial<SprintReceipt["payload"]> = {}): SprintReceipt {
    const payload: SprintReceipt["payload"] = { protocol: "ATANDA-SS-1", authorityId, workflowId, sourceHash: subject.sourceHash, scope: "R", verdict: "PASS", issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(), evidenceHash: "b".repeat(64), checks: ["INJECTION", "POISONED_PREMISE"], manifestHash: "c".repeat(64), ...extra };
    return { payload, signature: sign(null, signingMessage(payload), keys.privateKey).toString("base64") };
  }
  it("verifies Ed25519 evidence and derives I2 from the approved tool registry", async () => {
    expect((await verifiedSprintReceipt(tx(), receipt(), subject)).independence).toBe(2);
  });
  it("rejects forged verdicts without re-signing", async () => {
    const proof = receipt(); proof.payload.verdict = "FAIL";
    await expect(verifiedSprintReceipt(tx(), proof, subject)).rejects.toThrow("signature");
  });
  it("rejects source/workflow replay, expiry and revoked authorities", async () => {
    await expect(verifiedSprintReceipt(tx(), receipt({ sourceHash: "d".repeat(64) }), subject)).rejects.toThrow("another");
    await expect(verifiedSprintReceipt(tx(), receipt({ workflowId: randomUUID() }), subject)).rejects.toThrow("another");
    await expect(verifiedSprintReceipt(tx(), receipt({ expiresAt: new Date(Date.now() - 1000).toISOString() }), subject)).rejects.toThrow("expired");
    await expect(verifiedSprintReceipt(tx(authority("DETERMINISTIC", new Date())), receipt(), subject)).rejects.toThrow("revoked");
  });
  it("rejects a retrofitted Track E evalset", async () => {
    await expect(verifiedSprintReceipt(tx(), receipt({ scope: "E", evalsetHash: "e".repeat(64), registeredAt: new Date().toISOString() }), subject)).rejects.toThrow("before");
  });
  it("does not accept model scores as deterministic security evidence", async () => {
    await expect(verifiedSprintReceipt(tx(authority("CROSS_MODEL")), receipt({ producerFamily: "claude", verifierFamily: "openai" }), subject)).rejects.toThrow("deterministic");
  });
  it("normalizes provider aliases instead of treating Anthropic as independent of Claude", async () => {
    await expect(verifiedSprintReceipt(tx(authority("CROSS_MODEL")), receipt({ scope: "J", producerFamily: "claude", verifierFamily: "anthropic" }), subject)).rejects.toThrow("different");
    expect((await verifiedSprintReceipt(tx(authority("CROSS_MODEL")), receipt({ scope: "J", producerFamily: "claude", verifierFamily: "openai" }), subject)).independence).toBe(1);
  });
  it("requires a named approved human for F11", async () => {
    await expect(verifiedSprintReceipt(tx(), receipt({ scope: "F11" }), subject)).rejects.toThrow("human");
    expect((await verifiedSprintReceipt(tx(authority("HUMAN")), receipt({ scope: "F11", reviewerName: "Independent Reviewer" }), subject)).independence).toBe(3);
  });
  it("does not certify a source from an incomplete certificate or accept private keys", async () => {
    await expect(verifiedSprintReceipt(tx(), receipt({ scope: "SOURCE_CERTIFICATION" }), subject)).rejects.toThrow("complete stage");
    expect(authoritySchema.safeParse({ name: "Test Authority", publicKey: keys.privateKey.export({ type: "pkcs8", format: "pem" }), mechanism: "DETERMINISTIC", scopes: ["E"], governanceNote: "A fixture registration that must reject private keys." }).success).toBe(false);
  });
  it("keeps a pack inconclusive with missing receipts or unmatched SASS evalsets", () => {
    const run = { circuit: "SC_TWO", profile: "STANDARD", config: { manifest: { evalsetHashes: [] } }, result: { manifestHash: "f".repeat(64) } };
    const assessed = assessSprintPack(run, {});
    expect(assessed.status).toBe("INCONCLUSIVE");
    expect(assessed.tracks.map(t => t.track)).toEqual(["E", "R", "C", "J", "S"]);
    expect(assessed.tracks.find(t => t.track === "E")!.reason).toContain("SASS_EVALSET_BINDING");
  });
});

describe("private document connector boundary", () => {
  it("rejects non-HTTPS and credential-bearing destinations", async () => {
    await expect(publicHandoff("http://example.org", {}, "fixture")).rejects.toThrow("HTTPS");
    await expect(publicHandoff("https://user:password@example.org", {}, "fixture")).rejects.toThrow("credentials");
  });
  it("rejects loopback and metadata-service addresses before sending anything", async () => {
    await expect(publicHandoff("https://127.0.0.1", {}, "fixture")).rejects.toThrow("reserved");
    await expect(publicHandoff("https://169.254.169.254", {}, "fixture")).rejects.toThrow("reserved");
  });
});
