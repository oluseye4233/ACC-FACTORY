// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const useListSessionsMock = vi.fn();
const setLocationMock = vi.fn();

vi.mock("@workspace/api-client-react", () => ({
  useListSessions: () => useListSessionsMock(),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: Record<string, unknown>) => (
    <a href={href as string} {...props}>
      {children as React.ReactNode}
    </a>
  ),
  useLocation: () => ["/sessions", setLocationMock],
}));

vi.mock("@/components/layout/TopNav", () => ({
  TopNav: () => <div />,
}));

import Sessions from "./sessions";

const COMPLETE_SESSION = {
  id: "session-complete",
  sessionName: "Completed build",
  status: "COMPLETE",
  updatedAt: "2026-09-21T10:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  useListSessionsMock.mockReturnValue({
    data: [
      {
        id: null,
        sessionName: null,
        status: null,
        updatedAt: "not-a-date",
      },
      COMPLETE_SESSION,
    ],
    isLoading: false,
  });
});

afterEach(() => {
  cleanup();
});

describe("Sessions archive", () => {
  it("renders incomplete records with fallbacks without hiding usable sessions", () => {
    render(<Sessions />);

    expect(screen.getByText("Untitled build")).toBeTruthy();
    expect(screen.getAllByText("UNKNOWN")).toHaveLength(2);
    expect(screen.getAllByText("Unknown date")).toHaveLength(2);
    expect(screen.getByText("ID: Unknown ID")).toBeTruthy();
    expect(screen.getByText("Completed build")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "ENTER" })).toHaveLength(2);
  });

  it("keeps valid session navigation available when another record is incomplete", () => {
    render(<Sessions />);

    const completedRow = screen.getByRole("link", { name: "Open session Completed build" });
    expect(completedRow).toBeTruthy();

    fireEvent.keyDown(completedRow, { key: "Enter" });
    expect(setLocationMock).toHaveBeenCalledWith("/session/session-complete");
  });
});