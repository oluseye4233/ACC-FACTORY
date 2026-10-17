import type { LaunchReadiness } from "@workspace/api-client-react";

export type ReadinessTone = "good" | "bad" | "unknown";
export interface ReadinessView {
  overall: "ready" | "not_ready" | "unknown" | "checking";
  overallLabel: string;
  database: { label: string; tone: ReadinessTone };
  ai: { label: string; tone: ReadinessTone };
  deferred: string[];
  checkedAt: string | null;
  message: string | null;
}

/** Never shows a green state unless the CURRENT request succeeded. */
export function deriveReadinessView(
  data: LaunchReadiness | undefined,
  isError: boolean,
  isLoading: boolean,
): ReadinessView {
  const unknown = { label: "UNKNOWN", tone: "unknown" as const };
  if (isError || !data) {
    return {
      overall: isError ? "unknown" : "checking",
      overallLabel: isError ? "STATUS UNKNOWN" : isLoading ? "CHECKING" : "STATUS UNKNOWN",
      database: unknown,
      ai: unknown,
      deferred: [],
      checkedAt: null,
      message: null,
    };
  }
  return {
    overall: data.buildReady ? "ready" : "not_ready",
    overallLabel: data.buildReady ? "DEPENDENCIES READY" : "DEPENDENCIES NOT READY",
    database:
      data.database === "available"
        ? { label: "AVAILABLE", tone: "good" }
        : { label: "UNAVAILABLE", tone: "bad" },
    ai:
      data.ai === "configured"
        ? { label: "CONFIGURED", tone: "good" }
        : { label: "NOT CONFIGURED", tone: "bad" },
    deferred: Array.isArray(data.deferred) ? data.deferred : [],
    checkedAt: data.checkedAt ?? null,
    message: data.message ?? null,
  };
}
