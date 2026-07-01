#!/usr/bin/env tsx
/**
 * Cron tick driver for the ATANDA Command Centre API.
 *
 * Designed to be run from a Replit Scheduled Deployment (or any external
 * scheduler). Hits the cron-secret-gated endpoints on the deployed API
 * server. Defaults to the weekly digest; pass `--reset` to also tick the
 * daily harness rate-limit reset.
 *
 * Required env:
 *   - CRON_SECRET            shared secret matching the API server
 *   - PUBLIC_BASE_URL        e.g. https://command-centre.replit.app
 *
 * Optional env:
 *   - CRON_TARGETS           comma-separated list of targets to run:
 *                            "weekly-digest", "reset-harness-limits".
 *                            Defaults to "weekly-digest".
 *   - CRON_TIMEOUT_MS        per-request timeout, default 60000
 *
 * Exit code is non-zero if any request fails so the scheduled deployment
 * surfaces the failure.
 */

const TARGETS: Record<string, string> = {
  "weekly-digest": "/api/cron/send-weekly-digest",
  "reset-harness-limits": "/api/cron/reset-harness-limits",
  "run-f0-monitoring": "/api/cron/run-f0-monitoring",
};

function envOrDie(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[cron-tick] missing required env: ${name}`);
    process.exit(2);
  }
  return v;
}

async function tick(baseUrl: string, secret: string, path: string, timeoutMs: number): Promise<boolean> {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "x-cron-secret": secret, "content-type": "application/json" },
      body: "{}",
      signal: ac.signal,
    });
    const ms = Date.now() - startedAt;
    const text = await res.text();
    if (!res.ok) {
      console.error(`[cron-tick] FAIL ${path} status=${res.status} ms=${ms} body=${text.slice(0, 500)}`);
      return false;
    }
    console.log(`[cron-tick] OK   ${path} status=${res.status} ms=${ms} body=${text.slice(0, 500)}`);
    return true;
  } catch (err) {
    const ms = Date.now() - startedAt;
    console.error(`[cron-tick] ERR  ${path} ms=${ms} err=${(err as Error).message}`);
    return false;
  } finally {
    clearTimeout(t);
  }
}

async function main(): Promise<void> {
  const baseUrl = envOrDie("PUBLIC_BASE_URL");
  const secret = envOrDie("CRON_SECRET");
  const timeoutMs = Number(process.env.CRON_TIMEOUT_MS ?? "60000");

  const cliTargets = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const envTargets = (process.env.CRON_TARGETS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const requested = (cliTargets.length ? cliTargets : envTargets.length ? envTargets : ["weekly-digest"]);

  const paths: string[] = [];
  for (const name of requested) {
    const p = TARGETS[name];
    if (!p) {
      console.error(`[cron-tick] unknown target: ${name} (valid: ${Object.keys(TARGETS).join(", ")})`);
      process.exit(2);
    }
    paths.push(p);
  }

  let allOk = true;
  for (const path of paths) {
    const ok = await tick(baseUrl, secret, path, timeoutMs);
    if (!ok) allOk = false;
  }
  process.exit(allOk ? 0 : 1);
}

void main();
