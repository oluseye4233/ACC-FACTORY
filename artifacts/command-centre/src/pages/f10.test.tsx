// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import F10Console from "./f10";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import {
  useListF10Releases,
  useCreateF10Release,
  useProcessF10Release,
  useGetF10Release,
  useGetF10Catalog,
  useListF10Sources,
  useCreateF10ExportManifest,
  useDownloadF10Export,
  useListF10Destinations,
  useCreateF10Destination
} from "@workspace/api-client-react";

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual("@workspace/api-client-react");
  return {
    ...actual,
    useListF10Releases: vi.fn(),
    useCreateF10Release: vi.fn(),
    useProcessF10Release: vi.fn(),
    useGetF10Release: vi.fn(),
    useGetF10Catalog: vi.fn(),
    useListF10Sources: vi.fn(),
    useCreateF10ExportManifest: vi.fn(),
    useDownloadF10Export: vi.fn(),
    useListF10Destinations: vi.fn(),
    useCreateF10Destination: vi.fn(),
  };
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("F10Console", () => {
  let originalClick: any;

  afterEach(() => {
    cleanup();
    if (originalClick) {
      HTMLAnchorElement.prototype.click = originalClick;
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();

    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
    Element.prototype.setPointerCapture = vi.fn();

    originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = vi.fn();

    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    vi.mocked(useListF10Releases).mockReturnValue({ data: [], isLoading: false } as any);
    vi.mocked(useCreateF10Release).mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.mocked(useProcessF10Release).mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.mocked(useGetF10Release).mockReturnValue({ data: undefined, isLoading: false } as any);

    vi.mocked(useGetF10Catalog).mockReturnValue({
      data: {
        sourceTypes: ["CODEBASE_BUNDLE", "SPC"],
        outputKinds: ["CODE_DJ", "SPC"],
        families: [
          { family: "IDE", liveMode: "EXPORT", fallbackMode: "EXPORT", targets: ["vscode", "cursor"], configuration: "Config", supportedOutputs: ["CODE_DJ"] },
          { family: "GITHUB", liveMode: "USER_AUTHORIZED", fallbackMode: "EXPORT", targets: ["github.com"], configuration: "Config", supportedOutputs: ["CODE_DJ", "SPC"] }
        ],
        httpsRelease: { separate: true, live: true, mode: "SIGNED_F9_OSIRIS_HTTPS" }
      },
      isLoading: false
    } as any);

    vi.mocked(useListF10Sources).mockReturnValue({
      data: [
         { id: "src-1", type: "CODEBASE_BUNDLE", artifactType: "CODEBASE_BUNDLE", outputKind: "CODE_DJ", name: "My App", createdAt: "2024-01-01T00:00:00Z" },
         { id: "src-2", type: "SPC", artifactType: "SPC", outputKind: "SPC", name: "My SPC", createdAt: "2024-01-02T00:00:00Z" }
      ],
      isLoading: false
    } as any);

    vi.mocked(useListF10Destinations).mockReturnValue({ data: [], isLoading: false } as any);
    vi.mocked(useCreateF10Destination).mockReturnValue({ mutate: vi.fn() } as any);
    vi.mocked(useCreateF10ExportManifest).mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({ source: { id: 'src-1' }, profile: { family: 'IDE', target: 'vscode' }, files: [] }) } as any);
    vi.mocked(useDownloadF10Export).mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(new Blob()) } as any);

    URL.createObjectURL = vi.fn().mockReturnValue("mock-url");
    URL.revokeObjectURL = vi.fn();
  });

  it("renders Hybrid Handoff as default tab", () => {
    render(
      <TestWrapper>
        <F10Console />
      </TestWrapper>
    );
    expect(screen.getByText(/TARGET CONFIGURATION/i)).toBeDefined();
    expect(screen.getByText(/My App/i)).toBeDefined();
  });

  it("filters sources by output kind", async () => {
    render(
      <TestWrapper>
        <F10Console />
      </TestWrapper>
    );
    expect(screen.getByText(/My App/i)).toBeDefined();
    expect(screen.getByText(/My SPC/i)).toBeDefined();

    const filterBtn = screen.getByTestId("filter-SPC");
    await userEvent.click(filterBtn);

    expect(screen.queryByText(/My App/i)).toBeNull();
    expect(screen.getByText(/My SPC/i)).toBeDefined();
  });

  it("selects dependent targets and displays honest labels", async () => {
    render(
      <TestWrapper>
        <F10Console />
      </TestWrapper>
    );

    await userEvent.click(screen.getByTestId("source-row-src-1"));

    // Select family IDE
    const familyTrigger = screen.getByTestId("select-family");
    await userEvent.click(familyTrigger);
    await userEvent.click(screen.getByTestId("family-option-IDE"));

    // Target should auto-select first item (vscode)
    const targetTrigger = screen.getByTestId("select-target");
    expect(targetTrigger.textContent).toContain("vscode");

    // Label for EXPORT
    expect(screen.getByText(/Export bundle\. Connects through your own/i)).toBeDefined();

    // Select family GITHUB
    await userEvent.click(familyTrigger);
    await userEvent.click(screen.getByTestId("family-option-GITHUB"));

    // Label for USER_AUTHORIZED
    expect(screen.getByText(/Bundle can be pushed using existing user-authorized GitHub flow/i)).toBeDefined();
  });

  it("can preview manifest and download bundle", async () => {
    render(
      <TestWrapper>
        <F10Console />
      </TestWrapper>
    );

    await userEvent.click(screen.getByTestId("source-row-src-1"));

    const familyTrigger = screen.getByTestId("select-family");
    await userEvent.click(familyTrigger);
    await userEvent.click(screen.getByTestId("family-option-IDE"));

    const previewBtn = screen.getByTestId("btn-preview-manifest");
    await userEvent.click(previewBtn);

    expect(useCreateF10ExportManifest().mutateAsync).toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByText(/MANIFEST PREVIEW/i)).toBeDefined();
    });
  });

  it("can download bundle", async () => {
    render(
      <TestWrapper>
        <F10Console />
      </TestWrapper>
    );

    await userEvent.click(screen.getByTestId("source-row-src-1"));

    const familyTrigger = screen.getByTestId("select-family");
    await userEvent.click(familyTrigger);
    await userEvent.click(screen.getByTestId("family-option-IDE"));

    const downloadBtn = screen.getByTestId("btn-download-bundle");
    await userEvent.click(downloadBtn);

    expect(useDownloadF10Export().mutateAsync).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});