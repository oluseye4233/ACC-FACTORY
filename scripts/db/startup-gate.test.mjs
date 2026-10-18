import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const manifest = readFileSync(
  new URL("../../artifacts/api-server/.replit-artifact/artifact.toml", import.meta.url),
  "utf8",
);
const section = manifest.match(/\[services\.production\.run\]([\s\S]*?)(?=\n\[|$)/)?.[1];
assert.ok(section, "API production startup section must exist");
const args = JSON.parse(section.match(/^args\s*=\s*(\[.*\])\s*$/m)?.[1] ?? "null");
assert.deepEqual(args?.slice(0, 2), ["sh", "-c"]);
assert.equal(
  args[2],
  "pnpm run db:migrate && pnpm run db:verify && exec node --enable-source-maps artifacts/api-server/dist/index.mjs",
);

function exercise({ migrate = 0, verify = 0, server = 0 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "ark-startup-gate-"));
  const trace = join(dir, "trace");
  try {
    // These stubs replace both executables. No real database or server is used,
    // and no database environment variables are passed into the child process.
    writeFileSync(join(dir, "pnpm"), `#!/bin/sh
case "$*" in
  "run db:migrate") printf 'migrate\\n' >> "$TRACE"; exit "$MIGRATE_STATUS" ;;
  "run db:verify") printf 'verify\\n' >> "$TRACE"; exit "$VERIFY_STATUS" ;;
  *) exit 99 ;;
esac
`, { mode: 0o755 });
    writeFileSync(join(dir, "node"), `#!/bin/sh
printf 'start %s\\n' "$*" >> "$TRACE"
exit "$SERVER_STATUS"
`, { mode: 0o755 });
    const result = spawnSync(args[0], args.slice(1), {
      encoding: "utf8",
      env: {
        PATH: `${dir}:${process.env.PATH}`,
        TRACE: trace,
        MIGRATE_STATUS: String(migrate),
        VERIFY_STATUS: String(verify),
        SERVER_STATUS: String(server),
      },
    });
    assert.ifError(result.error);
    return { status: result.status, trace: readFileSync(trace, "utf8").trim().split("\n") };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const start = "start --enable-source-maps artifacts/api-server/dist/index.mjs";

test("migration failure prevents verification and API startup", () => {
  assert.deepEqual(exercise({ migrate: 7 }), { status: 7, trace: ["migrate"] });
});

test("verification failure prevents API startup", () => {
  assert.deepEqual(exercise({ verify: 9 }), { status: 9, trace: ["migrate", "verify"] });
});

test("API starts only after migration and verification succeed", () => {
  assert.deepEqual(exercise(), { status: 0, trace: ["migrate", "verify", start] });
});

test("API failure is propagated instead of reporting startup success", () => {
  assert.deepEqual(exercise({ server: 11 }), {
    status: 11,
    trace: ["migrate", "verify", start],
  });
});
