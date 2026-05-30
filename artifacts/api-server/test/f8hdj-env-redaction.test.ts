import { describe, expect, it } from "vitest";
import { redactValueLike, sanitizeEnvKey } from "../src/engines/f8hdj";

describe("F8-HDJ env template sanitisation (keys-only, no secret leak)", () => {
  it("normalises a plain env name", () => {
    expect(sanitizeEnvKey("database_url")).toBe("DATABASE_URL");
    expect(sanitizeEnvKey("  Stripe-Secret-Key ")).toBe("STRIPE_SECRET_KEY");
  });

  it("strips an assignment, keeping only the name", () => {
    expect(sanitizeEnvKey("DATABASE_URL=postgres://user:pw@host/db")).toBe(
      "DATABASE_URL",
    );
    expect(sanitizeEnvKey("API_KEY = sk-live-abcdef")).toBe("API_KEY");
  });

  it("rejects a key that cannot become a bare name", () => {
    expect(sanitizeEnvKey("=value-only")).toBeNull();
    expect(sanitizeEnvKey("123")).toBeNull();
    expect(sanitizeEnvKey("")).toBeNull();
  });

  it("redacts assignment values in descriptions", () => {
    expect(redactValueLike("set DATABASE_URL=postgres://u:p@h/db here")).not.toContain(
      "postgres://u:p@h/db",
    );
    expect(redactValueLike("token=sk-live-supersecretvalue")).toContain(
      "<redacted>",
    );
  });

  it("redacts URLs / connection strings in descriptions", () => {
    const out = redactValueLike("connect to https://api.example.com/v1/secret-path");
    expect(out).toContain("<redacted-url>");
    expect(out).not.toContain("secret-path");
  });

  it("redacts long opaque tokens in descriptions", () => {
    const out = redactValueLike("paste AKIAIOSFODNN7EXAMPLEKEY1234567890 into env");
    expect(out).not.toContain("AKIAIOSFODNN7EXAMPLEKEY1234567890");
    expect(out).toContain("<redacted>");
  });

  it("leaves a clean human description untouched", () => {
    const clean = "Postgres connection string for the primary database.";
    expect(redactValueLike(clean)).toBe(clean);
  });
});
