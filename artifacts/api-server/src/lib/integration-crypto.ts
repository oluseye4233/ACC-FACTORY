import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * AES-256-GCM symmetric encryption for at-rest third-party API keys
 * stored in `integration_credentials.key_encrypted`.
 *
 * The encryption key is derived (scrypt) from SESSION_SECRET so we don't
 * introduce yet another required env var. SESSION_SECRET is already
 * mandatory at boot and rotation guidance for SESSION_SECRET is the same
 * as it is for any other secret-derived data at rest.
 *
 * Ciphertext format: `enc:<iv-hex>:<ciphertext-hex>:<authTag-hex>`.
 * `enc:` prefix is a versioning anchor so a future migration can add
 * `enc2:...` without breaking lookups.
 */

const STORED_PREFIX = "enc:";

let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET is required and must be >=16 chars to encrypt integration credentials.",
    );
  }
  // Static salt is acceptable here — SESSION_SECRET is already high-entropy
  // and the salt only needs to be stable, not secret.
  cachedKey = scryptSync(secret, "atanda-integration-credentials-v1", 32);
  return cachedKey;
}

export function encryptApiKey(plaintext: string): string {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("encryptApiKey: plaintext must be a non-empty string");
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${STORED_PREFIX}${iv.toString("hex")}:${ct.toString("hex")}:${tag.toString("hex")}`;
}

export function decryptApiKey(stored: string): string {
  if (!stored.startsWith(STORED_PREFIX)) {
    throw new Error("decryptApiKey: unrecognized ciphertext format");
  }
  const parts = stored.slice(STORED_PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("decryptApiKey: malformed ciphertext");
  }
  const [ivHex, ctHex, tagHex] = parts as [string, string, string];
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctHex, "hex")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}

/**
 * Return the first 8 chars of the key for UI identification
 * (e.g. `sphinx_live_a3f2`). Caller is responsible for masking the rest.
 */
export function keyPrefixFor(plaintext: string): string {
  return plaintext.slice(0, 16);
}

/** Mask a plaintext key for safe display: `sphinx_live_••••••a3f2`. */
export function maskKey(prefix: string, tailLen = 4): string {
  if (prefix.length <= tailLen) return prefix;
  return `${prefix.slice(0, prefix.length - tailLen)}••••••${prefix.slice(-tailLen)}`;
}
