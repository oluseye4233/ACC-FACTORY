import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { verifyArkXEligibilityAssertion } from "../src/lib/ark-x-eligibility";
import { arkXHiveGoldWireClaims } from "./fixtures/ark-x-hive-gold-wire";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const originalEnv = { ...process.env };

function assertion(overrides: Record<string, unknown> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "RS256", kid: "ark-x-test-key" });
  const claims = encode({
    ...arkXHiveGoldWireClaims,
    iat: now,
    exp: now + 300,
    ...overrides,
  });
  const input = `${header}.${claims}`;
  return `${input}.${sign("RSA-SHA256", Buffer.from(input), privateKey).toString("base64url")}`;
}

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("ARK-X eligibility assertions", () => {
  it("accepts the exact ARK issuer wire claims with numeric version 1", () => {
    process.env.ARK_X_PUBLIC_KEY = publicKey.export({ type: "spki", format: "pem" }).toString();
    process.env.ARK_X_PUBLIC_KEY_KID = "ark-x-test-key";
    process.env.ARK_X_ALLOWED_ALGORITHMS = "RS256";

    expect(verifyArkXEligibilityAssertion(assertion())).toEqual({
      sub: "ark-subject-123",
      jti: "assertion-123",
    });
  });

  it("rejects altered claims, long-lived assertions, and an untrusted KID", () => {
    process.env.ARK_X_PUBLIC_KEY = publicKey.export({ type: "spki", format: "pem" }).toString();
    process.env.ARK_X_PUBLIC_KEY_KID = "ark-x-test-key";
    process.env.ARK_X_ALLOWED_ALGORITHMS = "RS256";

    expect(() => verifyArkXEligibilityAssertion(assertion({ aud: "another-service" }))).toThrow();
    expect(() => verifyArkXEligibilityAssertion(assertion({ exp: Math.floor(Date.now() / 1000) + 601 }))).toThrow();

    process.env.ARK_X_PUBLIC_KEY_KID = "different-key";
    expect(() => verifyArkXEligibilityAssertion(assertion())).toThrow();
  });
});