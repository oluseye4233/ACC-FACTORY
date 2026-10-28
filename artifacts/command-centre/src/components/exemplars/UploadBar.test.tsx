// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("./invalidate", () => ({ invalidateCatalog: vi.fn() }));
import { UploadBar } from "./UploadBar";

const wrap = (ui: JSX.Element) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

describe("UploadBar", () => {
  it("outside the portal links to the library intake tab with no file picker", () => {
    const { container } = wrap(<UploadBar />);
    expect(screen.getByTestId("link-library-intake").getAttribute("href")).toBe("/imprima-portal?tab=intake&intake=library");
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });
  it("embedded keeps the archive upload controls", () => {
    const { container } = wrap(<UploadBar embedded />);
    expect(container.querySelectorAll('input[type="file"]').length).toBe(2);
    expect(screen.getByTestId("button-upload-folder")).toBeTruthy();
  });
});
