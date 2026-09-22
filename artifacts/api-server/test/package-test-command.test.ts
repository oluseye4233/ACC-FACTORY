import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const packageRoot = join(import.meta.dirname, "..");
const focusedFile = "test/package-test-command.test.ts";
let probeBinDir: string;

function invokePackageTest(...args: string[]): string[] {
  const output = execFileSync("pnpm", ["run", "test", "--", ...args], {
    cwd: packageRoot,
    env: {
      ...process.env,
      VITEST_BIN: join(probeBinDir, "vitest"),
    },
    encoding: "utf8",
  });

  const marker = "DISCOVERED_TEST_FILES=";
  const line = output
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith(marker));

  if (!line) {
    throw new Error(`Test discovery probe did not run:\n${output}`);
  }

  return JSON.parse(line.slice(marker.length)) as string[];
}

describe("API package test command", () => {
  beforeAll(() => {
    probeBinDir = mkdtempSync(join(tmpdir(), "api-test-command-"));
    const probePath = join(probeBinDir, "vitest");

    writeFileSync(
      probePath,
      `#!/usr/bin/env node
const { readdirSync } = require("node:fs");
const { relative, resolve } = require("node:path");

function findTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== "dist") {
      return findTests(path);
    }
    return entry.isFile() && /\\.(test|spec)\\.[cm]?[jt]sx?$/.test(entry.name)
      ? [relative(process.cwd(), path)]
      : [];
  });
}

const filters = process.argv.slice(2).filter((arg) => arg !== "run");
const discovered = findTests(process.cwd()).sort();
const selected = filters.length === 0
  ? discovered
  : discovered.filter((file) => filters.some((filter) => file.includes(filter)));

console.log("DISCOVERED_TEST_FILES=" + JSON.stringify(selected));
`,
    );
    chmodSync(probePath, 0o755);
  });

  afterAll(() => {
    rmSync(probeBinDir, { recursive: true, force: true });
  });

  it("forwards a supplied filename so only that file is selected", () => {
    expect(invokePackageTest(focusedFile)).toEqual([focusedFile]);
  });

  it("omits filters so the full API suite is discovered", () => {
    const discovered = invokePackageTest();

    expect(discovered).toContain(focusedFile);
    expect(discovered).toContain("test/f9-mecha.test.ts");
    expect(discovered).toContain("src/lib/f10.test.ts");
    expect(discovered.length).toBeGreaterThan(3);
  });
});