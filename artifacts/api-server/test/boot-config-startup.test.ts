import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertBootCriticalConfig } from "../src/lib/boot-config";

describe("assertBootCriticalConfig (startup fail-fast)", () => {
  const keys = ["STAFF_ACCESS_CODE", "SESSION_SECRET", "DATABASE_URL", "NODE_ENV"] as const;
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of keys) original[k] = process.env[k];
    // Start from a fully-configured baseline; each test removes what it needs.
    process.env.STAFF_ACCESS_CODE = "s3cret-code";
    process.env.SESSION_SECRET = "sess-secret";
    process.env.DATABASE_URL = "postgres://localhost/db";
  });

  afterEach(() => {
    for (const k of keys) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  });

  it("throws and logs an error in production when SESSION_SECRET is unset", () => {
    process.env.NODE_ENV = "production";
    delete process.env.SESSION_SECRET;
    const log = { warn: vi.fn(), error: vi.fn() };
    expect(() => assertBootCriticalConfig(log)).toThrow(/SESSION_SECRET/);
    expect(log.error).toHaveBeenCalledOnce();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("throws and logs an error in production when DATABASE_URL is unset", () => {
    process.env.NODE_ENV = "production";
    delete process.env.DATABASE_URL;
    const log = { warn: vi.fn(), error: vi.fn() };
    expect(() => assertBootCriticalConfig(log)).toThrow(/DATABASE_URL/);
    expect(log.error).toHaveBeenCalledOnce();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("reports every missing setting in one message", () => {
    process.env.NODE_ENV = "production";
    delete process.env.STAFF_ACCESS_CODE;
    delete process.env.SESSION_SECRET;
    delete process.env.DATABASE_URL;
    const log = { warn: vi.fn(), error: vi.fn() };
    expect(() => assertBootCriticalConfig(log)).toThrow(
      /STAFF_ACCESS_CODE.*SESSION_SECRET.*DATABASE_URL/s,
    );
    expect(log.error).toHaveBeenCalledOnce();
  });

  it("only warns (does not throw) in development when a setting is unset", () => {
    process.env.NODE_ENV = "development";
    delete process.env.SESSION_SECRET;
    const log = { warn: vi.fn(), error: vi.fn() };
    expect(() => assertBootCriticalConfig(log)).not.toThrow();
    expect(log.warn).toHaveBeenCalledOnce();
    expect(log.error).not.toHaveBeenCalled();
  });

  it("is a no-op when every setting is configured, even in production", () => {
    process.env.NODE_ENV = "production";
    const log = { warn: vi.fn(), error: vi.fn() };
    expect(() => assertBootCriticalConfig(log)).not.toThrow();
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });
});
