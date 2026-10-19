import { Storage } from "@google-cloud/storage";
import { createHash } from "node:crypto";
import { OperationsError } from "./context";

// Replit's managed sidecar authentication, unchanged from the storage template.
const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
const client = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});
export const fileHash = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
function file(key: string) {
  const dir = process.env.PRIVATE_OBJECT_DIR;
  if (!dir) throw new OperationsError(503, "Private document storage is not configured.", "STORAGE_UNAVAILABLE");
  if (!/^[a-zA-Z0-9/_-]+$/.test(key) || key.includes("..")) throw new Error("Invalid internal storage key");
  const parts = `${dir.replace(/^\/|\/$/g, "")}/${key}`.split("/");
  return client.bucket(parts.shift()!).file(parts.join("/"));
}
export async function savePrivate(key: string, content: Buffer | string, mime = "application/json") {
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
  if (bytes.length > 12_000_000) throw new OperationsError(413, "The rendered file exceeds the 12 MB limit.");
  await file(key).save(bytes, { resumable: false, contentType: mime, preconditionOpts: { ifGenerationMatch: 0 } });
  return { key, size: bytes.length, hash: fileHash(bytes) };
}
export async function readPrivate(key: string, expectedHash?: string) {
  const object = file(key);
  const [metadata] = await object.getMetadata();
  if (Number(metadata.size) > 12_000_000) throw new OperationsError(413, "Stored file exceeds the read limit.");
  const [bytes] = await object.download();
  if (expectedHash && fileHash(bytes) !== expectedHash) throw new OperationsError(409, "Stored file integrity check failed.", "INTEGRITY_FAILURE");
  return bytes;
}
export async function deletePrivate(key: string) { await file(key).delete({ ignoreNotFound: true }); }

export type PrivateObjectVersion = { generation: string; createdAt: Date };
/** Metadata only. Never read file bytes during recovery. */
export async function inspectPrivate(key: string): Promise<PrivateObjectVersion | null> {
  try {
    const [metadata] = await file(key).getMetadata();
    const generation = String(metadata.generation ?? "");
    const createdAt = new Date(metadata.timeCreated ?? "");
    if (!/^\d+$/.test(generation) || !Number.isFinite(createdAt.getTime())) {
      throw new Error("Private object has no trustworthy version/creation metadata");
    }
    return { generation, createdAt };
  } catch (err) {
    if ((err as { code?: number }).code === 404) return null;
    throw err;
  }
}

/** Delete exactly the inspected version, never a newer replacement. */
export async function deletePrivateVersion(key: string, generation: string): Promise<"deleted" | "missing" | "changed"> {
  if (!key.startsWith("spartan-preparations/") || !/^\d+$/.test(generation)) {
    throw new Error("Invalid preparation recovery target");
  }
  try {
    await file(key).delete({ ifGenerationMatch: generation });
    return "deleted";
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code === 404) return "missing";
    if (code === 412) return "changed";
    throw err;
  }
}
