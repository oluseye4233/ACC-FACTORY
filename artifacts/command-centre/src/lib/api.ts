// Thin wrapper around fetch for endpoints not covered by the generated
// react-query client (orgs, activity). All requests go through the relative
// /api/ prefix so the shared reverse proxy routes them correctly.

const basePath = ""; // /api is host-absolute; do not prepend BASE_URL.

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${basePath}${path}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload: unknown = isJson ? await res.json().catch(() => null) : await res.text();
  if (!res.ok) {
    const msg =
      typeof payload === "object" && payload && "error" in (payload as Record<string, unknown>)
        ? String((payload as { error: unknown }).error)
        : `Request failed: ${res.status}`;
    throw new ApiError(res.status, payload, msg);
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

export type OrgRow = {
  id: string;
  name: string;
  slug: string;
  seatsPurchased: number;
  status: string;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
  role: "owner" | "admin" | "member";
  membersCount?: number;
  pendingInviteCount?: number;
};

export type OrgMember = {
  userId: string;
  role: "owner" | "admin" | "member";
  email: string | null;
  displayName: string | null;
  joinedAt: string;
};

export type OrgInvite = {
  id: string;
  email: string;
  role: "owner" | "admin" | "member";
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export type ActivityRow = {
  source: "engine" | "billing";
  ts: string;
  userId: string | null;
  userEmail: string | null;
  engineId: number | null;
  sessionId: string | null;
  status: string;
  provider: string | null;
  modelId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: string | null;
  durationMs: number | null;
  eventType: string | null;
  eventId: string | null;
};

export type CostSummary = {
  tier: "EXPLORER" | "PRACTITIONER" | "ARCHITECT" | "INSTITUTION";
  effectiveTier: "EXPLORER" | "PRACTITIONER" | "ARCHITECT" | "INSTITUTION";
  monthToDate: {
    usedUsd: number;
    capUsd: number;
    percentUsed: number;
    overCap: boolean;
    tierDefaultUsd: number;
    overrideUsd: number | null;
  };
  dailyBreakdown: Array<{ date: string; costUsd: number; runs: number }>;
  byEngine: Array<{ engineId: number; costUsd: number; runs: number }>;
  recentRuns: Array<{
    id: string;
    ts: string;
    engineId: number;
    sessionId: string;
    provider: string;
    modelId: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    durationMs: number;
  }>;
};

export type ActivityResponse = {
  rows: ActivityRow[];
  total: number;
  limit: number;
  offset: number;
};
