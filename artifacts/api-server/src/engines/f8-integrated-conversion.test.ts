import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const mocks = vi.hoisted(() => ({
  loadArtifact: vi.fn(), persistArtifact: vi.fn(), callLlmJson: vi.fn(),
  ownedSessionOr404: vi.fn(), latestPfpForMvp: vi.fn(),
}));
vi.mock("./shared", () => ({
  ...mocks,
  advanceFeatureState: vi.fn(),
  resolveProvider: () => "claude",
  sendProviderTierError: () => false,
}));
vi.mock("./pfp", () => ({ latestPfpForMvp: mocks.latestPfpForMvp }));
import { handleF8CodeDj } from "./f8codedj";
import { F8_LANGUAGES } from "./f8-language-policy";
import { handleF4 } from "./f4";

const sessionId = "10000000-0000-4000-8000-000000000001";
const mvpId = "10000000-0000-4000-8000-000000000002";
const hostId = "10000000-0000-4000-8000-000000000003";
const microId = "10000000-0000-4000-8000-000000000004";
const pddId = "10000000-0000-4000-8000-000000000005";
let sources: Record<string, Record<string, unknown>>;
const body = () => ({ sessionId, mvpPddArtifactId: mvpId, hostingPlanArtifactId: hostId, artifactClass: "SOFTWARE" });
const output = () => ({
  platform: "react-vite-static", framework: "Vite", language: "javascript",
  files: [{ path: "src/main.jsx", language: "javascript", content: "export {};" }],
  manifest: { framework: "Vite", language: "javascript", entrypoint: "src/main.jsx",
    installCommand: "pnpm install", runCommand: "pnpm dev", buildCommand: "pnpm build", deployTarget: "cloudflare-pages" },
  implementationPath: { rationale: "Fits the supplied reporting scope", recommendedIde: "VS Code",
    recommendedVibe: "Specification-first React", hostingRationale: "Use the supplied static hosting plan",
    requirementTrace: ["Reporting -> src/main.tsx"] }, notes: "Synthetic unit-test scaffold; not live engine evidence",
  collaboration: {
    oracle: [{ requirement: "Reporting", gap: "The scaffold needs a reporting entrypoint", resolution: "CODE_CHANGE" }],
    dj: [{ requirement: "Reporting", change: "Included the reporting entrypoint", files: ["src/main.jsx"] }],
  },
});
function request(data: Record<string, unknown>) {
  const req = { body: data, log: { warn: vi.fn(), error: vi.fn() } } as unknown as Request;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  return { req, res, response: res as unknown as Response };
}

beforeEach(() => {
  vi.clearAllMocks();
  sources = {
    [mvpId]: { id: mvpId, sessionId, artifactType: "MVP_PDD", spartanCert: { certId: "synthetic" },
      artifactContent: { sections: [], sourcePddArtifactId: pddId, colonizationTarget: "AZURE::AZURE_CONTAINER_APPS" } },
    [hostId]: { id: hostId, sessionId, artifactType: "HOSTING_PLAN",
      artifactContent: { sourceMvpPddArtifactId: mvpId, primary: { platform: "cloudflare-pages" } } },
    [pddId]: { id: pddId, sessionId, artifactType: "ATLAS_PDD", artifactContent: { worksheet: "Reporting scope" } },
    [microId]: { id: microId, sessionId, artifactType: "MICRO_PDD", artifactContent: { worksheet: "Reporting contracts" } },
  };
  mocks.loadArtifact.mockImplementation(async id => sources[id] ?? null);
  mocks.ownedSessionOr404.mockResolvedValue({ ok: true, userId: "synthetic-owner" });
  mocks.latestPfpForMvp.mockResolvedValue(null);
  mocks.callLlmJson.mockResolvedValue(output());
  mocks.persistArtifact.mockResolvedValue({ id: "saved-bundle" });
});

describe("integrated F8 conversion contract (offline mocks, no provider calls)", () => {
  it.each(F8_LANGUAGES)("persists an eligible %s bundle through the complete conversion handler", async language => {
    sources[hostId]!.artifactContent = { sourceMvpPddArtifactId: mvpId, primary: { platform: "replit-deployments" } };
    const extension = { python: "py", javascript: "js", sql: "sql", c: "c", cpp: "cpp", csharp: "cs" }[language];
    const entrypoint = `main.${extension}`;
    mocks.callLlmJson.mockResolvedValue({
      ...output(), platform: "portable-source", language,
      files: [{ path: entrypoint, language, content: "Synthetic handler fixture; not runtime evidence." }],
      manifest: { ...output().manifest, language, entrypoint, deployTarget: "replit-deployments" },
      collaboration: { oracle: [], dj: [] },
    });
    const { req, res, response } = request({ ...body(), language });
    await handleF8CodeDj(req, response);
    expect(mocks.persistArtifact).toHaveBeenCalledOnce();
    expect(mocks.persistArtifact.mock.calls[0]![0].artifactContent.language).toBe(language);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ artifactId: "saved-bundle" }));
  });
  it.each(["typescript", "rust", "java"])("rejects unsupported requested language %s before spending", async language => {
    const { req, res, response } = request({ ...body(), language });
    await handleF8CodeDj(req, response);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.callLlmJson).not.toHaveBeenCalled();
  });
  it("rejects Python on a static hosting plan before spending", async () => {
    const { req, res, response } = request({ ...body(), language: "python" });
    await handleF8CodeDj(req, response);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(mocks.callLlmJson).not.toHaveBeenCalled();
  });
  it("refuses an otherwise valid model answer in a different selected language", async () => {
    sources[hostId]!.artifactContent = { sourceMvpPddArtifactId: mvpId, primary: { platform: "replit-deployments" } };
    const { req, res, response } = request({ ...body(), language: "python" });
    await handleF8CodeDj(req, response);
    expect(res.status).toHaveBeenCalledWith(502);
    expect(mocks.persistArtifact).not.toHaveBeenCalled();
  });
  it("uses exact PDD/Micro PDD/hosting sources and retains planning provenance without a passing gate", async () => {
    const { req, res, response } = request({ ...body(), microPddArtifactId: microId });
    await handleF8CodeDj(req, response);
    const prompt = mocks.callLlmJson.mock.calls[0]![2];
    expect(prompt).toContain("Reporting scope");
    expect(prompt).toContain("Reporting contracts");
    expect(prompt).toContain("AZURE::AZURE_CONTAINER_APPS");
    const saved = mocks.persistArtifact.mock.calls[0]![0];
    expect(saved.artifactContent).toMatchObject({
      sourceMvpPddArtifactId: mvpId, sourcePddArtifactId: pddId,
      sourceMicroPddArtifactId: microId, sourceHostingPlanArtifactId: hostId,
      conversionProtocol: { independentCertification: false },
      implementationPath: { recommendedHost: "cloudflare-pages", advisoryOnly: true },
      collaboration: { reviewStatus: "MODEL_REVIEW_NOT_INDEPENDENT", dj: [{ requirement: "Reporting", files: ["src/main.jsx"] }] },
    });
    expect(saved.spartanCert).toBeUndefined();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ artifactId: "saved-bundle" }));
  });
  it("requires a source-bound software hosting plan before any code call", async () => {
    const { req, res, response } = request({ ...body(), hostingPlanArtifactId: undefined });
    await handleF8CodeDj(req, response);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(mocks.callLlmJson).not.toHaveBeenCalled();
  });
  it("rejects foreign Micro PDD context before spending", async () => {
    sources[microId]!.sessionId = "foreign-session";
    const { req, res, response } = request({ ...body(), microPddArtifactId: microId });
    await handleF8CodeDj(req, response);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mocks.callLlmJson).not.toHaveBeenCalled();
  });
  it("rejects a hosting plan tied to another source", async () => {
    sources[hostId]!.artifactContent = { sourceMvpPddArtifactId: "another-mvp" };
    const { req, res, response } = request(body());
    await handleF8CodeDj(req, response);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(mocks.callLlmJson).not.toHaveBeenCalled();
  });
  it("does not bypass a failed drift gate", async () => {
    mocks.latestPfpForMvp.mockResolvedValue({ counts: { critical: 1 }, fci: 20, verdict: "fail" });
    const { req, res, response } = request(body());
    await handleF8CodeDj(req, response);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(mocks.callLlmJson).not.toHaveBeenCalled();
  });
  it("rejects conflicting platform metadata instead of silently relabeling files", async () => {
    const { req, res, response } = request({ ...body(), platform: "express-replit" });
    await handleF8CodeDj(req, response);
    expect(res.status).toHaveBeenCalledWith(502);
    expect(mocks.persistArtifact).not.toHaveBeenCalled();
  });
  it("uses collaborating roles in the single existing provider call, not independent executions", async () => {
    const { req, response } = request(body());
    await handleF8CodeDj(req, response);
    expect(mocks.callLlmJson).toHaveBeenCalledOnce();
    expect(mocks.callLlmJson.mock.calls[0]![1]).toContain("use CODE ORACLE");
    expect(mocks.callLlmJson.mock.calls[0]![1]).toContain("Have CODE DJ revise");
  });
  it("rejects an oracle gap without a matching CODE DJ implementation", async () => {
    const out = output();
    out.collaboration.dj = [];
    mocks.callLlmJson.mockResolvedValue(out);
    const { req, res, response } = request(body());
    await handleF8CodeDj(req, response);
    expect(res.status).toHaveBeenCalledWith(502);
    expect(mocks.persistArtifact).not.toHaveBeenCalled();
  });
  it("rejects CODE DJ references to files not actually generated", async () => {
    const out = output();
    out.collaboration.dj[0]!.files = ["missing-route.ts"];
    mocks.callLlmJson.mockResolvedValue(out);
    const { req, res, response } = request(body());
    await handleF8CodeDj(req, response);
    expect(res.status).toHaveBeenCalledWith(502);
    expect(mocks.persistArtifact).not.toHaveBeenCalled();
  });
  it("stops when an omission requires a source decision rather than inventing requirements", async () => {
    const out = output();
    out.collaboration.oracle[0]!.resolution = "NEEDS_SOURCE_DECISION";
    out.collaboration.dj = [];
    mocks.callLlmJson.mockResolvedValue(out);
    const { req, res, response } = request(body());
    await handleF8CodeDj(req, response);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: "CODE_ORACLE_SOURCE_DECISION_REQUIRED",
      error: expect.stringContaining("Reporting"),
    }));
    expect(mocks.persistArtifact).not.toHaveBeenCalled();
  });
});

describe("platform-neutral F4 contract", () => {
  it("does not pass legacy target-VIBE instructions into the prompt", async () => {
    sources[microId]!.artifactType = "ATOMIC_PROMPT";
    mocks.callLlmJson.mockResolvedValue({ cheatSheet: "Scope", worksheet: "Contract", buildLaunch: "Acceptance", interfaceContract: "Shapes" });
    const { req, response } = request({ sessionId, sourceArtifactId: microId,
      targetVibe: "Legacy forced stack", colonizationTarget: "SLACK::SLACK_AGENT" });
    await handleF4(req, response);
    expect(mocks.callLlmJson.mock.calls[0]![2]).not.toContain("Legacy forced stack");
    expect(mocks.persistArtifact.mock.calls[0]![0].artifactContent.colonizationTarget).toBe("SLACK::SLACK_AGENT");
  });
});
