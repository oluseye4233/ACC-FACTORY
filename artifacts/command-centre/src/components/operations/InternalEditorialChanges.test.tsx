// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { InternalEditorialChanges } from "./InternalEditorialChanges";
afterEach(cleanup);
const evidence = { sourceHash: "source", reviewedContentHash: "reviewed", changes: [
  { blockId: "block-2", before: "Before <script>", after: "Clearer text" },
] };
describe("private KLARITY comparison", () => {
  it("shows exact recorded edits as inert text with the internal-only caveat", () => {
    render(<InternalEditorialChanges value={evidence} sourceHash="source" />);
    expect(screen.getByLabelText("KLARITY paragraph changes").textContent).toContain("− Before <script>");
    expect(screen.getByLabelText("KLARITY paragraph changes").textContent).toContain("+ Clearer text");
    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByText(/does not establish truth/)).toBeTruthy();
  });
  it("does not infer missing legacy evidence or present mismatched source edits", () => {
    const view = render(<InternalEditorialChanges value={undefined} sourceHash="source" />);
    expect(screen.getByText(/not retained/)).toBeTruthy();
    view.unmount();
    render(<InternalEditorialChanges value={evidence} sourceHash="different" />);
    expect(screen.getByRole("alert").textContent).toContain("does not match");
    expect(screen.queryByLabelText("KLARITY paragraph changes")).toBeNull();
  });
  it("distinguishes no changes from no retained review", () => {
    render(<InternalEditorialChanges value={{ ...evidence, changes: [] }} sourceHash="source" />);
    expect(screen.getByText(/No paragraph edits were applied/)).toBeTruthy();
  });
});
