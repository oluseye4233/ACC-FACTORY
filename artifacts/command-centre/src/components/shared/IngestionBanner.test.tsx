// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { IngestionDocument } from "@workspace/api-client-react";

// ---------- mocks ----------
// The banner surfaces the clipboard-denied path through `useToast`, so it is
// mocked to keep the assertions on the component's own behaviour rather than on
// real DOM toast plumbing.
const toastMock = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

import { IngestionBanner } from "./IngestionBanner";

/** A complete IngestionDocument, overridable per test. */
const makeIngestion = (
  overrides: Partial<IngestionDocument> = {},
): IngestionDocument =>
  ({
    id: "ing-1",
    sessionId: "session-1",
    sourceDocKind: "product_design_document",
    originalFilename: "brief.pdf",
    detectedTitle: "Detected Brief Title",
    summary: "An extracted summary of the source document.",
    seedPrompt: "Seed prompt text to paste into F1.",
    ...overrides,
  }) as IngestionDocument;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("IngestionBanner — source-doc kind label", () => {
  it.each([
    ["product_design_document", "INGESTION PRODUCT DESIGN DOCUMENT"],
    ["software_design_document", "SOFTWARE DESIGN DOCUMENT"],
    ["concept_note", "CONCEPT NOTE"],
    ["spec_sheet", "SPEC SHEET"],
    ["other", "SOURCE DOCUMENT"],
  ])("renders the KIND_LABEL for %s", (kind, label) => {
    render(
      <IngestionBanner
        ingestion={makeIngestion({
          sourceDocKind: kind as IngestionDocument["sourceDocKind"],
        })}
        isF7={false}
      />,
    );
    expect(screen.getByText(`INGESTED · ${label}`)).toBeTruthy();
  });
});

describe("IngestionBanner — title fallback", () => {
  it("shows detectedTitle when present", () => {
    render(
      <IngestionBanner
        ingestion={makeIngestion({ detectedTitle: "My Title" })}
        isF7={false}
      />,
    );
    expect(screen.getByText("My Title")).toBeTruthy();
    expect(screen.queryByText("brief.pdf")).toBeNull();
  });

  it("falls back to originalFilename when detectedTitle is null", () => {
    render(
      <IngestionBanner
        ingestion={makeIngestion({
          detectedTitle: null,
          originalFilename: "fallback.pdf",
        })}
        isF7={false}
      />,
    );
    expect(screen.getByText("fallback.pdf")).toBeTruthy();
  });
});

describe("IngestionBanner — seed prompt panel toggle", () => {
  it("is collapsed by default and toggles open then closed", () => {
    render(<IngestionBanner ingestion={makeIngestion()} isF7={false} />);

    // Collapsed: the seed prompt + summary are not in the DOM.
    expect(screen.queryByText("EXTRACTED SUMMARY")).toBeNull();
    expect(screen.queryByText("Seed prompt text to paste into F1.")).toBeNull();

    // Open it.
    fireEvent.click(screen.getByTestId("button-toggle-seed"));
    expect(screen.getByText("EXTRACTED SUMMARY")).toBeTruthy();
    expect(
      screen.getByText("An extracted summary of the source document."),
    ).toBeTruthy();
    expect(
      screen.getByText("Seed prompt text to paste into F1."),
    ).toBeTruthy();

    // Close it again.
    fireEvent.click(screen.getByTestId("button-toggle-seed"));
    expect(screen.queryByText("EXTRACTED SUMMARY")).toBeNull();
  });
});

describe("IngestionBanner — copy button", () => {
  it("writes the seed prompt to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <IngestionBanner
        ingestion={makeIngestion({ seedPrompt: "COPY ME" })}
        isF7={false}
      />,
    );

    fireEvent.click(screen.getByTestId("button-toggle-seed"));
    fireEvent.click(screen.getByTestId("button-copy-seed"));

    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("COPY ME");
    });
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("surfaces a toast when clipboard access is denied", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<IngestionBanner ingestion={makeIngestion()} isF7={false} />);

    fireEvent.click(screen.getByTestId("button-toggle-seed"));
    fireEvent.click(screen.getByTestId("button-copy-seed"));

    await vi.waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      );
    });
  });
});

describe("IngestionBanner — PWDD note", () => {
  it("does not render the PWDD note when isF7 is false", () => {
    render(<IngestionBanner ingestion={makeIngestion()} isF7={false} />);
    expect(screen.queryByText(/PromptWare Design Document/)).toBeNull();
  });

  it("renders the PWDD note when isF7 is true", () => {
    render(<IngestionBanner ingestion={makeIngestion()} isF7={true} />);
    expect(screen.getByText(/PromptWare Design Document/)).toBeTruthy();
  });
});
