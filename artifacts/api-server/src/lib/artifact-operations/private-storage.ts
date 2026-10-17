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
