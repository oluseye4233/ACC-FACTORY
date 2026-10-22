// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StartNewSessionButton } from "./StartNewSessionButton";

afterEach(cleanup);

describe("StartNewSessionButton", () => {
  it("opens all three existing entry routes", async () => {
    const user = userEvent.setup();
    render(<StartNewSessionButton />);
    await user.click(screen.getByRole("button", { name: "START NEW SESSION" }));
    for (const [label, href] of [
      ["NEW SESSION", "/session/new"],
      ["INGESTION", "/ingest"],
      ["CARTRIDGE", "/cartridge"],
    ]) {
      expect(screen.getByRole("menuitem", { name: new RegExp(`^${label}`) }).getAttribute("href")).toBe(href);
    }
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("opens using the keyboard", async () => {
    const user = userEvent.setup();
    render(<StartNewSessionButton />);
    screen.getByRole("button", { name: "START NEW SESSION" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getAllByRole("menuitem")).toHaveLength(3);
  });
});
