// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

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
}: {
  me?: unknown;
  sessions?: unknown;
  health?: unknown;
  usageReport?: unknown;
  isLoadingMe?: boolean;
  isLoadingSessions?: boolean;
  isLoadingHealth?: boolean;
  isLoadingUsage?: boolean;
}) {
  apiHooks.useGetMe.mockReturnValue({ data: me, isLoading: isLoadingMe });
  apiHooks.useListSessions.mockReturnValue({
    data: sessions,
    isLoading: isLoadingSessions,
  });
  apiHooks.useHealthDeep.mockReturnValue({
    data: health,
    isLoading: isLoadingHealth,
  });
  apiHooks.useGetMyUsage.mockReturnValue({
    data: usageReport,
    isLoading: isLoadingUsage,
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

    for (const [label, href] of expectedRoutes) {
      expect(screen.getByRole("link", { name: new RegExp(label) }).getAttribute("href")).toBe(
        href,
      );
    }
  });

  it("renders safe empty states when APIs return no data", () => {
    render(<Command />);

    expect(screen.getByText("No sessions yet. Press BUILD SOMETHING to begin.")).toBeTruthy();
    expect(screen.getByText("SYSTEM")).toBeTruthy();
    expect(screen.getAllByText("UNKNOWN")).toHaveLength(4);
    expect(screen.getByText("—")).toBeTruthy();
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
        byEngine: [],
      },
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
  });
});