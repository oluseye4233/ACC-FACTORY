// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { focusMainContent, isCurrentDestination } from "./navigation";

afterEach(() => { document.body.innerHTML = ""; });

describe("current navigation destination", () => {
  it("matches the current page but not a similarly named page", () => {
    expect(isCurrentDestination("/guide", "/guide", "")).toBe(true);
    expect(isCurrentDestination("/guide", "/guidebook", "")).toBe(false);
  });
  it("keeps parent navigation current on detail screens", () => {
    expect(isCurrentDestination("/spc-player", "/spc-player/new", "")).toBe(true);
    expect(isCurrentDestination("/exemplars", "/exemplars/artifact-123", "")).toBe(true);
    expect(isCurrentDestination("/sessions", "/session/session-123", "")).toBe(true);
    expect(isCurrentDestination("/sessions", "/session/new", "")).toBe(true);
  });
  it("distinguishes the two operations views and ignores unrelated query parameters", () => {
    expect(isCurrentDestination("/operations?kind=imprima", "/operations", "kind=short-sprints&sourceId=123")).toBe(false);
    expect(isCurrentDestination("/operations?kind=short-sprints", "/operations", "?kind=short-sprints&sourceId=123")).toBe(true);
    expect(isCurrentDestination("/operations?kind=imprima", "/operations", "")).toBe(true);
    expect(isCurrentDestination("/operations?kind=short-sprints", "/operations", "")).toBe(false);
  });
  it("uses the same default view as the operations page for an unrecognized kind", () => {
    expect(isCurrentDestination("/operations?kind=imprima", "/operations", "kind=unknown")).toBe(true);
  });
  it("does not mark other admin destinations as current", () => {
    expect(isCurrentDestination("/admin/ops", "/admin/badges", "")).toBe(false);
  });
});

describe("skip navigation focus", () => {
  it("focuses the page landmark without adding a tab stop", () => {
    document.body.innerHTML = "<header><a href='/'>Home</a></header><main><h1>Quests</h1></main>";
    expect(focusMainContent()).toBe(true);
    const main = document.querySelector("main")!;
    expect(document.activeElement).toBe(main);
    expect(main.tabIndex).toBe(-1);
    expect(main.id).toBe("main-content");
  });
  it("preserves an existing landmark identity and tab behavior", () => {
    document.body.innerHTML = '<main id="training" tabindex="0"></main>';
    expect(focusMainContent()).toBe(true);
    expect(document.querySelector("main")!.id).toBe("training");
    expect(document.querySelector("main")!.tabIndex).toBe(0);
  });
  it("does not throw during a loading state with no main content", () => {
    expect(focusMainContent()).toBe(false);
  });
});
