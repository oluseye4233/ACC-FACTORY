// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const useListSessionsMock = vi.fn();
const refetchMock = vi.fn();

vi.mock("@workspace/api-client-react", () => ({
  useListSessions: () => useListSessionsMock(),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: Record<string, unknown>) => (
    <a href={href as string} {...props}>
      {children as React.ReactNode}
    </a>
  ),
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
    isError: false,
    isFetching: false,
    refetch: refetchMock,
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
    expect(screen.getByRole("link", { name: "Continue session Completed build" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Open session Untitled build" })).toBeNull();
    expect(screen.getByText("UNAVAILABLE")).toBeTruthy();
  });

  it("keeps valid session navigation available when another record is incomplete", () => {
    render(<Sessions />);

    const completedLink = screen.getByRole("link", { name: "Open session Completed build" });
    expect(completedLink.tagName).toBe("A");
    expect(completedLink.getAttribute("href")).toBe("/session/session-complete");
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.getAllByRole("columnheader")).toHaveLength(4);
  });

  it("reports a failed archive request rather than a successful empty archive", () => {
    useListSessionsMock.mockReturnValue({ isLoading: false, isError: true, isFetching: false, refetch: refetchMock });
    render(<Sessions />);
    const alert = screen.getByRole("alert", { name: "Sessions unavailable" });
    expect(alert.textContent).toContain("does not mean there are no sessions");
    expect(within(alert).getByRole("button", { name: "Retry sessions" })).toBeTruthy();
    expect(screen.queryByText("NO RECORDS MATCHING CRITERIA")).toBeNull();
    expect(screen.getByText("SESSION RECORDS UNAVAILABLE")).toBeTruthy();
  });

  it("does not treat an absent successful payload as zero sessions", () => {
    useListSessionsMock.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: refetchMock });
    render(<Sessions />);
    expect(screen.getByRole("alert", { name: "Sessions unavailable" })).toBeTruthy();
    expect(screen.queryByText("NO RECORDS MATCHING CRITERIA")).toBeNull();
  });

  it("announces loading and busy state without claiming an empty archive", () => {
    useListSessionsMock.mockReturnValue({ data: undefined, isLoading: true, isError: false, isFetching: true });
    render(<Sessions />);
    expect(screen.getByRole("region", { name: "Sessions archive results" }).getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("status").textContent).toBe("Loading sessions.");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("NO RECORDS MATCHING CRITERIA")).toBeNull();
  });

  it("only shows an empty archive after a successful array response", () => {
    useListSessionsMock.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<Sessions />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("NO RECORDS MATCHING CRITERIA")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("0 sessions match the current filters.");
  });

  it("keeps cached navigation available but identifies stale records after refresh failure", () => {
    useListSessionsMock.mockReturnValue({ data: [COMPLETE_SESSION], isLoading: false, isError: true, refetch: refetchMock });
    render(<Sessions />);
    expect(screen.getByRole("alert", { name: "Sessions unavailable" }).textContent).toContain("status may be out of date");
    expect(screen.getByRole("link", { name: "Open session Completed build" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Sessions unavailable.");
  });

  it("prevents repeated retries and restores the same search after recovery", async () => {
    let resolve!: () => void;
    refetchMock.mockReturnValue(new Promise<void>(done => { resolve = done; }));
    const state = { data: [COMPLETE_SESSION], isLoading: false, isError: true, isFetching: false, refetch: refetchMock };
    useListSessionsMock.mockReturnValue(state);
    const { rerender } = render(<Sessions />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search sessions by name or ID" }), { target: { value: "Completed" } });
    const retry = screen.getByRole("button", { name: "Retry sessions" });
    fireEvent.click(retry);
    fireEvent.click(retry);
    expect(refetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Retrying sessions..." }).getAttribute("aria-busy")).toBe("true");
    state.isError = false;
    await act(async () => { resolve(); });
    rerender(<Sessions />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect((screen.getByRole("textbox", { name: "Search sessions by name or ID" }) as HTMLInputElement).value).toBe("Completed");
    expect(screen.getByRole("status").textContent).toBe("1 sessions match the current filters.");
  });

  it("keeps a thrown retry failure explicit and allows another attempt", async () => {
    refetchMock.mockRejectedValue(new Error("network unavailable"));
    useListSessionsMock.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: refetchMock });
    render(<Sessions />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Retry sessions" })); });
    expect(screen.getByRole("alert").textContent).toContain("Retry failed");
    expect(screen.getByRole("button", { name: "Retry sessions" }).hasAttribute("disabled")).toBe(false);
    expect(screen.queryByText("NO RECORDS MATCHING CRITERIA")).toBeNull();
  });

  it("provides a named search, named filters and destination-safe links", () => {
    useListSessionsMock.mockReturnValue({ data: [{ ...COMPLETE_SESSION, id: "session/with?fragment#", sessionName: "VeryLongName".repeat(30) }], isLoading: false });
    render(<Sessions />);
    expect(screen.getByRole("tablist", { name: "Filter sessions by status" })).toBeTruthy();
    const link = screen.getByRole("link", { name: /^Open session/ });
    expect(link.getAttribute("href")).toBe("/session/session%2Fwith%3Ffragment%23");
    const search = screen.getByRole("textbox", { name: "Search sessions by name or ID" });
    fireEvent.change(search, { target: { value: "missing" } });
    expect(screen.getByRole("status").textContent).toBe("0 sessions match the current filters.");
    fireEvent.change(search, { target: { value: "VERYLONGNAME" } });
    expect(screen.getByRole("status").textContent).toBe("1 sessions match the current filters.");
  });
});