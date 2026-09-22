import { describe, it, expect } from "vitest";
import { F_PROCESS_ROLES } from "./constants";

describe("F_PROCESS_ROLES", () => {
  it("should have exactly 13 roles", () => {
    expect(F_PROCESS_ROLES.length).toBe(13);
  });

  it("should be ordered correctly from F0 to F10", () => {
    const expectedIds = [
      "F0", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F9.5", "F10", "F11"
    ];
    const actualIds = F_PROCESS_ROLES.map(r => r.id);
    expect(actualIds).toEqual(expectedIds);
  });

  it("should have unique ids", () => {
    const ids = F_PROCESS_ROLES.map(r => r.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should have correct statuses for operational vs contract", () => {
    const operational = ["F0", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F9.5", "F10", "F11"];

    operational.forEach(id => {
      const role = F_PROCESS_ROLES.find(r => r.id === id);
      expect(role?.status).toBe("operational");
    });

  });
});
