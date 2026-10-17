import { lookup } from "node:dns/promises";
import { request } from "node:https";
import ipaddr from "ipaddr.js";
import { OperationsError } from "./context";

/** No redirects, credentials, cookies, private addresses or DNS rebinding. */
export async function publicHandoff(target: string, payload: unknown, idempotencyKey: string) {
  const url = new URL(target);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.port && url.port !== "443") throw new OperationsError(400, "Use a public HTTPS connector URL without credentials, query strings or fragments.");
  const addresses = await Promise.race([lookup(url.hostname, { all: true }), new Promise<never>((_, reject) => setTimeout(() => reject(new OperationsError(504, "Connector DNS timed out.")), 10_000).unref())]);
  if (!addresses.length || addresses.some(a => ipaddr.process(a.address).range() !== "unicast")) throw new OperationsError(400, "Private, loopback and reserved connector addresses are forbidden.");
  const pinned = addresses.find(a => a.family === 4) ?? addresses[0]!;
  const body = JSON.stringify(payload);
  if (Buffer.byteLength(body) > 20_000_000) throw new OperationsError(413, "This handoff exceeds the 20 MB connector payload limit.");
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const req = request(url, {
      method: "POST", agent: false, family: pinned.family, signal: AbortSignal.timeout(15_000),
      lookup: (_hostname, _options, callback) => callback(null, pinned.address, pinned.family),
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), "Idempotency-Key": idempotencyKey, "Accept": "application/json", "Accept-Encoding": "identity" },
    }, res => {
      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) { res.resume(); reject(new OperationsError(502, "The connector did not acknowledge delivery; redirects are not followed.")); return; }
      let size = 0; const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 64_000) { res.destroy(); reject(new OperationsError(502, "Connector response exceeds the size limit.")); } else chunks.push(chunk); });
      res.on("error", () => reject(new OperationsError(502, "Connector response failed.")));
      res.on("end", () => { try { const result: unknown = JSON.parse(Buffer.concat(chunks).toString()); if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error(); resolve(result as Record<string, unknown>); } catch { reject(new OperationsError(502, "Connector returned an invalid JSON acknowledgment.")); } });
    });
    req.on("error", () => reject(new OperationsError(502, "Connector transport failed or timed out.")));
    req.end(body);
  });
}
