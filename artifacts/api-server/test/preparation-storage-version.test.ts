import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ metadata: vi.fn(), remove: vi.fn() }));
vi.mock("@google-cloud/storage", () => ({
  Storage: class {
    bucket() { return { file() { return { getMetadata: mocks.metadata, delete: mocks.remove }; } }; }
  },
}));
import { inspectPrivate, deletePrivateVersion } from "../src/lib/artifact-operations/private-storage";

describe("generation-bound private recovery storage", () => {
  const key = "spartan-preparations/owner/preparation/file-0";
  beforeEach(() => {
    vi.stubEnv("PRIVATE_OBJECT_DIR", "fixture-bucket/private");
    mocks.metadata.mockReset();
    mocks.remove.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => vi.unstubAllEnvs());
  it("reads creation/version metadata without downloading file bytes", async () => {
    mocks.metadata.mockResolvedValue([{ generation: "123", timeCreated: "2026-01-01T00:00:00.000Z" }]);
    expect(await inspectPrivate(key)).toEqual({ generation: "123", createdAt: new Date("2026-01-01") });
  });
  it("does not guess missing creation/version metadata", async () => {
    mocks.metadata.mockResolvedValue([{}]);
    await expect(inspectPrivate(key)).rejects.toThrow("trustworthy");
  });
  it("treats a missing object as missing, not as a successful deletion", async () => {
    mocks.metadata.mockRejectedValue({ code: 404 });
    expect(await inspectPrivate(key)).toBeNull();
    mocks.remove.mockRejectedValue({ code: 404 });
    expect(await deletePrivateVersion(key, "123")).toBe("missing");
  });
  it("passes the inspected generation as a mandatory delete precondition", async () => {
    expect(await deletePrivateVersion(key, "123")).toBe("deleted");
    expect(mocks.remove).toHaveBeenCalledWith({ ifGenerationMatch: "123" });
  });
  it("retains a changed generation and propagates other storage failures", async () => {
    mocks.remove.mockRejectedValueOnce({ code: 412 }).mockRejectedValueOnce(new Error("unavailable"));
    expect(await deletePrivateVersion(key, "123")).toBe("changed");
    await expect(deletePrivateVersion(key, "123")).rejects.toThrow("unavailable");
  });
  it("cannot target unrelated private keys or omit the generation", async () => {
    await expect(deletePrivateVersion("imprima/other/file", "123")).rejects.toThrow("Invalid");
    await expect(deletePrivateVersion(key, "")).rejects.toThrow("Invalid");
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
