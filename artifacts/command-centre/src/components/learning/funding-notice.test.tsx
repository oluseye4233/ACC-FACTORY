// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { UpgradeCTA } from "@/components/shared/UpgradeCTA";
import { api } from "@/lib/api";

vi.mock("@/lib/staff-session", () => ({
  useStaffSession: () => ({ authenticated: true, student: true, role: "USER" }),
}));
vi.mock("@/lib/api", () => ({ api: { get: vi.fn(), post: vi.fn() } }));
afterEach(cleanup);
test("free learners see instructor funding guidance, never a paid checkout", () => {
  const close = vi.fn();
  render(<UpgradeCTA open onOpenChange={close} costCap />);
  expect(screen.getByText("Training allowance or access limit")).toBeTruthy();
  expect(screen.getByText(/FORGE FIELD ENGINEER is free/)).toBeTruthy();
  expect(screen.queryByText("Upgrade to Architect")).toBeNull();
  expect(api.get).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Return to training"));
  expect(close).toHaveBeenCalledWith(false);
});
