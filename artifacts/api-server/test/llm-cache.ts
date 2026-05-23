import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "__fixtures__", "llm");

export const IS_RECORD = process.env.RECORD === "1";

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/**
 * Hash inputs include freshly-minted session/MA/artifact UUIDs that change on
 * every test run. Normalise them so a cached fixture from RECORD=1 still
 * matches on replay. Apply the same normalisation to ISO timestamps that some
 * engines echo into prompts.
 */
function normaliseForHash(payload: unknown): string {
  const raw = JSON.stringify(payload);
  return raw
    .replace(UUID_RE, "<UUID>")
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g, "<ISO>");
}

export function hashKey(provider: string, payload: unknown): string {
  return createHash("sha256")
    .update(provider + "\0" + normaliseForHash(payload))
    .digest("hex")
    .slice(0, 32);
}

function pathFor(provider: string, key: string): string {
  return join(ROOT, provider, `${key}.json`);
}

export function readFixture<T>(provider: string, key: string): T | null {
  const p = pathFor(provider, key);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as T;
}

export function writeFixture(provider: string, key: string, value: unknown): void {
  const p = pathFor(provider, key);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(value, null, 2) + "\n");
}

export class MissingFixtureError extends Error {
  constructor(provider: string, key: string, preview: string) {
    super(
      `[llm-cache] No cached fixture for ${provider}/${key}. ` +
        `Run the suite with RECORD=1 against live providers to record. ` +
        `Prompt preview: ${preview.slice(0, 160)}`,
    );
  }
}
