import { createHash, createHmac, timingSafeEqual, verify as verifySignature } from "node:crypto";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";

export type F10State = "REQUESTED" | "VERIFYING" | "AUTHORIZED" | "QUEUED" | "DISPATCHING" | "ACKNOWLEDGED" | "BLOCKED" | "FAILED_PERMANENT" | "DEAD_LETTERED" | "CANCELLED";
export type ReadonlyEnvelope = Readonly<{
  machine_artifact_id: string; mecha_run_id: string; artifact_version: string; media_type: string;
  ucg_certificate: { verdict: string; expires_at: string; signature: string };
  spk_id: string; payload_hash: string; artifact_signature: string; osiris_custody_attestation: { osiris_custody: boolean; expires_at: string; signature: string };
}>;
export type AdapterResult = { accepted: boolean; downstreamReceiptId?: string };
export interface F10ReleaseAdapter {
  validate(configRef: string): Promise<void>;
  deliver(envelope: ReadonlyEnvelope, idempotencyKey: string, deadline: Date): Promise<AdapterResult>;
  classify(error: unknown): "retryable" | "permanent";
  health(): Promise<"available" | "degraded" | "unavailable">;
}
export function createSafeHttpsAdapter(secretProvider: { get(ref:string): Promise<string> }, config: { id:string; version:string; endpoint:string; secretRef:string }): F10ReleaseAdapter {
  let checked: Awaited<ReturnType<typeof resolveHttpsDestination>> | undefined;
  return {
    async validate() { checked = await resolveHttpsDestination(config.endpoint); },
    async health() { return "available"; },
    classify(error) { const status=(error as {status?:number})?.status; return status===429 || !status || (status>=500 && status<=599) ? "retryable" : "permanent"; },
    async deliver(envelope, idempotencyKey, deadline) {
      if (!checked) await this.validate(config.secretRef);
      const secret=await secretProvider.get(config.secretRef);
      const body=JSON.stringify(envelope);
      if (Buffer.byteLength(body)>10*1024*1024) throw new Error("payload exceeds adapter limit");
      const remaining = Math.max(1, deadline.getTime() - Date.now());
      const text = await new Promise<string>((resolve, reject) => {
        let settled = false;
        const req = httpsRequest({
          protocol: "https:",
          hostname: checked!.url.hostname.replace(/^\[|\]$/g, ""),
          port: checked!.url.port || 443,
          path: `${checked!.url.pathname}${checked!.url.search}`,
          method: "POST",
          servername: checked!.url.hostname.replace(/^\[|\]$/g, ""),
          // The lookup callback is deliberately pinned to the address checked above.
          lookup: (_hostname, _options, callback) => callback(null, checked!.address, checked!.family),
          headers: {
            host: checked!.url.host,
            "content-type": "application/json",
            authorization: `Bearer ${secret}`,
            "idempotency-key": idempotencyKey,
            "content-length": Buffer.byteLength(body),
          },
          timeout: remaining,
        }, response => {
          let bytes = 0;
          const chunks: Buffer[] = [];
          response.on("data", chunk => {
            bytes += Buffer.byteLength(chunk);
            if (bytes > 64 * 1024) {
              req.destroy(new Error("response exceeds adapter limit"));
              return;
            }
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          response.on("end", () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400) {
              reject(new Error("redirects are not permitted"));
            } else if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
              const e = new Error(`downstream HTTP ${response.statusCode ?? 0}`) as Error & {status:number};
              e.status = response.statusCode ?? 0;
              reject(e);
            } else resolve(Buffer.concat(chunks).toString("utf8"));
          });
        });
        const timer = setTimeout(() => req.destroy(new Error("downstream request deadline exceeded")), remaining);
        req.on("timeout", () => req.destroy(new Error("downstream request deadline exceeded")));
        req.on("error", error => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(error);
        });
        req.end(body);
      });
      let parsed: {receiptId?:string}={}; try { parsed=JSON.parse(text) as {receiptId?:string}; } catch { /* receipt id optional */ }
      return {accepted:true,downstreamReceiptId:parsed.receiptId};
    },
  };
}
export interface F10Custody {
  load(custodyRef: string): Promise<Uint8Array>;
  active(custodyRef: string): Promise<boolean>;
}
export interface F10ArtifactRecord {
  custodyRef: string; payloadHash: string; artifactSignature: string; signingKeyPem: string;
  expiresAt: Date; custodyActive: boolean; ucgVerdict: string; mmVerdict: string; savantVerdict: string;
  envelope?: ReadonlyEnvelope;
  /** F9 currently uses the tenant signing secret (HMAC) rather than a PEM key. */
  signatureSecret?: string;
}

/** All checks happen before adapter.validate/deliver. Bytes are obtained only from custody. */
export async function validateArtifact(record: F10ArtifactRecord, custody: F10Custody, now = new Date()): Promise<Uint8Array> {
  if (record.expiresAt <= now) throw new Error("artifact expired");
  if (!record.custodyActive || !(await custody.active(record.custodyRef))) throw new Error("OSIRIS custody inactive");
  if (!["PASS", "THRESHOLD_PASS"].includes(record.ucgVerdict)) throw new Error("UCG verdict is not passing");
  if (record.mmVerdict !== "MATH_VERIFIED") throw new Error("MM verdict is not passing");
  if (!["FIT", "CLUSTER"].includes(record.savantVerdict)) throw new Error("SAVANT verdict is not passing");
  const bytes = await custody.load(record.custodyRef);
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== record.payloadHash) throw new Error("artifact hash mismatch");
    const expectedHmac = record.signatureSecret
      ? Buffer.from(createHmac("sha256", record.signatureSecret).update(bytes).digest("base64url"))
      : null;
    const suppliedHmac = Buffer.from(record.artifactSignature);
    const valid = expectedHmac
      ? expectedHmac.length === suppliedHmac.length && timingSafeEqual(expectedHmac, suppliedHmac)
      : verifySignature(null, Buffer.from(bytes), record.signingKeyPem, Buffer.from(record.artifactSignature, "base64"));
   if (!valid) throw new Error("artifact signature invalid");
  return bytes;
}

const privateV4 = (ip: string) => {
  const p = ip.split(".").map(Number);
  return p[0] === 0 || p[0] === 10 || p[0] === 127 || (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
    (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && (p[1] === 0 || p[1] === 168)) || (p[0] === 198 && (p[1] === 18 || p[1] === 19)) ||
    (p[0] === 203 && p[1] === 0) || p[0] >= 224;
};
const privateV6 = (ip: string) => {
  const normalized = ip.toLowerCase();
  if (normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") ||
      normalized.startsWith("fe80:") || normalized.startsWith("ff")) return true;
  const groups = expandV6(normalized);
  if (!groups) return true;
  // IPv4-mapped addresses must receive the IPv4 policy as well.
  if (groups.slice(0, 5).join(":") === "0000:0000:0000:0000:0000" && groups[5] === "ffff") {
    const v4 = `${parseInt(groups[6].slice(0, 2), 16)}.${parseInt(groups[6].slice(2), 16)}.${parseInt(groups[7].slice(0, 2), 16)}.${parseInt(groups[7].slice(2), 16)}`;
    return privateV4(v4);
  }
  return (groups[0] === "2001" && groups[1] === "0db8") || (groups[0] === "2001" && groups[1] === "0001");
};
const expandV6 = (ip: string): string[] | undefined => {
  const parts = ip.split("::");
  if (parts.length > 2) return;
  const left = parts[0] ? parts[0].split(":") : [];
  const right = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
  if (left.some(x => !/^[0-9a-f]{1,4}$/u.test(x)) || right.some(x => !/^[0-9a-f]{1,4}$/u.test(x))) return;
  const missing = 8 - left.length - right.length;
  if (missing < (parts.length === 2 ? 1 : 0)) return;
  return [...left, ...Array(missing).fill("0"), ...right].map(x => x.padStart(4, "0"));
};

/** Validate once and pin DNS answers before connecting; adapters must use this URL and reject redirects. */
export async function validateHttpsDestination(raw: string, resolve: (host: string) => Promise<string[]> = async (h) => (await lookup(h, { all: true })).map(x => x.address)): Promise<URL> {
  return (await resolveHttpsDestination(raw, resolve)).url;
}
async function resolveHttpsDestination(raw: string, resolve: (host: string) => Promise<string[]> = async (h) => (await lookup(h, { all: true })).map(x => x.address)): Promise<{url: URL; address: string; family: 4 | 6}> {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error("destination must be a valid HTTPS URL"); }
  if (u.protocol !== "https:" || u.username || u.password || u.hostname === "localhost" || u.hostname.endsWith(".localhost")) throw new Error("destination must be HTTPS without credentials");
  if (u.port && u.port !== "443") throw new Error("non-standard destination port is not permitted");
   const host = u.hostname.replace(/^\[|\]$/g, "");
   const addresses = isIP(host) ? [host] : await resolve(host);
  if (!addresses.length || addresses.some(ip => {
    const candidateFamily = isIP(ip);
    return candidateFamily !== 4 && candidateFamily !== 6 ||
      (candidateFamily === 4 ? privateV4(ip) : privateV6(ip));
  })) throw new Error("destination resolves to a private or reserved address");
  const family = isIP(addresses[0]) as 4 | 6;
  return {url: u, address: addresses[0], family};
}

export function deterministicIdempotencyKey(payloadHash: string, destinationIdentity: string, releaseIntent: string): string {
  return createHash("sha256").update(`${payloadHash}\0${destinationIdentity}\0${releaseIntent}`).digest("hex");
}
export function canonicalF9Payload(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, (_, value) => value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))) : value);
}
export function verifyF9Hmac(payload: Record<string, unknown>, payloadHash: string, artifactSignature: string, sessionSecret: string): Uint8Array {
  const unsigned = { ...payload }; delete unsigned.payload_hash; delete unsigned.artifact_signature;
  const bytes = Buffer.from(canonicalF9Payload(unsigned));
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (!/^[a-f0-9]{64}$/u.test(payloadHash) || digest !== payloadHash) throw new Error("artifact hash mismatch");
  const expected = createHmac("sha256", sessionSecret).update(bytes).digest("base64url");
  const got = Buffer.from(artifactSignature);
  if (got.length !== expected.length || !timingSafeEqual(got, Buffer.from(expected))) throw new Error("artifact signature invalid");
  return bytes;
}

export function verifyPrerequisites(e: ReadonlyEnvelope, now = new Date()): string[] {
  const errors: string[] = [];
  const expiry = (s: string) => Number.isNaN(Date.parse(s)) || new Date(s) <= now;
  if (!["PASS", "THRESHOLD_PASS"].includes(e.ucg_certificate.verdict)) errors.push("UCG verdict is not passing");
  if (expiry(e.ucg_certificate.expires_at)) errors.push("UCG certificate expired");
  if (!e.ucg_certificate.signature) errors.push("UCG signature missing");
  if (!e.osiris_custody_attestation.osiris_custody) errors.push("OSIRIS custody is not active");
  if (expiry(e.osiris_custody_attestation.expires_at)) errors.push("OSIRIS custody expired");
  if (!e.osiris_custody_attestation.signature) errors.push("OSIRIS attestation missing");
  // F9 persists SHA-256 as the canonical plain 64-character hex digest.
  if (!/^[a-f0-9]{64}$/u.test(e.payload_hash)) errors.push("invalid payload hash");
  if (!e.artifact_signature) errors.push("artifact signature missing");
  return errors;
}

export function signDeliveryReceipt(receipt: Omit<Record<string, unknown>, "f10_receipt_signature">, signingSecret: string): Record<string, unknown> {
  // Secret is consumed only here and is never returned or logged.
  const canonical = JSON.stringify(receipt, Object.keys(receipt).sort());
  return { ...receipt, f10_receipt_signature: createHmac("sha256", signingSecret).update(canonical).digest("hex") };
}

export function retryDelay(attempt: number, retryAfterSeconds?: number): number {
  if (retryAfterSeconds !== undefined && Number.isFinite(retryAfterSeconds)) return Math.min(300_000, Math.max(0, retryAfterSeconds * 1000));
  return Math.min(300_000, 1000 * 2 ** Math.max(0, attempt - 1));
}