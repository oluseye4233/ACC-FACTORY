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
vi.mock("@/components/layout/Footer", () => ({ Footer: () => null }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

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

beforeEach(() => {
  acked = false;
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
