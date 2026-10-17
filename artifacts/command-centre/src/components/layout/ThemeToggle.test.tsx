// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { ThemeToggle } from "./ThemeToggle";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (media: string) => ({
    matches: false,
    media,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

afterEach(() => {
  cleanup();
  localStorage.removeItem("atanda-theme");
  document.documentElement.classList.remove("dark", "light");
});

describe("ThemeToggle", () => {
  it("switches palettes and remembers the choice", async () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="light" storageKey="atanda-theme">
        <ThemeToggle />
      </ThemeProvider>,
    );

    const toggle = screen.getByTestId("button-theme-toggle");
    await waitFor(() => expect(document.documentElement.classList.contains("light")).toBe(true));
    expect(toggle.getAttribute("aria-label")).toBe("Switch to dark mode");

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(localStorage.getItem("atanda-theme")).toBe("dark");
    });
    expect(toggle.getAttribute("aria-label")).toBe("Switch to light mode");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
  });
});
