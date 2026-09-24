// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const apiHooks = vi.hoisted(() => ({
  useGetMe: vi.fn(),
  useListSessions: vi.fn(),
  useHealthDeep: vi.fn(),
  useGetMyUsage: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => apiHooks);
vi.mock("@/components/layout/TopNav", () => ({ TopNav: () => null }));
vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import Command from "./command";

const EMPTY_HOOK_RESULT = { data: undefined, isLoading: false };

const refetchSessions = vi.fn();
const refetchHealth = vi.fn();
const refetchUsage = vi.fn();
const POPULATED_SESSIONS = [
  {
    id: "session-1",
    sessionName: "Launch plan",
    status: "ACTIVE",
    origin: "manual",
    ingestionId: null,
    cartridgeId: null,
    preferredModelProvider: "claude",
    createdAt: "2026-09-21T10:00:00.000Z",
    updatedAt: "2026-09-22T10:00:00.000Z",
  },
  {
    id: "session-2",
    sessionName: "Completed build",
    status: "COMPLETE",
    origin: "manual",
    ingestionId: null,
    cartridgeId: null,
    preferredModelProvider: "claude",
    createdAt: "2026-09-20T10:00:00.000Z",
    updatedAt: "2026-09-21T10:00:00.000Z",
  },
];

function setHookResults({
  me = EMPTY_HOOK_RESULT.data,
  sessions = EMPTY_HOOK_RESULT.data,
  health = EMPTY_HOOK_RESULT.data,
  usageReport = EMPTY_HOOK_RESULT.data,
  isLoadingMe = false,
  isLoadingSessions = false,
  isLoadingHealth = false,
  isLoadingUsage = false,
  isSessionsError = false,
  isHealthError = false,
  isUsageError = false,
  isFetchingSessions = false,
  isFetchingHealth = false,
  isFetchingUsage = false,
  sessionsUpdatedAt = 0,
  healthUpdatedAt = 0,
  usageUpdatedAt = 0,
}: {
  me?: unknown;
  sessions?: unknown;
  health?: unknown;
  usageReport?: unknown;
  isLoadingMe?: boolean;
  isLoadingSessions?: boolean;
  isLoadingHealth?: boolean;
  isLoadingUsage?: boolean;
  isSessionsError?: boolean;
  isHealthError?: boolean;
  isUsageError?: boolean;
  isFetchingSessions?: boolean;
  isFetchingHealth?: boolean;
  isFetchingUsage?: boolean;
  sessionsUpdatedAt?: number;
  healthUpdatedAt?: number;
  usageUpdatedAt?: number;
}) {
  apiHooks.useGetMe.mockReturnValue({ data: me, isLoading: isLoadingMe });
  apiHooks.useListSessions.mockReturnValue({
    data: sessions,
    isLoading: isLoadingSessions,
    isError: isSessionsError,
    isFetching: isFetchingSessions,
    dataUpdatedAt: sessionsUpdatedAt,
    refetch: refetchSessions,
  });
  apiHooks.useHealthDeep.mockReturnValue({
    data: health,
    isLoading: isLoadingHealth,
    isError: isHealthError,
    isFetching: isFetchingHealth,
    dataUpdatedAt: healthUpdatedAt,
    refetch: refetchHealth,
  });
  apiHooks.useGetMyUsage.mockReturnValue({
    data: usageReport,
    isLoading: isLoadingUsage,
    isError: isUsageError,
    isFetching: isFetchingUsage,
    dataUpdatedAt: usageUpdatedAt,
    refetch: refetchUsage,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  setHookResults({});
});

afterEach(() => {
  cleanup();
});

describe("Command Deck", () => {
  it("keeps the primary launch control and utility actions routed", async () => {
    render(<Command />);

    expect(screen.getByTestId("button-build-something").getAttribute("href")).toBe(
      "/session/new",
    );

    const expectedRoutes = [
      ["Resume Session", "/sessions"],
      ["Import Existing", "/ingest"],
      ["Open Library", "/exemplars"],
      ["View Quests", "/quests"],
    ] as const;
    for (const [label, href] of expectedRoutes) {
      expect(screen.getByRole("link", { name: new RegExp(label) }).getAttribute("href")).toBe(
        href,
      );
    }
  });

  it("waits for all metric requests and ignores repeated combined refresh clicks", async () => {
    let resolveSessions!: (value?: unknown) => void;
    let resolveHealth!: (value?: unknown) => void;
    let resolveUsage!: (value?: unknown) => void;
    refetchSessions.mockReturnValue(new Promise((resolve) => {
      resolveSessions = resolve;
    }));
    refetchHealth.mockReturnValue(new Promise((resolve) => {
      resolveHealth = resolve;
    }));
    refetchUsage.mockReturnValue(new Promise((resolve) => {
      resolveUsage = resolve;
    }));

    render(<Command />);

    const refreshButton = screen.getByTestId("button-refresh-all-metrics");
    fireEvent.click(refreshButton);

    expect((refreshButton as HTMLButtonElement).disabled).toBe(true);
    expect(refreshButton.textContent).toContain("Refreshing metrics…");
    expect(refetchSessions).toHaveBeenCalledTimes(1);
    expect(refetchHealth).toHaveBeenCalledTimes(1);
    expect(refetchUsage).toHaveBeenCalledTimes(1);

    fireEvent.click(refreshButton);
    expect(refetchSessions).toHaveBeenCalledTimes(1);
    expect(refetchHealth).toHaveBeenCalledTimes(1);
    expect(refetchUsage).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSessions();
      resolveHealth();
      resolveUsage();
    });

    expect((refreshButton as HTMLButtonElement).disabled).toBe(false);
    expect(refreshButton.textContent).toContain("Refresh all metrics");
    expect(screen.queryByTestId("refresh-all-metrics-error")).toBeNull();
  });

  it("refreshes all metrics when the command deck regains focus", async () => {
    refetchSessions.mockResolvedValue({ isError: false });
    refetchHealth.mockResolvedValue({ isError: false });
    refetchUsage.mockResolvedValue({ isError: false });

    render(<Command />);

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(refetchSessions).toHaveBeenCalledTimes(1);
    expect(refetchHealth).toHaveBeenCalledTimes(1);
    expect(refetchUsage).toHaveBeenCalledTimes(1);
  });

  it("shows an accessible status while a focus refresh is in progress", async () => {
    let resolveSessions!: (value?: unknown) => void;
    let resolveHealth!: (value?: unknown) => void;
    let resolveUsage!: (value?: unknown) => void;
    refetchSessions.mockReturnValue(new Promise((resolve) => {
      resolveSessions = resolve;
    }));
    refetchHealth.mockReturnValue(new Promise((resolve) => {
      resolveHealth = resolve;
    }));
    refetchUsage.mockReturnValue(new Promise((resolve) => {
      resolveUsage = resolve;
    }));

    render(<Command />);

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(screen.getByTestId("button-refresh-all-metrics")).toBeTruthy();
    expect(screen.getByTestId("automatic-refresh-status").textContent).toContain(
      "Refreshing metrics after returning to this tab…",
    );
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");

    await act(async () => {
      resolveSessions();
      resolveHealth();
      resolveUsage();
    });

    expect(screen.queryByTestId("automatic-refresh-status")).toBeNull();
  });

  it("refreshes all metrics when a hidden tab becomes visible", async () => {
    refetchSessions.mockResolvedValue({ isError: false });
    refetchHealth.mockResolvedValue({ isError: false });
    refetchUsage.mockResolvedValue({ isError: false });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });

    render(<Command />);

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(refetchSessions).not.toHaveBeenCalled();
    expect(refetchHealth).not.toHaveBeenCalled();
    expect(refetchUsage).not.toHaveBeenCalled();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(refetchSessions).toHaveBeenCalledTimes(1);
    expect(refetchHealth).toHaveBeenCalledTimes(1);
    expect(refetchUsage).toHaveBeenCalledTimes(1);
  });

  it("refreshes all metrics when the active page is restored", async () => {
    refetchSessions.mockResolvedValue({ isError: false });
    refetchHealth.mockResolvedValue({ isError: false });
    refetchUsage.mockResolvedValue({ isError: false });

    render(<Command />);

    await act(async () => {
      window.dispatchEvent(new Event("pageshow"));
    });

    expect(refetchSessions).toHaveBeenCalledTimes(1);
    expect(refetchHealth).toHaveBeenCalledTimes(1);
    expect(refetchUsage).toHaveBeenCalledTimes(1);
  });

  it("shares a page restoration refresh with nearby focus and visibility signals", async () => {
    let resolveSessions!: (value?: unknown) => void;
    let resolveHealth!: (value?: unknown) => void;
    let resolveUsage!: (value?: unknown) => void;
    refetchSessions.mockReturnValue(new Promise((resolve) => {
      resolveSessions = resolve;
    }));
    refetchHealth.mockReturnValue(new Promise((resolve) => {
      resolveHealth = resolve;
    }));
    refetchUsage.mockReturnValue(new Promise((resolve) => {
      resolveUsage = resolve;
    }));

    render(<Command />);

    window.dispatchEvent(new Event("pageshow"));
    document.dispatchEvent(new Event("visibilitychange"));
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(refetchSessions).toHaveBeenCalledTimes(1);
    expect(refetchHealth).toHaveBeenCalledTimes(1);
    expect(refetchUsage).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSessions();
      resolveHealth();
      resolveUsage();
    });
  });

  it("shares a visibility-return refresh with a focus refresh", async () => {
    let resolveSessions!: (value?: unknown) => void;
    let resolveHealth!: (value?: unknown) => void;
    let resolveUsage!: (value?: unknown) => void;
    refetchSessions.mockReturnValue(new Promise((resolve) => {
      resolveSessions = resolve;
    }));
    refetchHealth.mockReturnValue(new Promise((resolve) => {
      resolveHealth = resolve;
    }));
    refetchUsage.mockReturnValue(new Promise((resolve) => {
      resolveUsage = resolve;
    }));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    render(<Command />);

    document.dispatchEvent(new Event("visibilitychange"));
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(refetchSessions).toHaveBeenCalledTimes(1);
    expect(refetchHealth).toHaveBeenCalledTimes(1);
    expect(refetchUsage).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSessions();
      resolveHealth();
      resolveUsage();
    });
  });

  it("shares an in-flight manual refresh with a focus refresh", async () => {
    let resolveSessions!: (value?: unknown) => void;
    let resolveHealth!: (value?: unknown) => void;
    let resolveUsage!: (value?: unknown) => void;
    refetchSessions.mockReturnValue(new Promise((resolve) => {
      resolveSessions = resolve;
    }));
    refetchHealth.mockReturnValue(new Promise((resolve) => {
      resolveHealth = resolve;
    }));
    refetchUsage.mockReturnValue(new Promise((resolve) => {
      resolveUsage = resolve;
    }));

    render(<Command />);

    fireEvent.click(screen.getByTestId("button-refresh-all-metrics"));
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(refetchSessions).toHaveBeenCalledTimes(1);
    expect(refetchHealth).toHaveBeenCalledTimes(1);
    expect(refetchUsage).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSessions();
      resolveHealth();
      resolveUsage();
    });
  });

  it("shares an in-flight panel retry with a focus refresh", async () => {
    setHookResults({ isSessionsError: true });

    let resolveSessions!: (value?: unknown) => void;
    refetchSessions.mockReturnValue(new Promise((resolve) => {
      resolveSessions = resolve;
    }));
    refetchHealth.mockResolvedValue({ isError: false });
    refetchUsage.mockResolvedValue({ isError: false });

    render(<Command />);

    fireEvent.click(screen.getByTestId("button-retry-sessions"));
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(refetchSessions).toHaveBeenCalledTimes(1);
    expect(refetchHealth).toHaveBeenCalledTimes(1);
    expect(refetchUsage).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSessions({ isError: false });
    });
  });

  it("reports partial failures after a combined metric refresh", async () => {
    setHookResults({
      sessions: POPULATED_SESSIONS,
      health: { status: "ok", db: "ok", engines: "ok" },
      usageReport: {
        day: { totalTokens: 100, totalCostUsd: 0.01 },
        month: { totalTokens: 12345, totalCostUsd: 1.23 },
        byEngine: [],
      },
      isHealthError: true,
    });
    refetchSessions.mockResolvedValue({ isError: false });
    refetchHealth.mockRejectedValue(new Error("health unavailable"));
    refetchUsage.mockResolvedValue({ isError: false });

    render(<Command />);

    const refreshButton = screen.getByTestId("button-refresh-all-metrics");
    await act(async () => {
      fireEvent.click(refreshButton);
    });

    expect(screen.getByTestId("refresh-all-metrics-error").textContent).toContain(
      "System status remain unchanged",
    );
    expect(refetchSessions).toHaveBeenCalledTimes(1);
    expect(refetchHealth).toHaveBeenCalledTimes(1);
    expect(refetchUsage).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Launch plan")).toBeTruthy();
    expect(screen.getByTestId("system-status-error")).toBeTruthy();
    expect(screen.getByTestId("button-retry-system-status")).toBeTruthy();
    expect((refreshButton as HTMLButtonElement).disabled).toBe(false);
  });

  it("clears a recovered metric from the partial refresh warning while keeping other failures", async () => {
    setHookResults({
      sessions: POPULATED_SESSIONS,
      health: { status: "ok", db: "ok", engines: "ok" },
      usageReport: {
        day: { totalTokens: 100, totalCostUsd: 0.01 },
        month: { totalTokens: 12345, totalCostUsd: 1.23 },
        byEngine: [],
      },
      isSessionsError: true,
      isHealthError: true,
    });
    refetchSessions.mockRejectedValue(new Error("sessions unavailable"));
    refetchHealth
      .mockRejectedValueOnce(new Error("health unavailable"))
      .mockResolvedValueOnce({ isError: false });
    refetchUsage.mockResolvedValue({ isError: false });

    render(<Command />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("button-refresh-all-metrics"));
    });

    expect(screen.getByTestId("refresh-all-metrics-error").textContent).toContain(
      "Recent builds, System status remain unchanged",
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("button-retry-system-status"));
    });

    expect(screen.getByTestId("refresh-all-metrics-error").textContent).toContain(
      "Recent builds remain unchanged",
    );
    expect(screen.getByTestId("refresh-all-metrics-error").textContent).not.toContain(
      "System status",
    );
  });

  it("reports resolved metric errors after a combined refresh", async () => {
    setHookResults({
      health: { status: "ok", db: "ok", engines: "degraded" },
      usageReport: {
        day: { totalTokens: 100, totalCostUsd: 0.01 },
        month: { totalTokens: 12345, totalCostUsd: 1.23 },
        byEngine: [],
      },
      isSessionsError: true,
    });
    refetchSessions.mockResolvedValue({ isError: true });
    refetchHealth.mockResolvedValue({ isError: false });
    refetchUsage.mockResolvedValue({ isError: false });

    render(<Command />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("button-refresh-all-metrics"));
    });

    expect(screen.getByTestId("refresh-all-metrics-error").textContent).toContain(
      "Recent builds remain unchanged",
    );
    expect(screen.getAllByText("ok")).toHaveLength(3);
    expect(screen.getByText("12,345 tok")).toBeTruthy();
    expect(screen.getByTestId("recent-builds-error")).toBeTruthy();
    expect(screen.getByTestId("button-retry-sessions")).toBeTruthy();
    expect(refetchSessions).toHaveBeenCalledTimes(1);
    expect(refetchHealth).toHaveBeenCalledTimes(1);
    expect(refetchUsage).toHaveBeenCalledTimes(1);
  });

  it("keeps a rejected panel retry in the partial refresh warning", async () => {
    setHookResults({
      sessions: POPULATED_SESSIONS,
      health: { status: "ok", db: "ok", engines: "ok" },
      usageReport: {
        day: { totalTokens: 100, totalCostUsd: 0.01 },
        month: { totalTokens: 12345, totalCostUsd: 1.23 },
        byEngine: [],
      },
      isSessionsError: true,
      isHealthError: true,
    });
    refetchSessions.mockRejectedValue(new Error("sessions unavailable"));
    refetchHealth
      .mockRejectedValueOnce(new Error("health unavailable"))
      .mockResolvedValueOnce({ isError: false });
    refetchUsage.mockResolvedValue({ isError: false });

    render(<Command />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("button-refresh-all-metrics"));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("button-retry-sessions"));
    });

    expect(screen.getByTestId("refresh-all-metrics-error").textContent).toContain(
      "Recent builds, System status remain unchanged",
    );
    expect(screen.getByTestId("metric-retry-failure-recent-builds").textContent).toContain(
      "Recent builds is still unavailable after retry.",
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("button-retry-system-status"));
    });

    expect(screen.getByTestId("refresh-all-metrics-error").textContent).toContain(
      "Recent builds remain unchanged",
    );
    expect(screen.getByTestId("refresh-all-metrics-error").textContent).not.toContain(
      "System status",
    );
    expect(screen.getByTestId("metric-retry-failure-recent-builds")).toBeTruthy();
    expect(screen.queryByTestId("metric-retry-failure-system-status")).toBeNull();
  });

  it("keeps a synchronously throwing panel retry in the partial refresh warning", async () => {
    setHookResults({
      sessions: POPULATED_SESSIONS,
      health: { status: "ok", db: "ok", engines: "ok" },
      usageReport: {
        day: { totalTokens: 100, totalCostUsd: 0.01 },
        month: { totalTokens: 12345, totalCostUsd: 1.23 },
        byEngine: [],
      },
      isSessionsError: true,
      isHealthError: true,
    });
    refetchSessions
      .mockRejectedValueOnce(new Error("sessions unavailable"))
      .mockImplementationOnce(() => {
        throw new Error("sessions unavailable before returning a promise");
      });
    refetchHealth
      .mockRejectedValueOnce(new Error("health unavailable"))
      .mockResolvedValue({ isError: false });
    refetchUsage.mockResolvedValue({ isError: false });

    render(<Command />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("button-refresh-all-metrics"));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("button-retry-sessions"));
    });

    expect(screen.getByTestId("refresh-all-metrics-error").textContent).toContain(
      "Recent builds, System status remain unchanged",
    );
    expect(screen.getByTestId("metric-retry-failure-recent-builds").textContent).toContain(
      "Recent builds is still unavailable after retry.",
    );
  });

  it("keeps an isError panel retry in the partial refresh warning", async () => {
    setHookResults({
      sessions: POPULATED_SESSIONS,
      health: { status: "ok", db: "ok", engines: "ok" },
      usageReport: {
        day: { totalTokens: 100, totalCostUsd: 0.01 },
        month: { totalTokens: 12345, totalCostUsd: 1.23 },
        byEngine: [],
      },
      isSessionsError: true,
      isHealthError: true,
    });
    refetchSessions.mockResolvedValue({ isError: true });
    refetchHealth
      .mockRejectedValueOnce(new Error("health unavailable"))
      .mockResolvedValueOnce({ isError: false });
    refetchUsage.mockResolvedValue({ isError: false });

    render(<Command />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("button-refresh-all-metrics"));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("button-retry-sessions"));
    });

    expect(screen.getByTestId("refresh-all-metrics-error").textContent).toContain(
      "Recent builds, System status remain unchanged",
    );
    expect(screen.getByTestId("metric-retry-failure-recent-builds").textContent).toContain(
      "Recent builds is still unavailable after retry.",
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("button-retry-system-status"));
    });

    expect(screen.getByTestId("refresh-all-metrics-error").textContent).toContain(
      "Recent builds remain unchanged",
    );
    expect(screen.getByTestId("refresh-all-metrics-error").textContent).not.toContain(
      "System status",
    );
    expect(screen.getByTestId("metric-retry-failure-recent-builds")).toBeTruthy();
    expect(screen.queryByTestId("metric-retry-failure-system-status")).toBeNull();
  });

  it("shares a pending panel retry with a newer combined refresh and keeps the newer warning", async () => {
    setHookResults({
      sessions: POPULATED_SESSIONS,
      health: { status: "ok", db: "ok", engines: "ok" },
      usageReport: {
        day: { totalTokens: 100, totalCostUsd: 0.01 },
        month: { totalTokens: 12345, totalCostUsd: 1.23 },
        byEngine: [],
      },
      isSessionsError: true,
    });

    let resolvePanelRetry!: (value?: unknown) => void;
    refetchSessions.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePanelRetry = resolve;
        }),
    );
    refetchHealth.mockResolvedValue({ isError: false });
    refetchUsage.mockResolvedValue({ isError: false });

    render(<Command />);

    fireEvent.click(screen.getByTestId("button-retry-sessions"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("button-refresh-all-metrics"));
    });

    expect(refetchSessions).toHaveBeenCalledTimes(1);
    expect(refetchHealth).toHaveBeenCalledTimes(1);
    expect(refetchUsage).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("refresh-all-metrics-error")).toBeNull();

    await act(async () => {
      resolvePanelRetry({ isError: true });
    });

    expect(screen.getByTestId("refresh-all-metrics-error").textContent).toContain(
      "Recent builds remain unchanged",
    );
  });

  it("shares a pending combined refresh with a newer panel retry and keeps the newer result", async () => {
    setHookResults({
      sessions: POPULATED_SESSIONS,
      health: { status: "ok", db: "ok", engines: "ok" },
      usageReport: {
        day: { totalTokens: 100, totalCostUsd: 0.01 },
        month: { totalTokens: 12345, totalCostUsd: 1.23 },
        byEngine: [],
      },
      isSessionsError: true,
    });

    let resolveCombinedRefresh!: (value?: unknown) => void;
    refetchSessions.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCombinedRefresh = resolve;
        }),
    );
    refetchHealth.mockResolvedValue({ isError: false });
    refetchUsage.mockResolvedValue({ isError: false });

    render(<Command />);

    fireEvent.click(screen.getByTestId("button-refresh-all-metrics"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("button-retry-sessions"));
    });

    expect(refetchSessions).toHaveBeenCalledTimes(1);
    expect(refetchHealth).toHaveBeenCalledTimes(1);
    expect(refetchUsage).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("refresh-all-metrics-error")).toBeNull();

    await act(async () => {
      resolveCombinedRefresh({ isError: true });
    });

    expect(screen.getByTestId("refresh-all-metrics-error").textContent).toContain(
      "Recent builds remain unchanged",
    );
    expect(screen.getByTestId("metric-retry-failure-recent-builds").textContent).toContain(
      "Recent builds is still unavailable after retry.",
    );
  });

  it("renders safe empty states when APIs return no data", () => {
    render(<Command />);

    expect(screen.getByText("No sessions yet. Press BUILD SOMETHING to begin.")).toBeTruthy();
    expect(screen.getByText("SYSTEM")).toBeTruthy();
    expect(screen.getAllByText("UNKNOWN")).toHaveLength(4);
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.queryByText("0 tok")).toBeNull();
  });

  it("renders safe loading states while API responses are pending", () => {
    setHookResults({
      isLoadingMe: true,
      isLoadingSessions: true,
      isLoadingHealth: true,
      isLoadingUsage: true,
    });

    render(<Command />);

    expect(screen.getByTestId("button-build-something")).toBeTruthy();
    expect(screen.getByText("RECENT BUILDS")).toBeTruthy();
    expect(screen.getByText("SYSTEM")).toBeTruthy();
    expect(screen.queryByText("No sessions yet. Press BUILD SOMETHING to begin.")).toBeNull();
    expect(screen.getAllByText("—")).toHaveLength(4);
  });

  it("renders recent builds and system status from populated API responses", () => {
    setHookResults({
      me: {
        displayName: "Ada Operator",
        email: "ada@example.com",
        subscriber: { tier: "PRACTITIONER" },
      },
      sessions: POPULATED_SESSIONS,
      health: { status: "ok", db: "ok", engines: "degraded" },
      usageReport: {
        day: { totalTokens: 100, totalCostUsd: 0.01 },
        month: { totalTokens: 12345, totalCostUsd: 1.23 },
        byEngine: [
          { engineId: 2, runs: 3, totalTokens: 3456, totalCostUsd: 0.45 },
          { engineId: 1, runs: 5, totalTokens: 8889, totalCostUsd: 0.78 },
        ],
      },
      sessionsUpdatedAt: Date.parse("2026-09-22T10:00:00.000Z"),
      healthUpdatedAt: Date.parse("2026-09-22T10:05:00.000Z"),
      usageUpdatedAt: Date.parse("2026-09-22T10:15:00.000Z"),
    });

    render(<Command />);

    expect(screen.getByText("Launch plan")).toBeTruthy();
    expect(screen.getByText("Completed build")).toBeTruthy();
    expect(screen.getByText("ACTIVE")).toBeTruthy();
    expect(screen.getByText("COMPLETE")).toBeTruthy();
    expect(screen.getAllByText("ok")).toHaveLength(3);
    expect(screen.getByText("degraded")).toBeTruthy();
    expect(screen.getByText("12,345 tok")).toBeTruthy();
    expect(screen.getByText("$1.23")).toBeTruthy();
    expect(screen.getByTestId("monthly-engine-usage")).toBeTruthy();
    expect(screen.getByTestId("monthly-engine-1")).toBeTruthy();
    expect(screen.getByText("F1 Diagnose")).toBeTruthy();
    expect(screen.getByText("8,889 tok · $0.78")).toBeTruthy();
    expect(screen.getByText("3,456 tok · $0.45")).toBeTruthy();
    expect(screen.getByTestId("sessions-refreshed").textContent).toBe(
      "Last refreshed 2026-09-22 10:00",
    );
    expect(screen.getByTestId("system-health-refreshed").textContent).toBe(
      "Last refreshed 2026-09-22 10:05",
    );
    expect(screen.getByTestId("monthly-usage-refreshed").textContent).toBe(
      "Last refreshed 2026-09-22 10:15",
    );
  });

  it("shows an explicit empty monthly engine usage state", () => {
    setHookResults({
      health: { status: "ok", db: "ok", engines: "ok" },
      usageReport: {
        day: { totalTokens: 0, totalCostUsd: 0 },
        month: { totalTokens: 0, totalCostUsd: 0 },
        byEngine: [],
      },
    });

    render(<Command />);

    expect(screen.getByTestId("monthly-engine-usage-empty")).toBeTruthy();
    expect(screen.getByText("No engine usage recorded this month.")).toBeTruthy();
    expect(screen.queryByText("Engine 0")).toBeNull();
  });

  it("shows monthly usage as unavailable and retries only the usage request", () => {
    setHookResults({
      health: { status: "ok", db: "ok", engines: "ok" },
      isUsageError: true,
    });

    render(<Command />);

    expect(screen.getByTestId("monthly-usage-error")).toBeTruthy();
    expect(screen.getByText("Engine breakdown unavailable.")).toBeTruthy();
    expect(screen.getAllByText("UNAVAILABLE")).toHaveLength(2);
    expect(screen.queryByText("0 tok")).toBeNull();
    expect(screen.queryByTestId("monthly-usage-refreshed")).toBeNull();

    fireEvent.click(screen.getByTestId("button-retry-monthly-usage"));

    expect(refetchUsage).toHaveBeenCalledTimes(1);
    expect(refetchSessions).not.toHaveBeenCalled();
    expect(refetchHealth).not.toHaveBeenCalled();
  });

  it("keeps recent builds and launch actions available for incomplete session records", () => {
    setHookResults({
      sessions: [
        {
          ...POPULATED_SESSIONS[0],
          sessionName: null,
          status: null,
          updatedAt: "not-a-date",
        },
        POPULATED_SESSIONS[1],
      ],
    });

    render(<Command />);

    expect(screen.getByText("Untitled build")).toBeTruthy();
    expect(screen.getByText("Unknown date")).toBeTruthy();
    expect(screen.getByText("Completed build")).toBeTruthy();
    expect(screen.getByTestId("button-build-something").getAttribute("href")).toBe("/session/new");
    expect(screen.getAllByRole("link", { name: "ENTER" })[0]?.getAttribute("href")).toBe("/session/session-1");
  });

  it("renders explicit unavailable states and retries only the failed requests", () => {
    setHookResults({
      isSessionsError: true,
      isHealthError: true,
      sessionsUpdatedAt: Date.parse("2026-09-22T10:00:00.000Z"),
      healthUpdatedAt: Date.parse("2026-09-22T10:05:00.000Z"),
      usageUpdatedAt: Date.parse("2026-09-22T10:15:00.000Z"),
    });

    render(<Command />);

    expect(screen.getByTestId("recent-builds-error")).toBeTruthy();
    expect(screen.getByText("Recent builds unavailable")).toBeTruthy();
    expect(screen.getByTestId("system-status-error")).toBeTruthy();
    expect(screen.getByText("System status unavailable")).toBeTruthy();
    expect(screen.queryByText("No sessions yet. Press BUILD SOMETHING to begin.")).toBeNull();
    expect(screen.getAllByText("UNAVAILABLE")).toHaveLength(3);
    expect(screen.queryByTestId("sessions-refreshed")).toBeNull();
    expect(screen.queryByTestId("system-health-refreshed")).toBeNull();
    expect(screen.queryByTestId("monthly-usage-refreshed")).toBeNull();

    fireEvent.click(screen.getByTestId("button-retry-sessions"));
    fireEvent.click(screen.getByTestId("button-retry-system-status"));

    expect(refetchSessions).toHaveBeenCalledTimes(1);
    expect(refetchHealth).toHaveBeenCalledTimes(1);
  });
});
