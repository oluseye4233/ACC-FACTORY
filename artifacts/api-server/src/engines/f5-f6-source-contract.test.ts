import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { installGovernance } from "../lib/artifact-governance";

const mock = vi.hoisted(() => ({
  loadArtifact: vi.fn(), callLlmJson: vi.fn(), persistArtifact: vi.fn(), advanceFeatureState: vi.fn(),
  ownedSessionOr404: vi.fn(), collectScanLink: vi.fn(),
}));
vi.mock("./shared", () => ({
  ...mock, resolveProvider: () => "claude", sendProviderTierError: () => false,
  ProviderRequiresTierError: class extends Error {}, ProviderNotConfiguredError: class extends Error {},
}));
vi.mock("../lib/scan-link-evidence", async importOriginal => ({
  ...await importOriginal<typeof import("../lib/scan-link-evidence")>(), collectScanLink: mock.collectScanLink,
}));
import { buildF6Prompt, handleF6, handleF6DraftStream } from "./f6";
import { handleF5Scan } from "./f5-scan";

const sessionId = "10000000-0000-4000-8000-000000000011";
const sourceId = "10000000-0000-4000-8000-000000000012";
function response() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  return { res, express: res as unknown as Response };
}
function req(body: unknown) {
  return { body, log: { error: vi.fn() } } as unknown as Request;
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.ownedSessionOr404.mockResolvedValue({ ok: true, userId: "synthetic-owner" });
  mock.loadArtifact.mockResolvedValue({ id: sourceId, sessionId, featureId: 5, artifactType: "SPC",
    artifactContent: installGovernance({ name: "Named F5 SPC" }) });
  mock.persistArtifact.mockResolvedValue({ id: "saved-artifact", featureId: 5 });
});

describe("F6 exclusively uses saved F5 sources", () => {
  it.each(["SPC", "ATLAS_360_SCAN_VIEW"])("accepts owned same-session F5 %s", async artifactType => {
    mock.loadArtifact.mockResolvedValue({ id: sourceId, sessionId, featureId: 5, artifactType,
      artifactContent: installGovernance({ title: "Named source", coverage: "Local link not inspected" }) });
    const prompt = await buildF6Prompt("FROM_F5", sessionId, "owner", sourceId, null);
    expect(prompt).toContain("Named source");
    expect(prompt).toContain("Local link not inspected");
  });
  it.each([
    { featureId: 6, artifactType: "ATLAS_360_SCAN_VIEW" },
    { featureId: 4, artifactType: "SPC" },
    { featureId: 5, artifactType: "MICRO_PDD" },
    { featureId: 5, artifactType: "SPC", sessionId: "foreign-session" },
  ])("rejects another stage/type/session: %j", async source => {
    mock.loadArtifact.mockResolvedValue({ id: sourceId, sessionId, artifactContent: installGovernance({}), ...source });
    await expect(buildF6Prompt("FROM_F5", sessionId, "owner", sourceId, null)).rejects.toThrow("Source must be an F5");
    expect(mock.callLlmJson).not.toHaveBeenCalled();
  });
  it("rejects missing/inaccessible sources and old fresh-brief mode", async () => {
    await expect(buildF6Prompt("FROM_F5", sessionId, "owner", null, null)).rejects.toThrow("Select a saved F5");
    mock.loadArtifact.mockResolvedValue(null);
    await expect(buildF6Prompt("FROM_F5", sessionId, "owner", sourceId, null)).rejects.toThrow();
    await expect(buildF6Prompt("FRESH", sessionId, "owner", sourceId, "Bypass")).rejects.toThrow("only accepts saved F5");
  });
  it.each([handleF6, handleF6DraftStream])("enforces the restriction before either endpoint dispatches a model", async handler => {
    const { res, express } = response();
    await handler(req({ sessionId, mode: "FRESH", brief: "Bypass source selection" }), express);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mock.callLlmJson).not.toHaveBeenCalled();
  });
  it("retains exact F5 source lineage on the drafted PDD", async () => {
    mock.callLlmJson.mockResolvedValue({ cheatSheet: "c", execSummary: "e", worksheet: "w", implementation: "i" });
    const { express } = response();
    await handleF6(req({ sessionId, mode: "FROM_F5", sourceArtifactId: sourceId }), express);
    expect(mock.persistArtifact).toHaveBeenCalledWith(expect.objectContaining({
      featureId: 6, artifactContent: expect.objectContaining({ sourceArtifactId: sourceId, sourceFeatureId: 5 }),
    }));
  });
});

describe("F5 link-based SCAN", () => {
  it("saves evidence limits and makes the governed SCAN an F5 source", async () => {
    mock.collectScanLink.mockResolvedValue({ url: "http://localhost:3000/", status: "REFERENCE_ONLY", coverage: "Not inspected" });
    mock.callLlmJson.mockResolvedValue({ schemaVersion: "atlas-360-scan-v1", view: "SCAN", title: "Local evidence missing",
      stages: Array.from({ length: 8 }, (_, i) => ({ stage: i + 1, name: `Stage ${i + 1}`, assessment: "No evidence", evidence: [], actions: [] })) });
    const { res, express } = response();
    await handleF5Scan(req({ sessionId, links: ["http://localhost:3000"] }), express);
    expect(mock.callLlmJson.mock.calls[0]![4]).toMatchObject({ engineId: 5, sessionId });
    expect(mock.persistArtifact).toHaveBeenCalledWith(expect.objectContaining({
      featureId: 5, artifactType: "ATLAS_360_SCAN_VIEW",
      artifactContent: expect.objectContaining({ scanOrigin: "F5_LINK_INTAKE",
        sourceLinks: [expect.objectContaining({ status: "REFERENCE_ONLY" })], governance: expect.any(Object) }),
    }));
    expect(mock.advanceFeatureState).toHaveBeenCalledWith(sessionId, 5);
    expect(res.json).toHaveBeenCalled();
  });
  it.each([["javascript:alert(1)"], ["https://user:password@example.com"], ["https://example.com/?access_token=private"]])(
    "rejects unsafe/credential-bearing links before retrieval: %j", async links => {
      const { res, express } = response();
      await handleF5Scan(req({ sessionId, links }), express);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(mock.collectScanLink).not.toHaveBeenCalled();
      expect(mock.callLlmJson).not.toHaveBeenCalled();
    },
  );
});
