// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route } from "wouter";

vi.mock("@/components/layout/TopNav", () => ({ TopNav: () => null }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import SpcPlayerDetail from "./spc-player/detail";

const RUN_ID = "run-123";

const MOCK_RUN = {
  id: RUN_ID,
  ownerUserId: "user-1",
  title: "Test SPC Player Run",
  brief: "This is a test brief.",
  selectedCardIds: ["card-1", "card-2"],
  profile: "full",
  status: "DRAFT",
  executionState: "IDLE",
  canExecute: true,
  retryAvailableAt: null,
  governance: {
    specVersion: "v4.0",
    source: "user-authorized REVERB v3 derivation (conservative generic SPC Player adaptation)",
    scorePolicy: { axes: ["clarity", "truthfulness", "detectability"] },
  },
  stageResults: [],
  executionAdvisory: null,
  governanceEvaluation: null,
  distributionPlan: { status: "plan_only", connectorInvoked: false, externalSend: false },
  error: null,
  transitions: [],
  completedAt: null,
  outputPackage: null,
  createdAt: "2026-07-01T09:00:00.000Z",
  updatedAt: "2026-07-01T09:00:00.000Z",
};

const MOCK_DEV_KIT = {
  id: "dk-1",
  name: "SPC Dev Kit",
  cardIds: ["card-1", "card-2", "card-3", "card-4", "card-5", "card-6"],
  cards: [],
  registrationNote: "Registration does not execute the Dev Kit.",
  executes: false,
};

const MOCK_CATALOG = [
  { id: "card-1", slug: "card-one", name: "Card One", provenance: { source: "v4", version: "v4.0", status: "PRE_BUILD" }, status: "PRE_BUILD", preBuild: true, cheatSheetPublished: false, cheatSheet: null, thirdPartyDefinitions: null },
  { id: "card-2", slug: "card-two", name: "Card Two", provenance: { source: "v4", version: "v4.0", status: "PRE_BUILD" }, status: "PRE_BUILD", preBuild: true, cheatSheetPublished: false, cheatSheet: null, thirdPartyDefinitions: null },
];

const MOCK_AUTHORIZATION = {
  connector: "webhook",
  endpoint: "https://example.com/spc-player",
  authorizedAt: "2026-07-01T09:01:00.000Z",
};

const MOCK_DELIVERY = {
  runId: RUN_ID,
  connector: "webhook",
  deliveredAt: "2026-07-01T09:02:00.000Z",
  statusCode: 202,
};

const MOCK_COMPLETED_RUN = {
  ...MOCK_RUN,
  status: "COMPLETED",
  executionState: "FINISHED",
  canExecute: false,
  stageResults: [
    { stageIndex: 0, cardId: "card-1", cardSlug: "card-one", invoked: true, verdict: "READY", content: "Stage output", evidence: ["evidence"], completedAt: "2026-07-01T09:01:00.000Z" },
  ],
  executionAdvisory: {
    authority: "user-authorized REVERB v3 derivation",
    status: "PRE_BUILD",
    profile: "full",
    invokedStages: [0],
    governanceEvaluationInvoked: true,
    evidenceTrail: ["evidence"],
    distribution: "plan-only; no connector invoked",
  },
  governanceEvaluation: {
    kind: "governance_evaluation",
    invoked: true,
    verdict: "PASS",
    content: "Governance output",
    evidence: ["governance evidence"],
    scores: { clarity: 80, truthfulness: 90, detectability: 70 },
    completedAt: "2026-07-01T09:01:30.000Z",
  },
  transitions: [
    { from: "DRAFT", to: "RUNNING", at: "2026-07-01T09:00:01.000Z" },
    { from: "RUNNING", to: "COMPLETED", at: "2026-07-01T09:01:00.000Z" },
  ],
  completedAt: "2026-07-01T09:01:00.000Z",
  outputPackage: {
    packageVersion: "spc-player-output-v1",
    connector: "download",
    action: "execute",
    format: "json",
    runMetadata: { runId: RUN_ID },
    content: [],
    governanceEvaluation: {
      kind: "governance_evaluation",
      invoked: true,
      verdict: "PASS",
      content: "Governance output",
      evidence: ["governance evidence"],
      scores: { clarity: 80, truthfulness: 90, detectability: 70 },
      completedAt: "2026-07-01T09:01:30.000Z",
    },
    advisory: {
      authority: "user-authorized REVERB v3 derivation",
      status: "PRE_BUILD",
      profile: "full",
      invokedStages: [0],
      governanceEvaluationInvoked: true,
      evidenceTrail: ["evidence"],
      distribution: "plan-only; no connector invoked",
    },
    scores: { clarity: 8, truthfulness: 9, detectability: 7 },
    distributionPlan: { status: "plan_only", connectorInvoked: false, externalSend: false },
  },
};

const MOCK_FAILED_RUN = {
  ...MOCK_RUN,
  status: "FAILED",
  error: "Stage 2 failed to produce a retained result.",
  transitions: [
    { from: "DRAFT", to: "RUNNING", at: "2026-07-01T09:00:01.000Z" },
    { from: "RUNNING", to: "FAILED", at: "2026-07-01T09:00:10.000Z", reason: "stage failure" },
  ],
};

function jsonResponse(data: unknown, status = 200) {
  const bodyText = JSON.stringify(data);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    url: "",
    body: {},
    headers: new Headers({ "content-type": "application/json" }),
    text: async () => bodyText,
    json: async () => data,
    blob: async () => new Blob([bodyText], { type: "application/json" }),
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;
let executeCount = 0;
let failFirstExecution = false;
let currentRun: typeof MOCK_RUN | typeof MOCK_COMPLETED_RUN = MOCK_RUN;

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Router hook={() => [`/spc-player/${RUN_ID}`, vi.fn()]}>
        <Route path="/spc-player/:id" component={SpcPlayerDetail} />
      </Router>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  executeCount = 0;
  failFirstExecution = false;
  currentRun = MOCK_RUN;
  fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : (input as Request).url ?? String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      const runUrl = `/api/spc-player/runs/${RUN_ID}`;

      if (url.includes(`${runUrl}/execute`) && method === "POST") {
        executeCount += 1;
        return jsonResponse(failFirstExecution && executeCount === 1 ? MOCK_FAILED_RUN : MOCK_COMPLETED_RUN);
      }
      if (url.includes(`${runUrl}/authorize`) && method === "POST") {
        return jsonResponse(MOCK_AUTHORIZATION);
      }
      if (url.includes(`${runUrl}/authorize`) && method === "GET") {
        return jsonResponse({ authorized: false, connector: "webhook", endpoint: null, authorizedAt: null });
      }
      if (url.includes(`${runUrl}/deliver`) && method === "POST") {
        return jsonResponse(MOCK_DELIVERY);
      }
      if (url.endsWith(runUrl) && method === "GET") {
        return jsonResponse(currentRun);
      }
      if (url.includes("/api/spc-player/dev-kit") && method === "GET") {
        return jsonResponse(MOCK_DEV_KIT);
      }
      if (url.includes("/api/spc-player/catalog") && method === "GET") {
        return jsonResponse(MOCK_CATALOG);
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    },
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  vi.spyOn(window, "open").mockImplementation(() => null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SpcPlayerDetail", () => {
  it("renders execution progress, the final package, and authorized delivery", async () => {
    renderPage();

    const executeButton = await screen.findByTestId("button-execute");
    expect(screen.getByText("Test SPC Player Run")).toBeTruthy();
    expect(screen.getByText("This is a test brief.")).toBeTruthy();
    expect(screen.getByTestId("selected-card-card-1")).toBeTruthy();
    expect(screen.getByTestId("selected-card-card-2")).toBeTruthy();
    expect(screen.queryByText(/deferred/i)).toBeNull();
    expect(screen.queryByText(/draft metadata|not final output/i)).toBeNull();
    expect(screen.queryByText(/composite/i)).toBeNull();
    expect(screen.queryByTestId("button-download-package")).toBeNull();

    fireEvent.click(executeButton);
    await waitFor(() => {
      const executeCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/execute"));
      expect(executeCall).toBeTruthy();
      expect(executeCall?.[1]?.body).toBeUndefined();
    });

    expect(await screen.findByTestId("execution-result")).toBeTruthy();
    expect(screen.getByTestId("stage-result-0")).toBeTruthy();
    expect(screen.getAllByText(/user-authorized REVERB v3 derivation/).length).toBeGreaterThan(0);
    expect(await screen.findByTestId("button-download-package")).toBeTruthy();
    expect(screen.getByTestId("score-clarity").textContent).toContain("8");
    expect(screen.getByTestId("score-truthfulness").textContent).toContain("9");
    expect(screen.getByTestId("score-detectability").textContent).toContain("7");

    fireEvent.click(screen.getByTestId("button-download-package"));
    expect(window.open).toHaveBeenCalledWith(
      `/api/spc-player/runs/${RUN_ID}/download`,
      "_blank",
      "noopener,noreferrer",
    );

    fireEvent.change(screen.getByTestId("input-webhook-endpoint"), { target: { value: MOCK_AUTHORIZATION.endpoint } });
    fireEvent.click(screen.getByTestId("button-authorize-webhook"));
    await waitFor(() => {
      const authorizationCall = fetchMock.mock.calls.find(
        (call) => String(call[0]).includes("/authorize") && (call[1]?.method ?? "GET").toUpperCase() === "POST",
      );
      expect(authorizationCall).toBeTruthy();
      expect(JSON.parse(authorizationCall?.[1]?.body as string)).toEqual({ endpoint: MOCK_AUTHORIZATION.endpoint });
    });
    expect((await screen.findByTestId("webhook-authorization-status")).textContent).toContain(MOCK_AUTHORIZATION.endpoint);

    fireEvent.click(screen.getByTestId("button-deliver-webhook"));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/deliver"))).toBe(true);
    });
    expect(await screen.findByText(/Delivered to the authorized endpoint/)).toBeTruthy();
  });

  it("surfaces a persisted failure and allows a retry", async () => {
    failFirstExecution = true;
    renderPage();

    fireEvent.click(await screen.findByTestId("button-execute"));
    expect((await screen.findByTestId("execution-error")).textContent).toContain("Stage 2 failed");
    expect(screen.getByTestId("button-execute").textContent).toContain("Retry Run");

    fireEvent.click(screen.getByTestId("button-execute"));
    expect(await screen.findByTestId("button-download-package")).toBeTruthy();
    expect(executeCount).toBe(2);
  });

  it("keeps Execute disabled while an active attempt owns the run", async () => {
    const retryAvailableAt = new Date(Date.now() + 60_000).toISOString();
    currentRun = {
      ...MOCK_RUN,
      status: "RUNNING",
      executionState: "ACTIVE",
      canExecute: false,
      retryAvailableAt,
    };
    renderPage();

    const executeButton = await screen.findByTestId("button-execute");
    expect((executeButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("retry-available-at").textContent).toMatch(/Retry available/);
    expect(screen.getByText(new Date(retryAvailableAt).toLocaleString())).toBeTruthy();
  });

  it.each([
    ["expired", new Date(Date.now() - 60_000).toISOString()],
    ["legacy", null],
  ])("allows retry for a %s interrupted attempt", async (_kind, retryAvailableAt) => {
    currentRun = {
      ...MOCK_RUN,
      status: "RUNNING",
      executionState: "RECOVERABLE",
      canExecute: true,
      retryAvailableAt,
    };
    renderPage();

    const executeButton = await screen.findByTestId("button-execute");
    expect((executeButton as HTMLButtonElement).disabled).toBe(false);
    expect(executeButton.textContent).toMatch(/Retry Run/);
    expect(screen.getByTestId("retry-available-now")).toBeTruthy();
  });
});