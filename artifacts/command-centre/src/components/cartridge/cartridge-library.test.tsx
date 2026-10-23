// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useState } from "react";

const listMock = vi.fn();
const sessionMock = vi.fn();
vi.mock("@workspace/api-client-react", () => ({
  getListCartridgeExemplarsQueryKey: () => ["/api/cartridge/exemplars"],
  useListCartridgeExemplars: (...a: unknown[]) => listMock(...a),
  getGetSessionCartridgeQueryKey: (id: string) => [`/api/sessions/${id}/cartridge`],
  useGetSessionCartridge: (...a: unknown[]) => sessionMock(...a),
}));

import { LibrarySourcePicker, MAX_LIBRARY_SOURCES } from "./LibrarySourcePicker";
import { RetainedLibrarySources } from "./RetainedLibrarySources";
import { SessionCartridgeSources } from "./SessionCartridgeSources";

const opts = Array.from({ length: 12 }, (_, i) => ({
  id: `id-${String(i).padStart(2, "0")}-abcdef`,
  title: i === 0 ? "Archived Billing SPC" : `Reference ${i}`,
  kind: i % 2 ? "MA" : "SPC",
  active: i !== 0,
  source: i === 0 ? "library" : "curated",
  characters: 1200 + i,
}));

function Harness({ onIds }: { onIds?: (ids: string[]) => void }) {
  const [ids, setIds] = useState<string[]>([]);
  return <LibrarySourcePicker selectedIds={ids} onChange={(n) => { setIds(n); onIds?.(n); }} />;
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("LibrarySourcePicker", () => {
  it("renders metadata and filters by search and status", () => {
    listMock.mockReturnValue({ data: opts, isLoading: false, isError: false, refetch: vi.fn() });
    render(<Harness />);
    expect(screen.getByText("Archived Billing SPC")).toBeTruthy();
    expect(screen.getByTestId("option-library-id-00-abcdef").textContent).toContain("Archived");
    expect(screen.getByText("Exemplar Library")).toBeTruthy();
    fireEvent.change(screen.getByTestId("input-library-search"), { target: { value: "billing" } });
    expect(screen.queryByText("Reference 1")).toBeNull();
    fireEvent.change(screen.getByTestId("input-library-search"), { target: { value: "" } });
    fireEvent.change(screen.getByTestId("select-library-status"), { target: { value: "archived" } });
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  });

  it("keeps selections across filters and enforces the limit", () => {
    listMock.mockReturnValue({ data: opts, isLoading: false, isError: false, refetch: vi.fn() });
    const onIds = vi.fn();
    render(<Harness onIds={onIds} />);
    fireEvent.click(screen.getByTestId("option-library-id-00-abcdef"));
    fireEvent.change(screen.getByTestId("select-library-kind"), { target: { value: "MA" } });
    expect(screen.getByTestId("chip-library-selected-id-00-abcdef")).toBeTruthy();
    fireEvent.change(screen.getByTestId("select-library-kind"), { target: { value: "all" } });
    for (const o of opts.slice(1)) fireEvent.click(screen.getByTestId(`option-library-${o.id}`));
    expect(onIds.mock.lastCall![0]).toHaveLength(MAX_LIBRARY_SOURCES);
    expect(screen.getByTestId("text-library-limit")).toBeTruthy();
    expect((screen.getByTestId("option-library-id-11-abcdef") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("option-library-id-00-abcdef"));
    expect(onIds.mock.lastCall![0]).not.toContain("id-00-abcdef");
  });

  it("shows loading, empty and error states", () => {
    listMock.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });
    const { rerender } = render(<Harness />);
    expect(screen.getByTestId("status-library-loading")).toBeTruthy();
    listMock.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() });
    rerender(<Harness />);
    expect(screen.getByTestId("status-library-empty")).toBeTruthy();
    const refetch = vi.fn();
    listMock.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    rerender(<Harness />);
    fireEvent.click(screen.getByTestId("button-library-retry"));
    expect(refetch).toHaveBeenCalled();
  });
});

const snap = { ...opts[0], body: "# Billing\n\nRetained body text", contentSha256: "a".repeat(64) } as never;

describe("retained snapshots", () => {
  it("shows retained title, status at capture and body", () => {
    render(<RetainedLibrarySources sources={[snap]} />);
    expect(screen.getByText("Archived Billing SPC")).toBeTruthy();
    expect(screen.getByText("Archived at capture")).toBeTruthy();
    expect(screen.getByText("Retained body text")).toBeTruthy();
    expect(screen.getByText(/not executable authority/)).toBeTruthy();
  });

  it("only queries the session cartridge for cartridge-origin sessions", () => {
    sessionMock.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() });
    const { container } = render(<SessionCartridgeSources sessionId="s1" origin="manual" />);
    expect(sessionMock.mock.lastCall![1].query.enabled).toBe(false);
    expect(container.innerHTML).toBe("");
    sessionMock.mockReturnValue({ data: { librarySources: [snap] }, isLoading: false, isError: false, refetch: vi.fn() });
    render(<SessionCartridgeSources sessionId="s1" origin="cartridge" />);
    expect(sessionMock.mock.lastCall![1].query.enabled).toBe(true);
    expect(screen.getByTestId("retained-source-id-00-abcdef")).toBeTruthy();
  });
});
