// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { LearningAssignment, LearningLesson, LearningMembership } from "@workspace/api-client-react";

const mutate = vi.fn();
vi.mock("@workspace/api-client-react", () => ({
  useSaveLearningAttempt: () => ({ mutate, isPending: false }),
  useListArtifacts: () => ({ data: [], isLoading: false, isError: false }),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));

import { LessonWorkbench } from "./LessonWorkbench";
import { lessonMode, startPayload, submitError, submitPayload, MODE_COPY } from "./learning-model";

const lesson = (mode: string, extra: Partial<LearningLesson> = {}): LearningLesson => ({
  key: `L-${mode}`, title: `Lesson ${mode}`, stage: "F1", track: "BOTH", mode, source: "PDD", purpose: "p", input: "i", example: "e",
  expected: "x", exercise: "do", rubric: ["r1"], href: "", required: true, artifactType: mode === "actual" ? "SPC" : null, ...extra,
});
const member: LearningMembership = { id: "m1", cohortId: "c1", userId: "u", name: "Ada Okafor", role: "STUDENT", state: "ACTIVE", track: "BOTH", completedAt: null, spentUsd: 0, reservedUsd: 0 };
const asg = (version: number, state = "IN_PROGRESS"): LearningAssignment => ({ id: "a1", membershipId: "m1", lessonKey: "L-actual", state, version, submissions: [] });
const UUID = "3f1c2a9e-8b7d-4c21-9f0e-1a2b3c4d5e6f";
const TEXT = "This is more than twenty characters of work.";

afterEach(() => { cleanup(); mutate.mockReset(); });

describe("mode distinction", () => {
  it("normalises backend modes", () => {
    expect(lessonMode("actual")).toBe("ACTUAL_PLATFORM");
    expect(lessonMode("ACTUAL_PLATFORM")).toBe("ACTUAL_PLATFORM");
    expect(lessonMode("simulation")).toBe("SIMULATION");
    expect(lessonMode("reflection")).toBe("REFLECTION");
  });
  it("requires owned artifact ids only for actual platform work", () => {
    expect(submitError(lesson("actual"), TEXT, [])).toMatch(/artifact/);
    expect(submitError(lesson("actual"), TEXT, ["not-a-uuid"])).toMatch(/UUID/);
    expect(submitError(lesson("actual"), TEXT, [UUID])).toBeNull();
    expect(submitError(lesson("reflection"), TEXT, [])).toBeNull();
    expect(submitError(lesson("simulation"), TEXT, [UUID])).toMatch(/do not take artifacts/);
  });
  it("requires 20 characters", () => {
    expect(submitError(lesson("reflection"), "too short", [])).toMatch(/20/);
  });
  it("renders the mode label for each lesson", () => {
    render(<LessonWorkbench lesson={lesson("simulation")} membership={member} />);
    expect(screen.getByTestId("text-mode-explain").textContent).toContain(MODE_COPY.SIMULATION.label);
    expect(screen.getByTestId("status-mode-SIMULATION")).toBeTruthy();
  });
});

describe("mutation versions", () => {
  it("START uses version 0 first, then the current version", () => {
    expect(startPayload("m1", "L", undefined).expectedVersion).toBe(0);
    expect(startPayload("m1", "L", asg(4)).expectedVersion).toBe(4);
  });
  it("SUBMIT sends lesson mode, current version and artifacts only for ACTUAL", () => {
    const p = submitPayload("m1", lesson("actual"), asg(2), `  ${TEXT}  `, [UUID]);
    expect(p).toEqual({ membershipId: "m1", lessonKey: "L-actual", action: "SUBMIT", expectedVersion: 2, mode: "ACTUAL_PLATFORM", text: TEXT, artifactIds: [UUID] });
    const r = submitPayload("m1", lesson("reflection"), asg(3), TEXT, []);
    expect(r.mode).toBe("REFLECTION");
    expect("artifactIds" in r).toBe(false);
  });
  it("start button fires START with expectedVersion 0", () => {
    render(<LessonWorkbench lesson={lesson("reflection")} membership={member} />);
    fireEvent.click(screen.getByTestId("button-start-lesson"));
    expect(mutate.mock.calls[0][0].data).toEqual({ membershipId: "m1", lessonKey: "L-reflection", action: "START", expectedVersion: 0 });
  });
  it("submit form gates on inputs and pastes artifact ids", () => {
    render(<LessonWorkbench lesson={lesson("actual")} membership={member} assignment={asg(1)} />);
    const btn = screen.getByTestId("button-submit-attempt") as HTMLButtonElement;
    fireEvent.change(screen.getByTestId("input-attempt-text"), { target: { value: TEXT } });
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByTestId("input-artifact-ids"), { target: { value: UUID } });
    fireEvent.click(screen.getByTestId("button-add-artifacts"));
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(mutate.mock.calls[0][0].data).toMatchObject({ action: "SUBMIT", expectedVersion: 1, mode: "ACTUAL_PLATFORM", artifactIds: [UUID] });
  });
});

describe("never a credential", () => {
  it("states lesson review issues no credential and has no certify controls", () => {
    render(<LessonWorkbench lesson={lesson("actual")} membership={member} assignment={asg(1, "LEARNING_COMPLETE")} />);
    expect(screen.getByTestId("text-no-credential").textContent).toMatch(/never issues a badge, certificate or Quest credential/);
    expect(screen.queryByText(/certified|badge awarded|credential issued/i)).toBeNull();
  });
});
