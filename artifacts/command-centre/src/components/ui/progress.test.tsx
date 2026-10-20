// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Progress } from "./progress";

afterEach(cleanup);

describe("accessible progress values", () => {
  it("reports the same completion value that it draws", () => {
    render(<Progress aria-label="Badge requirements" value={42} />);
    const bar = screen.getByRole("progressbar", { name: "Badge requirements" });
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
    expect(bar.getAttribute("data-state")).toBe("loading");
    expect((bar.firstElementChild as HTMLElement).style.transform).toBe("translateX(-58%)");
  });

  it("supports requirement counts rather than assuming a percentage scale", () => {
    render(<Progress aria-label="SPCs" value={2} max={3} getValueLabel={(value, max) => `${value} of ${max} SPCs`} />);
    const bar = screen.getByRole("progressbar", { name: "SPCs" });
    expect(bar.getAttribute("aria-valuenow")).toBe("2");
    expect(bar.getAttribute("aria-valuemax")).toBe("3");
    expect(bar.getAttribute("aria-valuetext")).toBe("2 of 3 SPCs");
  });

  it("marks zero as measured progress, not indeterminate", () => {
    render(<Progress aria-label="Builds" value={0} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
  });

  it("marks completion correctly", () => {
    render(<Progress value={100} aria-label="Completed" />);
    expect(screen.getByRole("progressbar").getAttribute("data-state")).toBe("complete");
  });

  it("does not invent numeric progress for unknown or non-finite values", () => {
    const { rerender } = render(<Progress aria-label="Unknown" />);
    for (const value of [undefined, null, NaN, Infinity]) {
      rerender(<Progress value={value} aria-label="Unknown" />);
      expect(screen.getByRole("progressbar").hasAttribute("aria-valuenow")).toBe(false);
      expect(screen.getByRole("progressbar").getAttribute("data-state")).toBe("indeterminate");
    }
  });

  it("clamps the visual and accessible values consistently", () => {
    const { rerender } = render(<Progress value={12} max={7} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("7");
    rerender(<Progress value={-4} max={7} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
  });

  it("rejects invalid maxima without producing invalid transforms", () => {
    const { rerender } = render(<Progress value={50} />);
    for (const max of [0, -1, NaN, Infinity]) {
      rerender(<Progress value={50} max={max} />);
      const bar = screen.getByRole("progressbar");
      expect(bar.getAttribute("aria-valuemax")).toBe("100");
      expect((bar.firstElementChild as HTMLElement).style.transform).toBe("translateX(-50%)");
    }
  });
});
