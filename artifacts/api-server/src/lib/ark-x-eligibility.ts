import { createPublicKey, verify as verifySignature } from "node:crypto";

const ISSUER = "ark-x";
const AUDIENCE = "acc-factory";
const ELIGIBILITY = "hive_gold";
const DISCOUNT_PERCENT = 50;
const VERSION = 1;
const MAX_LIFETIME_SECONDS = 10 * 60;
const CLOCK_SKEW_SECONDS = 60;

const algorithms: Record<string, { digest: string; keyTypes: readonly string[] }> = {
  RS256: { digest: "RSA-SHA256", keyTypes: ["rsa", "rsa-pss"] },
  RS384: { digest: "RSA-SHA384", keyTypes: ["rsa", "rsa-pss"] },
  RS512: { digest: "RSA-SHA512", keyTypes: ["rsa", "rsa-pss"] },
  ES256: { digest: "sha256", keyTypes: ["ec"] },
  ES384: { digest: "sha384", keyTypes: ["ec"] },
  ES512: { digest: "sha512", keyTypes: ["ec"] },
};

export interface ArkXEligibilityAssertion {
  sub: string;
  jti: string;
}

type JwtHeader = { alg?: unknown; kid?: unknown };
type JwtClaims = Record<string, unknown>;

function decodeSegment(segment: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) throw new Error("malformed JWT encoding");
  return Buffer.from(segment, "base64url");
}

function decodeJson<T>(segment: string, label: string): T {
  try {
    return JSON.parse(Buffer.from(decodeSegment(segment)).toString("utf8")) as T;
  } catch {
    throw new Error(`malformed JWT ${label}`);
  }
}

function configuredAlgorithms(): Set<string> {
  // A restrictive default prevents an accidentally broad algorithm policy.
  const names = (process.env.ARK_X_ALLOWED_ALGORITHMS ?? "RS256")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  if (!names.length || names.some((name) => !algorithms[name])) {
    throw new Error("ARK-X algorithm allowlist is invalid");
  }
  return new Set(names);
}

function isAudience(value: unknown): boolean {
  return value === AUDIENCE || (Array.isArray(value) && value.every((v) => typeof v === "string") && value.includes(AUDIENCE));
}

function numberClaim(claims: JwtClaims, name: "iat" | "exp"): number {
  const value = claims[name];
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`ARK-X assertion ${name} claim is invalid`);
  }
  return value;
}

/**
 * Verify an ARK-X signed eligibility JWT against the locally pinned key.
 * This intentionally does not use a remote JWKS: ACC-FACTORY is the
 * subscription authority and only trusts the configured ARK-X key/KID.
 */
export function verifyArkXEligibilityAssertion(token: string): ArkXEligibilityAssertion {
  if (typeof token !== "string" || token.length > 16_384) {
    throw new Error("ARK-X assertion is invalid");
  }
  const [encodedHeader, encodedClaims, encodedSignature, ...extra] = token.split(".");
  if (!encodedHeader || !encodedClaims || !encodedSignature || extra.length) {
    throw new Error("ARK-X assertion must be a compact JWT");
  }

  const header = decodeJson<JwtHeader>(encodedHeader, "header");
  if (typeof header.alg !== "string" || typeof header.kid !== "string") {
    throw new Error("ARK-X assertion header is invalid");
  }
  const pinnedKid = process.env.ARK_X_PUBLIC_KEY_KID;
  const publicKeyPem = process.env.ARK_X_PUBLIC_KEY;
  if (!pinnedKid || !publicKeyPem) {
    throw new Error("ARK-X eligibility verification is not configured");
  }
  if (header.kid !== pinnedKid) throw new Error("ARK-X assertion KID is not trusted");
  const policy = algorithms[header.alg];
  if (!policy || !configuredAlgorithms().has(header.alg)) {
    throw new Error("ARK-X assertion algorithm is not allowed");
  }

  let publicKey;
  try {
    publicKey = createPublicKey(publicKeyPem.replace(/\\n/g, "\n"));
  } catch {
    throw new Error("ARK-X public key is invalid");
  }
  if (!policy.keyTypes.includes(publicKey.asymmetricKeyType ?? "")) {
    throw new Error("ARK-X assertion algorithm does not match pinned key");
  }
  const signature = decodeSegment(encodedSignature);
  const verified = verifySignature(
    policy.digest,
    Buffer.from(`${encodedHeader}.${encodedClaims}`),
    header.alg.startsWith("ES") ? { key: publicKey, dsaEncoding: "ieee-p1363" } : publicKey,
    signature,
  );
  if (!verified) throw new Error("ARK-X assertion signature is invalid");

  const claims = decodeJson<JwtClaims>(encodedClaims, "claims");
  if (
    claims.iss !== ISSUER ||
    !isAudience(claims.aud) ||
    claims.eligibility !== ELIGIBILITY ||
    claims.discountPercent !== DISCOUNT_PERCENT ||
    claims.version !== VERSION ||
    typeof claims.sub !== "string" ||
    !claims.sub.trim() ||
    typeof claims.jti !== "string" ||
    !claims.jti.trim()
  ) {
    throw new Error("ARK-X assertion claims are invalid");
  }
  const iat = numberClaim(claims, "iat");
  const exp = numberClaim(claims, "exp");
  const now = Math.floor(Date.now() / 1000);
  if (iat > now + CLOCK_SKEW_SECONDS || exp <= now - CLOCK_SKEW_SECONDS || exp <= iat || exp - iat > MAX_LIFETIME_SECONDS) {
    throw new Error("ARK-X assertion is expired or not short-lived");
  }
  return { sub: claims.sub, jti: claims.jti };
}