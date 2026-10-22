import { beforeEach, describe, expect, it, vi } from "vitest";
import { callLlmJson } from "../../engines/shared";
import { normaliseDocument, publishRequest } from "./imprima-model";
import { reviewInternalDocument } from "./internal-editorial";
import { internalEvaluation } from "./internal-evaluation";

vi.mock("../../engines/shared", () => ({ callLlmJson: vi.fn() }));
// Adapter contract tests stay pure; durable database checkpoints have their
// own integration suite with real owner IDs.
vi.mock("./internal-review-recovery", async () => {
  const shared = await import("../../engines/shared");
  return { recoverableInternalReview: shared.callLlmJson };
});
const context = { userId: "fixture", sessionId: "fixture-session", engineId: -201 };
const config = publishRequest.parse({ title: "Example", project: "Demo", author: "Human Author", authorIsHuman: true, formats: ["HTML"] });
const source = { text: "This document explains the proposed workflow for a demonstration." };
const makeDocument = () => normaliseDocument("F5_SPC", "source", source, config);
const clear = { verdict: "CLEAR", flags: [], rationale: "No unsupported material claims detected." };
beforeEach(() => vi.mocked(callLlmJson).mockReset());
describe("IMPRIMA Internal editorial adapters", () => {
  it("runs both tracked adapters, applies clarity edits and binds the review", async () => {
    const document = makeDocument();
    const editable = document.blocks.find(b => !b.protected && b.type === "paragraph")!;
    expect(editable).toBeDefined();
    vi.mocked(callLlmJson).mockResolvedValueOnce({ edits: [{ blockId: editable.id, text: "This document describes the proposed demonstration workflow." }], clarity: 86, summary: null, glossary: [] }).mockResolvedValueOnce(clear);
    const result = await reviewInternalDocument(document, context);
    expect(result.cdm.blocks.find(b => b.id === editable.id)?.text).toBe("This document describes the proposed demonstration workflow.");
    expect(result.evidence).toMatchObject({ clarity: 86, review: clear, releaseAllowed: false, independentVerification: "NOT_RUN" });
    expect(callLlmJson).toHaveBeenNthCalledWith(1, "claude", expect.stringContaining("KLARITY"), expect.any(String), expect.anything(), { ...context, engineId: -201 });
    expect(callLlmJson).toHaveBeenNthCalledWith(2, "claude", expect.stringContaining("SOCRATES"), expect.stringContaining("proposed demonstration workflow"), expect.anything(), { ...context, engineId: -202 });
    const report = internalEvaluation({ kind: "imprima", source, sourceHash: document.sourceHash, scores: { jcseScore: 50, mathmonScore: 90 }, assessedAt: new Date(), editorial: result.evidence });
    expect(report.state).toBe("PASS");
    expect(report.releaseAllowed).toBe(false);
    expect(report.editorialEvidence).toMatchObject({ sourceHash: document.sourceHash, changes: result.evidence.changes });
  });
  it("rejects protected edits before SOCRATES", async () => {
    vi.mocked(callLlmJson).mockResolvedValueOnce({ edits: [{ blockId: "unknown", text: "Replacement" }], clarity: 90, summary: null, glossary: [] });
    await expect(reviewInternalDocument(makeDocument(), context)).rejects.toThrow("protected, duplicate or unknown");
    expect(callLlmJson).toHaveBeenCalledTimes(1);
  });
  it("does not invent a clarity score when no editable prose exists", async () => {
    const document = makeDocument();
    document.blocks = document.blocks.map(b => ({ ...b, protected: true }));
    vi.mocked(callLlmJson).mockResolvedValueOnce(clear);
    const { evidence } = await reviewInternalDocument(document, context);
    expect(evidence.clarity).toBeNull();
    expect(callLlmJson).toHaveBeenCalledTimes(1);
    expect(vi.mocked(callLlmJson).mock.calls[0]?.[4]?.engineId).toBe(-202);
  });
  it("retains material flags as HOLD even if the model returns CLEAR", async () => {
    vi.mocked(callLlmJson).mockResolvedValueOnce({ edits: [], clarity: 60, summary: null, glossary: [] }).mockResolvedValueOnce({
      ...clear, flags: [{ id: "claim", severity: "HIGH", claim: "Certified", question: "Evidence?" }],
    });
    const { evidence } = await reviewInternalDocument(makeDocument(), context);
    expect(evidence.review.verdict).toBe("HOLD");
    const report = internalEvaluation({ kind: "imprima", source, sourceHash: evidence.sourceHash, scores: { jcseScore: 50, mathmonScore: 90 }, assessedAt: new Date(), editorial: evidence });
    expect(report.state).toBe("FAIL");
    expect(report.releaseAllowed).toBe(false);
  });
  it("stops if a provider or budget fails, without calling the next adapter", async () => {
    vi.mocked(callLlmJson).mockRejectedValueOnce(new Error("budget denied"));
    await expect(reviewInternalDocument(makeDocument(), context)).rejects.toThrow("budget denied");
    expect(callLlmJson).toHaveBeenCalledTimes(1);
  });
  it("rejects oversized documents before model dispatch", async () => {
    const document = normaliseDocument("F5_SPC", "source", { text: "prose ".repeat(6000) }, config);
    await expect(reviewInternalDocument(document, context)).rejects.toThrow("30 KB");
    expect(callLlmJson).not.toHaveBeenCalled();
  });
});
