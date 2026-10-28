// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

vi.mock("@/components/layout/TopNav", () => ({ TopNav: () => null }));
vi.mock("@/pages/ingest", () => ({ default: ({ embedded }: { embedded?: boolean }) => <div data-testid="mock-ingest">{String(embedded)}</div> }));
vi.mock("@/pages/cartridge", () => ({ default: ({ embedded }: { embedded?: boolean }) => <div data-testid="mock-cartridge">{String(embedded)}</div> }));
vi.mock("@/components/shared/StageSupportReturn", () => ({
  useStageSupportCase: () => ({ caseId: "", resultId: "", departure: m.departure, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  StageSupportBanner: () => null, StageSupportReturnAction: ({ resultId, blockedReason }: { resultId: string; blockedReason?: string | null }) => <span data-testid="mock-return">{resultId}|{blockedReason ?? ""}</span>,
}));
const m = vi.hoisted(() => ({
  portal: { emailConfigured: true, storageConfigured: true, subscriberEmailAvailable: true, sources: [] as unknown[], publications: [] as unknown[] },
  create: vi.fn(), f4: vi.fn(), run: vi.fn(), pub: vi.fn(), code: vi.fn(), dl: vi.fn(),
  agents: [] as unknown[], agent: null as unknown, runs: [] as unknown[], departure: null as unknown,
}));
const q = (data: unknown) => ({ data, isLoading: false, isError: false, refetch: vi.fn() });
const mut = (fn: unknown) => ({ mutateAsync: fn, isPending: false });
vi.mock("@workspace/api-client-react", () => ({
  getGetImprimaPortalQueryKey: () => ["p"], getListCreatedAgentsQueryKey: () => ["a"],
  getGetCreatedAgentQueryKey: (id: string) => ["a", id], getListCreatedAgentRunsQueryKey: (id: string) => ["r", id],
  useGetImprimaPortal: () => q(m.portal), useListCreatedAgents: () => q(m.agents),
  useGetCreatedAgent: () => q(m.agent), useListCreatedAgentRuns: () => q(m.runs),
  useCreateGovernedAgent: () => mut(m.create), useHarnessF4: () => mut(m.f4), useRunCreatedAgent: () => mut(m.run),
  useCreatePortalPublication: () => mut(m.pub), useRequestPublicationCode: () => mut(m.code), useDownloadPortalPublication: () => mut(m.dl),
}));
import AgentCreator from "./agent-creator";
import ImprimaPortal from "./imprima-portal";

function renderAt(path: string, C: () => JSX.Element) {
  const { hook, searchHook } = memoryLocation({ path });
  return render(<QueryClientProvider client={new QueryClient()}><Router hook={hook} searchHook={searchHook}><C /></Router></QueryClientProvider>);
}
const MA = { id: "ma-1", sourceType: "ARTIFACT", type: "MA_BIRTH_PACKAGE", title: "Arch", sessionId: "s1" };
const PUB = { id: "pub-1", sourceId: "ma-1", sourceType: "ARTIFACT", title: "Doc", author: "Ada", format: "PDF", state: "READY", filename: "doc.pdf", createdAt: "2026-01-01" };

beforeEach(() => { vi.clearAllMocks(); m.portal = { emailConfigured: true, storageConfigured: true, subscriberEmailAvailable: true, sources: [MA], publications: [PUB] }; m.agents = []; m.agent = null; m.runs = []; m.departure = null; });
afterEach(cleanup);

describe("Agent Creator", () => {
  it("offers F4 conversion for an unpaired MA only after cost acceptance, then creates with the Micro PDD", async () => {
    m.f4.mockResolvedValue({ artifactId: "mp-9" });
    m.create.mockResolvedValue({ id: "ag-1" });
    renderAt("/agent-creator", AgentCreator);
    fireEvent.change(screen.getByTestId("select-agent-source"), { target: { value: "ma-1" } });
    expect((screen.getByTestId("button-create-agent") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("button-run-f4") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("check-f4-cost"));
    fireEvent.click(screen.getByTestId("button-run-f4"));
    await waitFor(() => expect(m.f4).toHaveBeenCalledWith({ data: { sessionId: "s1", sourceArtifactId: "ma-1" } }));
    await waitFor(() => expect((screen.getByTestId("button-create-agent") as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId("button-create-agent"));
    await waitFor(() => expect(m.create).toHaveBeenCalledTimes(1));
    const arg = m.create.mock.calls[0][0].data;
    expect(arg.sourceArtifactId).toBe("ma-1"); expect(arg.microPddArtifactId).toBe("mp-9"); expect(arg.requestKey).toBeTruthy();
  });
  it("lists only companions whose parentSourceArtifactId is the selected MA", () => {
    m.portal.sources = [MA, { ...MA, id: "ma-2", title: "Other MA" },
      { id: "mp-1", sourceType: "ARTIFACT", type: "MICRO_PDD", title: "Exact", sessionId: "s1", parentSourceArtifactId: "ma-1" },
      { id: "mp-2", sourceType: "ARTIFACT", type: "MICRO_PDD", title: "Sibling", sessionId: "s1", parentSourceArtifactId: "ma-2" }];
    renderAt("/agent-creator", AgentCreator);
    fireEvent.change(screen.getByTestId("select-agent-source"), { target: { value: "ma-1" } });
    const opts = Array.from((screen.getByTestId("select-agent-micro") as HTMLSelectElement).options).map((o) => o.value);
    expect(opts).toEqual(["", "mp-1"]);
    expect(screen.queryByTestId("panel-f4-offer")).toBeNull();
  });
  it("an F4 departure with a Micro PDD source selects its parent MA and keeps that exact Micro", async () => {
    m.portal.sources = [MA, { id: "mp-1", sourceType: "ARTIFACT", type: "MICRO_PDD", title: "Exact", sessionId: "s1", parentSourceArtifactId: "ma-1" }];
    m.departure = { caseId: "c1", tool: "agent-creator", sourceId: "mp-1", sessionId: "s1", featureId: 4, stageLabel: "F4" };
    m.create.mockResolvedValue({ id: "ag-1" });
    renderAt("/agent-creator?supportCaseId=c1", AgentCreator);
    await waitFor(() => expect((screen.getByTestId("select-agent-source") as HTMLSelectElement).value).toBe("ma-1"));
    expect((screen.getByTestId("select-agent-micro") as HTMLSelectElement).value).toBe("mp-1");
    fireEvent.click(screen.getByTestId("button-create-agent"));
    await waitFor(() => expect(m.create.mock.calls[0][0].data).toMatchObject({ sourceArtifactId: "ma-1", microPddArtifactId: "mp-1" }));
  });
  it("warns when protected sources are unavailable instead of claiming an empty library", () => {
    m.portal.sources = []; (m.portal as Record<string, unknown>).protectedSourcesStatus = "UNAVAILABLE_PROTECTED_WORKFLOWS";
    renderAt("/agent-creator", AgentCreator);
    expect(screen.getByTestId("text-agent-sources-unavailable")).toBeTruthy();
    expect(screen.queryByTestId("text-no-agent-sources")).toBeNull();
  });
  it("keeps the MA selected and does not retry when F4 fails", async () => {
    m.f4.mockRejectedValue(new Error("boom"));
    renderAt("/agent-creator", AgentCreator);
    fireEvent.change(screen.getByTestId("select-agent-source"), { target: { value: "ma-1" } });
    fireEvent.click(screen.getByTestId("check-f4-cost"));
    fireEvent.click(screen.getByTestId("button-run-f4"));
    expect((await screen.findByTestId("text-f4-error")).textContent).toContain("ma-1".slice(0, 8));
    expect(m.f4).toHaveBeenCalledTimes(1);
    expect((screen.getByTestId("select-agent-source") as HTMLSelectElement).value).toBe("ma-1");
  });
  it("reuses the same request key on a manual retry after failure", async () => {
    m.portal.sources = [{ ...MA, id: "spc-1", type: "SPC" }];
    m.create.mockRejectedValueOnce(new Error("x")).mockResolvedValueOnce({ id: "ag" });
    renderAt("/agent-creator", AgentCreator);
    fireEvent.change(screen.getByTestId("select-agent-source"), { target: { value: "spc-1" } });
    fireEvent.click(screen.getByTestId("button-create-agent"));
    await screen.findByTestId("text-create-error");
    fireEvent.click(screen.getByTestId("button-create-agent"));
    await waitFor(() => expect(m.create).toHaveBeenCalledTimes(2));
    expect(m.create.mock.calls[0][0].data.requestKey).toBe(m.create.mock.calls[1][0].data.requestKey);
  });
  it("runs an ACTIVE agent text-only and shows evaluation basis and history", async () => {
    m.agent = { id: "ag", sessionId: "s1", sourceArtifactId: "ma-1", state: "ACTIVE", title: "Bot", createdAt: "2026", evaluation: { basis: "INTERNAL_MODEL_ASSESSED", jcse: 81.4, mathmon: 77.2, eligible: true, blocks: [] } };
    m.runs = [{ id: "r1", agentId: "ag", state: "COMPLETED", input: "hi", output: "hello", createdAt: "2026-01-01" }];
    m.run.mockResolvedValue({});
    renderAt("/agent-creator?agentId=ag", AgentCreator);
    expect((screen.getByTestId("panel-evaluation")).textContent).toContain("INTERNAL MODEL ASSESSED");
    expect((screen.getByTestId("row-run-r1")).textContent).toContain("hello");
    expect((screen.getAllByTestId("text-runtime-disclosure")[0]).textContent).toContain("not independent certification");
    fireEvent.change(screen.getByTestId("input-agent-run"), { target: { value: "question" } });
    fireEvent.click(screen.getByTestId("button-run-agent"));
    await waitFor(() => expect(m.run).toHaveBeenCalledWith({ agentId: "ag", data: { input: "question", requestKey: expect.any(String) } }));
  });
});

describe("IMPRIMA Portal", () => {
  it("disables code requests honestly when email is not configured", () => {
    m.portal.emailConfigured = false;
    renderAt("/imprima-portal", ImprimaPortal);
    expect((screen.getByTestId("button-request-code-pub-1") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("text-email-blocked-pub-1")).textContent).toContain("not configured");
    expect(screen.getByTestId("text-portal-partial")).toBeTruthy();
  });
  it("prepares a publication from a preselected source after rights confirmation", async () => {
    m.pub.mockResolvedValue({});
    renderAt("/imprima-portal?sourceId=ma-1&sourceType=ARTIFACT", ImprimaPortal);
    fireEvent.change(screen.getByTestId("input-portal-author"), { target: { value: "Ada" } });
    expect((screen.getByTestId("button-prepare-publication") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("check-portal-rights"));
    fireEvent.click(screen.getByTestId("button-prepare-publication"));
    await waitFor(() => expect(m.pub).toHaveBeenCalledWith({ data: { sourceId: "ma-1", sourceType: "ARTIFACT", format: "PDF", author: "Ada", rightsConfirmed: true } }));
  });
  it("requests a code then downloads with challenge and code", async () => {
    m.code.mockResolvedValue({ challengeId: "ch-1", expiresAt: "2026-01-01T00:10:00Z" });
    m.dl.mockResolvedValue(new Blob(["x"]));
    URL.createObjectURL = vi.fn(() => "blob:x"); URL.revokeObjectURL = vi.fn();
    renderAt("/imprima-portal", ImprimaPortal);
    fireEvent.click(screen.getByTestId("button-request-code-pub-1"));
    expect((await screen.findByTestId("text-publication-msg-pub-1")).textContent).toContain("provider accepted");
    fireEvent.change(screen.getByTestId("input-code-pub-1"), { target: { value: "123456" } });
    fireEvent.click(screen.getByTestId("button-download-pub-1"));
    await waitFor(() => expect(m.dl).toHaveBeenCalledWith({ publicationId: "pub-1", data: { challengeId: "ch-1", code: "123456" } }));
  });
  it("embeds the intake forms inside the portal", async () => {
    renderAt("/imprima-portal?tab=intake&intake=cartridge&supportCaseId=abc", ImprimaPortal);
    expect((await screen.findByTestId("mock-cartridge")).textContent).toBe("true");
    fireEvent.click(screen.getByTestId("tab-intake-ingest"));
    expect((await screen.findByTestId("mock-ingest")).textContent).toBe("true");
  });
  it("only READY publications allow a code request", () => {
    m.portal.publications = [{ ...PUB, id: "pub-2", state: "PREPARED" }];
    renderAt("/imprima-portal", ImprimaPortal);
    expect((screen.getByTestId("button-request-code-pub-2") as HTMLButtonElement).disabled).toBe(true);
  });
  it("allows URL-bound known types before listing and shows the selected ID and type", async () => {
    m.pub.mockResolvedValue({});
    renderAt("/imprima-portal?sourceId=run-1&sourceType=SPC_PLAYER", ImprimaPortal);
    expect(screen.getByTestId("text-selected-source").textContent).toContain("SPC_PLAYER · run-1");
    fireEvent.change(screen.getByTestId("input-portal-author"), { target: { value: "Ada" } });
    fireEvent.click(screen.getByTestId("check-portal-rights"));
    fireEvent.click(screen.getByTestId("button-prepare-publication"));
    await waitFor(() => expect(m.pub).toHaveBeenCalledWith({ data: { sourceId: "run-1", sourceType: "SPC_PLAYER", format: "PDF", author: "Ada", rightsConfirmed: true } }));
  });
  it("forces EDITABLE_ZIP for F10 exports and sends parsed exportOptions", async () => {
    m.pub.mockResolvedValue({});
    const opts = encodeURIComponent(JSON.stringify({ sourceArtifactId: "b1", outputKind: "CODE_DJ", family: "VIBE_APP", target: "Replit Agent", deliveryMode: "EXPORT" }));
    renderAt(`/imprima-portal?sourceId=b1&sourceType=F10_EXPORT&exportOptions=${opts}`, ImprimaPortal);
    expect((screen.getByTestId("select-portal-format") as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByTestId("text-export-options").textContent).toContain("target=Replit Agent");
    fireEvent.change(screen.getByTestId("input-portal-author"), { target: { value: "Ada" } });
    fireEvent.click(screen.getByTestId("check-portal-rights"));
    fireEvent.click(screen.getByTestId("button-prepare-publication"));
    await waitFor(() => expect(m.pub).toHaveBeenCalledWith({ data: expect.objectContaining({ sourceType: "F10_EXPORT", format: "EDITABLE_ZIP", exportOptions: expect.objectContaining({ family: "VIBE_APP" }) }) }));
  });
  it("ignores non-object exportOptions and sends parentId/kind for preparation files", async () => {
    m.pub.mockResolvedValue({});
    renderAt("/imprima-portal?sourceId=f1&sourceType=PREPARATION_FILE&parentId=p1&kind=imprima&exportOptions=%5B1%5D", ImprimaPortal);
    expect(screen.queryByTestId("text-export-options")).toBeNull();
    fireEvent.change(screen.getByTestId("input-portal-author"), { target: { value: "Ada" } });
    fireEvent.click(screen.getByTestId("check-portal-rights"));
    fireEvent.click(screen.getByTestId("button-prepare-publication"));
    await waitFor(() => expect(m.pub).toHaveBeenCalledWith({ data: { sourceId: "f1", sourceType: "PREPARATION_FILE", format: "EDITABLE_ZIP", author: "Ada", rightsConfirmed: true, parentId: "p1", kind: "imprima" } }));
  });
  it("offers a real stage return bound to the departure source with the publication ID", () => {
    m.departure = { caseId: "c1", tool: "imprima", sourceId: "ma-1", sessionId: "s1", featureId: 4, stageLabel: "F4" };
    renderAt("/imprima-portal?supportCaseId=c1", ImprimaPortal);
    expect(screen.getByTestId("mock-return").textContent).toBe("pub-1|");
  });
  it("embeds the Exemplar Library upload in the library intake tab", async () => {
    renderAt("/imprima-portal?tab=intake&intake=library", ImprimaPortal);
    expect(await screen.findByTestId("panel-library-intake")).toBeTruthy();
    expect(await screen.findByTestId("upload-bar-embedded")).toBeTruthy();
    expect(screen.getByTestId("button-upload-file")).toBeTruthy();
  });
  it("shows a protected-sources warning on the portal", () => {
    (m.portal as Record<string, unknown>).protectedSourcesStatus = "UNAVAILABLE_PROTECTED_WORKFLOWS";
    renderAt("/imprima-portal", ImprimaPortal);
    expect(screen.getByTestId("text-protected-sources-unavailable").textContent).toContain("does not mean you have no sources");
  });
  it("rejects unknown URL source types", () => {
    renderAt("/imprima-portal?sourceId=x1&sourceType=BOGUS", ImprimaPortal);
    expect(screen.getByTestId("text-source-unlisted")).toBeTruthy();
    expect((screen.getByTestId("button-prepare-publication") as HTMLButtonElement).disabled).toBe(true);
  });
});
