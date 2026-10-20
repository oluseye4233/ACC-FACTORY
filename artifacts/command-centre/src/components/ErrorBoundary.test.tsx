// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
vi.mock("@sentry/react", () => ({ captureException: vi.fn() }));
import { ErrorBoundary, isChunkLoadError } from "./ErrorBoundary";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("page download failures", () => {
  it.each([
    "Failed to fetch dynamically imported module: /assets/guide.js",
    "Importing a module script failed.",
    "error loading dynamically imported module: /assets/guide.js",
    "Loading chunk 123 failed.",
  ])("recognizes browser module download error: %s", message => {
    expect(isChunkLoadError(new Error(message))).toBe(true);
  });

  it("recognizes the webpack-style named error without misclassifying render failures", () => {
    const error = new Error("Download unavailable");
    error.name = "ChunkLoadError";
    expect(isChunkLoadError(error)).toBe(true);
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });

  it("shows an explicit reload action instead of hanging or automatically reloading", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    function BrokenPage(): never { throw new Error("Failed to fetch dynamically imported module"); }
    render(<ErrorBoundary><BrokenPage /></ErrorBoundary>);
    expect(screen.getByRole("heading", { name: "PAGE DOWNLOAD FAILED" })).toBeTruthy();
    expect(screen.getByText(/Check your connection, then reload/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "RELOAD" })).toBeTruthy();
  });
});
