// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { LaunchCarousel } from "./LaunchCarousel";

const centre = () => document.querySelector('[data-active="true"]') as HTMLElement;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LaunchCarousel", () => {
  it("renders three stable routed circles with colour semantics", () => {
    render(<LaunchCarousel />);
    const expected = [
      ["button-build-something", "/session/new", "red"],
      ["button-launch-ingestion", "/ingest", "blue"],
      ["button-launch-cartridge", "/cartridge", "green"],
    ];
    for (const [id, href, color] of expected) {
      const el = screen.getByTestId(id);
      expect(el.getAttribute("href")).toBe(href);
      expect(el.getAttribute("data-color")).toBe(color);
    }
    expect(centre().getAttribute("data-testid")).toBe("button-build-something");
    expect(centre().getAttribute("tabindex")).toBe("0");
    expect(screen.getByTestId("button-launch-ingestion").getAttribute("tabindex")).toBe("-1");
  });

  it("cycles in both directions with wrapping", () => {
    render(<LaunchCarousel />);
    fireEvent.click(screen.getByTestId("button-launch-prev"));
    expect(centre().getAttribute("data-color")).toBe("green");
    fireEvent.click(screen.getByTestId("button-launch-next"));
    fireEvent.click(screen.getByTestId("button-launch-next"));
    expect(centre().getAttribute("data-color")).toBe("blue");
    fireEvent.click(screen.getByTestId("button-launch-next"));
    fireEvent.click(screen.getByTestId("button-launch-next"));
    expect(centre().getAttribute("data-color")).toBe("red");
  });

  it("selects a neighbour on click without navigating, and the centre stays navigable", () => {
    render(<LaunchCarousel />);
    const ingest = screen.getByTestId("button-launch-ingestion");
    const neighbourClick = new MouseEvent("click", { bubbles: true, cancelable: true });
    act(() => { ingest.dispatchEvent(neighbourClick); });
    expect(neighbourClick.defaultPrevented).toBe(true);
    expect(centre()).toBe(ingest);
    const centreClick = new MouseEvent("click", { bubbles: true, cancelable: true });
    act(() => { ingest.dispatchEvent(centreClick); });
    expect(centreClick.defaultPrevented).toBe(false);
  });

  it("supports arrow keys", () => {
    render(<LaunchCarousel />);
    const group = screen.getByTestId("launch-carousel");
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(centre().getAttribute("data-color")).toBe("blue");
    fireEvent.keyDown(group, { key: "ArrowLeft" });
    fireEvent.keyDown(group, { key: "ArrowLeft" });
    expect(centre().getAttribute("data-color")).toBe("green");
  });

  it("swipes to change selection and suppresses the click after a swipe", () => {
    render(<LaunchCarousel />);
    const track = screen.getByTestId("launch-carousel-track");
    fireEvent.pointerDown(track, { clientX: 200 });
    fireEvent.pointerUp(track, { clientX: 100 });
    const selected = centre();
    expect(selected.getAttribute("data-color")).toBe("blue");
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    act(() => { selected.dispatchEvent(click); });
    expect(click.defaultPrevented).toBe(true);
    fireEvent.pointerDown(track, { clientX: 100 });
    fireEvent.pointerUp(track, { clientX: 200 });
    expect(centre().getAttribute("data-color")).toBe("red");
    fireEvent.pointerDown(track, { clientX: 100 });
    fireEvent.pointerUp(track, { clientX: 110 });
    expect(centre().getAttribute("data-color")).toBe("red");
  });

  it("drops transitions and glow when reduced motion is preferred", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: q.includes("reduce"),
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    render(<LaunchCarousel />);
    expect(screen.getByTestId("launch-carousel").getAttribute("data-reduced-motion")).toBe("true");
    expect(centre().className).not.toContain("progression-glow");
    expect(centre().className).not.toContain("transition-");
  });
});
