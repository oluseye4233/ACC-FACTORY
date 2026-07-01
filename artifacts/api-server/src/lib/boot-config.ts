import { accessCodeConfigured } from "./staff-auth";

/**
 * Boot-time validation of the settings the server cannot run correctly without.
 *
 * Task #86 added a fail-fast guard for `STAFF_ACCESS_CODE`; the same
 * silent-misconfiguration risk applies to every other boot-critical setting.
 * A deploy can look "up" while being fundamentally broken:
 *
 * - `SESSION_SECRET` unset → staff session cookies are signed with `undefined`,
 *   i.e. effectively unsigned and forgeable (`cookieParser(process.env.SESSION_SECRET)`).
 * - `DATABASE_URL` unset → every request that touches the database fails.
 *
 * This module is the SINGLE place that lists what is required, so adding a new
 * boot-critical setting later is a one-line change here. In production a missing
 * setting is fatal (log + throw so the process refuses to start); in every other
 * environment we keep the soft behaviour (a single warning) so local runs and
 * tests aren't blocked — matching `assertAccessCodeConfigured`.
 */

interface BootCriticalSetting {
  /** Env var name, used in the log/error message. */
  name: string;
  /** True when the setting is present and usable. */
  isConfigured: () => boolean;
  /** Why the server can't run correctly without it (appended to the message). */
  reason: string;
}

/**
 * The authoritative list of settings required for a correct boot. Add new
 * boot-critical settings here — nothing else needs to change.
 */
export const BOOT_CRITICAL_SETTINGS: BootCriticalSetting[] = [
  {
    name: "STAFF_ACCESS_CODE",
    isConfigured: accessCodeConfigured,
    reason:
      "the staff portal is unusable — every login returns 503 STAFF_ACCESS_NOT_CONFIGURED",
  },
  {
    name: "SESSION_SECRET",
    isConfigured: () => nonEmptyEnv("SESSION_SECRET"),
    reason:
      "staff session cookies are signed with it — unset means cookies are effectively unsigned and forgeable",
  },
  {
    name: "DATABASE_URL",
    isConfigured: () => nonEmptyEnv("DATABASE_URL"),
    reason: "the server cannot reach its database — every DB-backed request fails",
  },
];

function nonEmptyEnv(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.length > 0;
}

/**
 * Startup guard for all boot-critical settings.
 *
 * @param log - optional structured logger; a warn/error method is used when present.
 */
export function assertBootCriticalConfig(log?: {
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}): void {
  const missing = BOOT_CRITICAL_SETTINGS.filter((s) => !s.isConfigured());
  if (missing.length === 0) return;

  const message = [
    `Missing boot-critical setting(s): ${missing.map((m) => m.name).join(", ")}.`,
    ...missing.map((m) => `  - ${m.name} — ${m.reason}.`),
  ].join("\n");

  if (process.env.NODE_ENV === "production") {
    if (log) log.error(message);
    throw new Error(message);
  }

  if (log) log.warn(message);
}
