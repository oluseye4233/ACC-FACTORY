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
    preferredModelProvider: "anthropic",
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
    preferredModelProvider: "anthropic",
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
  usageUpdatedAt?: number;
}) {
  apiHooks.useGetMe.mockReturnValue({ data: me, isLoading: isLoadingMe });
  apiHooks.useListSessions.mockReturnValue({
    data: sessions,
    isLoading: isLoadingSessions,
    isError: isSessionsError,
    isFetching: isFetchingSessions,
    refetch: refetchSessions,
  });
  apiHooks.useHealthDeep.mockReturnValue({
    data: health,
    isLoading: isLoadingHealth,
    isError: isHealthError,
    isFetching: isFetchingHealth,
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
  setHookResults({});
});

afterEach(() => {
  cleanup();
});

describe("Command Deck", () => {
  it("keeps the primary launch control and utility actions routed", () => {
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

    let resolveSessions!: () => void;
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
    });

    render(<Command />);

    expect(screen.getByTestId("recent-builds-error")).toBeTruthy();
    expect(screen.getByText("Recent builds unavailable")).toBeTruthy();
    expect(screen.getByTestId("system-status-error")).toBeTruthy();
    expect(screen.getByText("System status unavailable")).toBeTruthy();
    expect(screen.queryByText("No sessions yet. Press BUILD SOMETHING to begin.")).toBeNull();
    expect(screen.getAllByText("UNAVAILABLE")).toHaveLength(3);

    fireEvent.click(screen.getByTestId("button-retry-sessions"));
    fireEvent.click(screen.getByTestId("button-retry-system-status"));

    expect(refetchSessions).toHaveBeenCalledTimes(1);
    expect(refetchHealth).toHaveBeenCalledTimes(1);
  });
});

    let resolveHealth!: () => void;

    let resolveUsage!: () => void;

    const refreshButton = screen.getByTestId("button-refresh-all-metrics");
