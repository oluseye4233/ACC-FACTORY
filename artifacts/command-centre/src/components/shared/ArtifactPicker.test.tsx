// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ArtifactPicker } from "./ArtifactPicker";

const state = vi.hoisted(() => ({ data: [] as unknown[], isLoading: false, isError: false }));
vi.mock("@workspace/api-client-react", () => ({ useListArtifacts: () => state }));

beforeEach(() => {
  state.data = [{ id: "artifact-a", sessionId: "session-a", featureId: 4, name: "MICRO PDD",
    artifactType: "MICRO_PDD", artifactContent: { project_name: "Solar Inspection Planner" },
    createdAt: "2026-10-18T01:00:00Z" }];
  state.isLoading = false;
  state.isError = false;
});
afterEach(cleanup);

describe("ArtifactPicker context modes", () => {
  it("shows a named, fixed source with its stable ID and no dropdown in an F-process", () => {
    render(<ArtifactPicker value="artifact-a" onChange={vi.fn()} readOnly />);
    expect(screen.getByText("Solar Inspection Planner")).toBeTruthy();
    expect(screen.getByText("Artifact ID: artifact-a")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
  it("keeps the standalone selector and identifies the selected artifact clearly", () => {
    render(<ArtifactPicker value="artifact-a" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toBeTruthy();
    expect(screen.getByText("Selected: Solar Inspection Planner")).toBeTruthy();
    expect(screen.getByText("Artifact ID: artifact-a")).toBeTruthy();
  });
  it("reports a missing pinned source without selecting another file", () => {
    const onChange = vi.fn();
    render(<ArtifactPicker value="deleted" onChange={onChange} readOnly />);
    expect(screen.getByRole("alert").textContent).toMatch(/unavailable/);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
  it("reports a query failure distinctly", () => {
    state.data = [];
    state.isError = true;
    render(<ArtifactPicker value="artifact-a" onChange={vi.fn()} readOnly />);
    expect(screen.getByRole("alert").textContent).toMatch(/Unable to load/);
  });
});
