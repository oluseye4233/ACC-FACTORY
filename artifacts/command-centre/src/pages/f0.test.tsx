// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------- mocks ----------
// This suite exercises the REAL F0Dashboard page and its REAL MonitoringBanner
// together with the REAL generated react-query hooks (useGetF0Dashboard +
// useAcknowledgeF0MonitoringAlert). Only the network boundary (global fetch) and
// the page chrome / toast are stubbed, so the behaviour under test is the true
// acknowledge → invalidateQueries → refetch cycle — i.e. dismissing a flagged
// retainer clears the banner and updates the open-alert count WITHOUT a reload.

vi.mock("@/components/layout/TopNav", () => ({ TopNav: () => null }));
vi.mock("@/components/boomerang", () => ({
  BoomerangPanel: () => <div data-testid="mock-boomerang-f0" />,
}));
vi.mock("@/components/layout/Footer", () => ({ Footer: () => null }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
const supportCase = vi.fn();
vi.mock("@/components/shared/StageSupportReturn", () => ({
  useStageSupportCase: () => supportCase(),
  StageSupportBanner: ({ caseId }: { caseId: string }) => (caseId ? <div data-testid="banner-stage-support" /> : null),
  StageSupportReturnAction: ({ resultId, departure }: { resultId: string; departure: { f0EngagementId: string } }) => (
    <div data-testid={`return-action-${resultId}`} data-eng={departure.f0EngagementId} />
  ),
}));
const NO_CASE = { caseId: "", resultId: "", departure: null, isLoading: false, isError: false, error: null, refetch: vi.fn() };

import F0Dashboard from "./f0";

const RETAINER_ID = "ret-1";
const RUN_ID = "run-1";
const RAN_AT = "2026-07-01T09:00:00.000Z";

const OPEN_ALERT = {
  id: RUN_ID,
  retainerId: RETAINER_ID,
  retainerTitle: "Acme Retainer",
  highestUrgency: "ACT_NOW",
  capiPosture: "DEFENSIVE",
  alertCount: 2,
  source: "cron",
  ranAt: RAN_AT,
};

const TOTALS = {
  engagementCount: 0,
  reportCount: 0,
  accruedReportCostUsd: "0",
  accruedTaskCostUsd: "0",
};

const dashboardWithAlert = {
  engagements: [],
  retainers: [],
  totals: TOTALS,
  monitoring: {
    lastRunAt: RAN_AT,
    openAlertCount: 1,
    openAlerts: [OPEN_ALERT],
    byRetainer: [{ retainerId: RETAINER_ID, lastRunAt: RAN_AT }],
  },
};

const dashboardCleared = {
  engagements: [],
  retainers: [],
  totals: TOTALS,
  monitoring: {
    lastRunAt: RAN_AT,
    openAlertCount: 0,
    openAlerts: [],
    byRetainer: [{ retainerId: RETAINER_ID, lastRunAt: RAN_AT }],
  },
};

// A minimal Response-like object covering every field customFetch reads. Built by
// hand (rather than the global `Response`) so the test doesn't depend on which
// fetch/Response polyfill the jsdom environment happens to expose.
function jsonResponse(data: unknown) {
  const bodyText = JSON.stringify(data);
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    url: "",
    body: {}, // non-null so customFetch's hasNoBody() returns false
    headers: new Headers({ "content-type": "application/json" }),
    text: async () => bodyText,
    json: async () => data,
    blob: async () => {
      throw new Error("blob not supported in test");
    },
  } as unknown as Response;
}

let acked = false;
let fetchMock: ReturnType<typeof vi.fn>;

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={qc}>
      <F0Dashboard />
    </QueryClientProvider>,
  );
}

let origins: Record<string, unknown> = {};
let engagements: Record<string, { engagement: Record<string, unknown>; reports: Record<string, unknown>[] }> = {};
beforeEach(() => {
  acked = false;
  engagements = {};
  origins = {};
  supportCase.mockReturnValue(NO_CASE);
  window.history.replaceState(null, "", "/f0");
  fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : (input as Request).url ?? String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/api/f0/dashboard")) {
        return jsonResponse(acked ? dashboardCleared : dashboardWithAlert);
      }
      if (
        method === "POST" &&
        url.includes(`/api/f0/retainers/${RETAINER_ID}/monitoring/${RUN_ID}/acknowledge`)
      ) {
        acked = true;
        return jsonResponse({ id: RUN_ID, acknowledgedAt: "2026-07-01T10:00:00.000Z" });
      }
      const o = url.match(/\/stage-support\/f0-origins\/([^/?]+)$/);
      if (o) return jsonResponse({ departure: origins[o[1]] ?? null });
      const m = url.match(/\/api\/f0\/engagements\/([^/?]+)$/);
      if (m && engagements[m[1]]) return jsonResponse(engagements[m[1]]);
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    },
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("F0 MonitoringBanner — acknowledge flow", () => {
  it("renders an open alert produced by a sweep", async () => {
    renderPage();

    // Banner appears once the dashboard query resolves.
    await screen.findByTestId("monitoring-banner");

    // The flagged retainer's open alert row and its ACK button are present.
    expect(await screen.findByTestId(`open-alert-${RUN_ID}`)).toBeTruthy();
    expect(screen.getByTestId(`button-acknowledge-${RUN_ID}`)).toBeTruthy();
    expect(screen.getByTestId(`open-alert-retainer-${RUN_ID}`).textContent).toContain(
      "Acme Retainer",
    );

    // The count reflects the single open alert.
    expect(screen.getByTestId("text-monitoring-open-alerts").textContent).toContain(
      "1 open alert",
    );
  });

  it("clears the alert and decrements the count on ACK, via refetch, without a reload", async () => {
    renderPage();

    await screen.findByTestId(`open-alert-${RUN_ID}`);
    expect(screen.getByTestId("text-monitoring-open-alerts").textContent).toContain(
      "1 open alert",
    );

    // Click ACK → POST acknowledge → invalidateQueries → dashboard refetch.
    fireEvent.click(screen.getByTestId(`button-acknowledge-${RUN_ID}`));

    // The open alert row disappears once the refetched dashboard resolves.
    await waitFor(() =>
      expect(screen.queryByTestId(`open-alert-${RUN_ID}`)).toBeNull(),
    );

    // The count updates to zero in the same render — no manual reload.
    expect(screen.getByTestId("text-monitoring-open-alerts").textContent).toContain(
      "0 open alerts",
    );

    // Prove the state change came from a real refetch: the acknowledge POST fired
    // once and the dashboard was fetched twice (initial load + post-ack refetch).
    const calls = fetchMock.mock.calls.map((c) => {
      const url =
        typeof c[0] === "string" ? c[0] : (c[0] as Request).url ?? String(c[0]);
      const method = ((c[1] as RequestInit | undefined)?.method ?? "GET").toUpperCase();
      return { url, method };
    });
    const ackCalls = calls.filter(
      (c) => c.method === "POST" && c.url.includes("/acknowledge"),
    );
    const dashboardGets = calls.filter(
      (c) => c.method === "GET" && c.url.includes("/api/f0/dashboard"),
    );
    expect(ackCalls).toHaveLength(1);
    expect(dashboardGets.length).toBeGreaterThanOrEqual(2);
  });
});

const CASE = "11111111-1111-4111-8111-111111111111";
const LINKED = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";
const REP = "44444444-4444-4444-8444-444444444444";
const REP2 = "55555555-5555-4555-8555-555555555555";
const eng = (id: string, title: string) => ({ id, title, status: "OPEN", artifactId: null, sessionId: "s1", discoveryTranscript: null });
const rep = (id: string, engagementId = LINKED) => ({
  id, engagementId, userId: "qa-owner", service: "MARKET_VIABILITY",
  reportCode: `RC-${id.slice(0, 4)}`, sku: null,
  content: { summary: "Synthetic saved advisory findings." }, createdAt: "2026-10-28T21:00:00Z",
});
const departure = { caseId: CASE, tool: "f0", sessionId: "s1", featureId: 4, stageLabel: "F4", sourceId: "src", sourceKind: null, sourceTitle: "Spec", sourceText: "", launchHref: "", returnedArtifactHref: null, f0EngagementId: LINKED };

describe("F0 source-bound return", () => {
  it("restores the server-linked engagement even if URL engagementId is wrong, and offers return on its saved report only", async () => {
    engagements[LINKED] = { engagement: eng(LINKED, "Linked"), reports: [rep(REP)] };
    engagements[OTHER] = { engagement: eng(OTHER, "Standalone"), reports: [rep(REP2)] };
    supportCase.mockReturnValue({ ...NO_CASE, caseId: CASE, departure });
    window.history.replaceState(null, "", `/f0?supportCaseId=${CASE}&engagementId=${OTHER}`);
    renderPage();
    expect(await screen.findByTestId("banner-stage-support")).toBeTruthy();
    expect(await screen.findByTestId(`return-action-${REP}`)).toBeTruthy();
    expect(window.location.search).toContain(`engagementId=${LINKED}`);
    expect(window.location.search).toContain(`supportCaseId=${CASE}`);
    expect(screen.queryByTestId(`button-return-report-to-f1-${REP}`)).toBeNull();
    expect(screen.getByTestId("text-f0-linked-engagement")).toBeTruthy();
  });

  it("shows no return action on an unrelated engagement's reports", async () => {
    engagements[OTHER] = { engagement: eng(OTHER, "Standalone"), reports: [rep(REP2)] };
    supportCase.mockReturnValue({ ...NO_CASE, caseId: CASE, departure: { ...departure, f0EngagementId: null } });
    window.history.replaceState(null, "", `/f0?supportCaseId=${CASE}&engagementId=${OTHER}`);
    renderPage();
    await screen.findByTestId(`report-${REP2}`);
    expect(screen.queryByTestId(`return-action-${REP2}`)).toBeNull();
    expect(screen.getByTestId("text-f0-unlinked-engagement")).toBeTruthy();
  });

  it("does not offer return when a report's engagement identity differs from the linked panel", async () => {
    engagements[LINKED] = { engagement: eng(LINKED, "Linked"), reports: [rep(REP, OTHER)] };
    supportCase.mockReturnValue({ ...NO_CASE, caseId: CASE, departure });
    window.history.replaceState(null, "", `/f0?supportCaseId=${CASE}&engagementId=${LINKED}`);
    renderPage();
    await screen.findByTestId(`report-${REP}`);
    expect(screen.queryByTestId(`return-action-${REP}`)).toBeNull();
  });

  it("restores the support case from the server origin lookup when reopened without supportCaseId", async () => {
    engagements[LINKED] = { engagement: eng(LINKED, "Linked"), reports: [rep(REP)] };
    origins[LINKED] = departure;
    supportCase.mockImplementation(() =>
      new URLSearchParams(window.location.search).get("supportCaseId") === CASE ? { ...NO_CASE, caseId: CASE, departure } : NO_CASE,
    );
    window.history.replaceState(null, "", `/f0?engagementId=${LINKED}`);
    renderPage();
    await waitFor(() => expect(window.location.search).toContain(`supportCaseId=${CASE}`));
    expect(await screen.findByTestId(`return-action-${REP}`)).toBeTruthy();
  });

  it("explicit invalid case never becomes standalone or offers return", async () => {
    engagements[OTHER] = { engagement: eng(OTHER, "Standalone"), reports: [rep(REP2)] };
    window.history.replaceState(null, "", `/f0?supportCaseId=bogus&engagementId=${OTHER}`);
    renderPage();
    await screen.findByTestId(`report-${REP2}`);
    expect(screen.queryByTestId(`return-action-${REP2}`)).toBeNull();
    expect(screen.queryByTestId(`button-return-report-to-f1-${REP2}`)).toBeNull();
    const calls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(calls.some((u) => u.includes("f0-origins"))).toBe(false);
  });

  it("standalone (no support case) shows no stage return action", async () => {
    engagements[OTHER] = { engagement: eng(OTHER, "Standalone"), reports: [rep(REP2)] };
    window.history.replaceState(null, "", `/f0?engagementId=${OTHER}`);
    renderPage();
    await screen.findByTestId(`report-${REP2}`);
    expect(screen.queryByTestId(`return-action-${REP2}`)).toBeNull();
    expect(screen.queryByTestId("banner-stage-support")).toBeNull();
  });
});
