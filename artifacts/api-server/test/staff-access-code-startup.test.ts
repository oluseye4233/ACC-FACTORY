import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertAccessCodeConfigured } from "../src/lib/staff-auth";

describe("assertAccessCodeConfigured (startup fail-fast)", () => {
  const originalCode = process.env.STAFF_ACCESS_CODE;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    delete process.env.STAFF_ACCESS_CODE;
  });

  afterEach(() => {
    if (originalCode === undefined) delete process.env.STAFF_ACCESS_CODE;
    else process.env.STAFF_ACCESS_CODE = originalCode;
    if (originalEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv;
  });

  it("throws and logs an error in production when the code is unset", () => {
    process.env.NODE_ENV = "production";
    const log = { warn: vi.fn(), error: vi.fn() };
    expect(() => assertAccessCodeConfigured(log)).toThrow(/STAFF_ACCESS_CODE/);
    expect(log.error).toHaveBeenCalledOnce();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("only warns (does not throw) in development when the code is unset", () => {
    process.env.NODE_ENV = "development";
    const log = { warn: vi.fn(), error: vi.fn() };
    expect(() => assertAccessCodeConfigured(log)).not.toThrow();
    expect(log.warn).toHaveBeenCalledOnce();
    expect(log.error).not.toHaveBeenCalled();
  });

  it("is a no-op when the code is configured, even in production", () => {
    process.env.NODE_ENV = "production";
    process.env.STAFF_ACCESS_CODE = "s3cret-code";
    const log = { warn: vi.fn(), error: vi.fn() };
    expect(() => assertAccessCodeConfigured(log)).not.toThrow();
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });
});
