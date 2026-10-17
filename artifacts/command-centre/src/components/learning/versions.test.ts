import { expect, test } from "vitest";
import type { LearningAssignment, LearningSubmission } from "@workspace/api-client-react";
import { latestSubmission, isLessonDone } from "./learning-model";
test("review targets the highest submission version, regardless of API ordering", () => {
  const newer = { id: "new", version: 4, sourceChanged: false, reviews: [] } as unknown as LearningSubmission;
  const older = { id: "old", version: 2, sourceChanged: false, reviews: [{ decision: "LEARNING_COMPLETE" }] } as unknown as LearningSubmission;
  const a = { state: "SUBMITTED", submissions: [newer, older] } as LearningAssignment;
  expect(latestSubmission(a)?.id).toBe("new");
  expect(latestSubmission({ ...a, submissions: [older, newer] })?.id).toBe("new");
  expect(isLessonDone(a)).toBe(false);
  expect(isLessonDone({ ...a, state: "LEARNING_COMPLETE" })).toBe(true);
  expect(isLessonDone({ ...a, state: "LEARNING_COMPLETE", submissions: [{ ...newer, sourceChanged: true }, older] })).toBe(false);
});
