import { useEffect, useMemo, useState, Fragment } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { TopNav } from "@/components/layout/TopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, type ActivityResponse, type ActivityRow, type OrgMember } from "@/lib/api";

const ENGINE_LABELS: Record<number, string> = {
  1: "F1 Diagnose",
  2: "F2 Atomic",
  3: "F3 Build MA",
  4: "F4 Micro PDD",
  5: "F5 Build SPC",
  6: "F6 Draft PDD",
  7: "F7 MVP PDD",
  8: "F6-VDJ / DE-SPC",
  9: "F8 Code ORACLE",
  10: "ATLAS J",
  11: "PFP",
};

const STATUS_OPTIONS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
];

export default function Activity() {
  // Allow `?orgId=...` to scope to an org's combined activity. Owners/admins only.
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const orgId = params.get("orgId");

  const [source, setSource] = useState<string>("all");
  const [engineIds, setEngineIds] = useState<number[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [status, setStatus] = useState<string>("all");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const limit = 50;

  // Pull org member list when scoped to an org so admins can multi-select users.
  const [members, setMembers] = useState<OrgMember[]>([]);
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    api
      .get<OrgMember[]>(`/api/orgs/${orgId}/members`)
      .then((rows) => {
        if (!cancelled) setMembers(rows);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const qs = useMemo(() => {
    const u = new URLSearchParams();
    if (source !== "all") u.set("source", source);
    if (engineIds.length > 0) u.set("engineId", engineIds.join(","));
    if (sessionId.trim()) u.set("sessionId", sessionId.trim());
    if (status !== "all") u.set("status", status);
    if (orgId && memberIds.length > 0) u.set("userIds", memberIds.join(","));
    if (from) u.set("from", new Date(from).toISOString());
    if (to) u.set("to", new Date(to).toISOString());
    u.set("limit", String(limit));
    u.set("offset", String(offset));
    return u.toString();
  }, [source, engineIds, sessionId, status, memberIds, from, to, offset, orgId]);

  const endpoint = orgId ? `/api/orgs/${orgId}/activity` : "/api/me/activity";
  const csvEndpoint = `${endpoint}?${qs.replace(/format=[^&]*&?/, "")}&format=csv`;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [endpoint, qs],
    queryFn: () => api.get<ActivityResponse>(`${endpoint}?${qs}`),
  });

  const toggleEngine = (id: number) => {
    setOffset(0);
    setEngineIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };
  const toggleMember = (uid: string) => {
    setOffset(0);
    setMemberIds((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid],
    );
  };
  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const rowKey = (r: ActivityRow, i: number) =>
    r.eventId ? `b:${r.eventId}` : `e:${r.ts}:${r.engineId ?? "x"}:${i}`;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav />
      <main className="flex-1 container max-w-6xl py-8 px-4">
        <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-3xl tracking-wider">
              {orgId ? "ORGANIZATION ACTIVITY" : "YOUR ACTIVITY"}
            </h1>
            <p className="text-xs font-mono text-muted-foreground mt-1">
              Engine runs · billing events · audit-grade timeline.
              {orgId && (
                <>
                  {" · "}
                  <Link href={`/orgs/${orgId}`} className="text-primary hover:underline">
                    back to org
                  </Link>
                </>
              )}
            </p>
          </div>
          <Button variant="outline" asChild data-testid="link-activity-csv">
            <a href={csvEndpoint} download>
              EXPORT CSV
            </a>
          </Button>
        </header>

        <section className="border border-border rounded-lg p-4 bg-card mb-6 space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="text-xs font-mono uppercase text-muted-foreground">Source</label>
              <Select value={source} onValueChange={(v) => { setOffset(0); setSource(v); }}>
                <SelectTrigger data-testid="select-activity-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="engine">Engine runs</SelectItem>
                  <SelectItem value="billing">Billing events</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-mono uppercase text-muted-foreground">Status (billing)</label>
              <Select value={status} onValueChange={(v) => { setOffset(0); setStatus(v); }}>
                <SelectTrigger data-testid="select-activity-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-mono uppercase text-muted-foreground">From</label>
              <Input
                type="datetime-local"
                value={from}
                onChange={(e) => { setOffset(0); setFrom(e.target.value); }}
                data-testid="input-activity-from"
              />
            </div>
            <div>
              <label className="text-xs font-mono uppercase text-muted-foreground">To</label>
              <Input
                type="datetime-local"
                value={to}
                onChange={(e) => { setOffset(0); setTo(e.target.value); }}
                data-testid="input-activity-to"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-mono uppercase text-muted-foreground">Session</label>
            <Input
              type="text"
              placeholder="Session id (UUID)"
              value={sessionId}
              onChange={(e) => { setOffset(0); setSessionId(e.target.value); }}
              data-testid="input-activity-session"
              className="font-mono text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-mono uppercase text-muted-foreground">
              Engines ({engineIds.length === 0 ? "all" : engineIds.length})
            </label>
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(ENGINE_LABELS).map(([id, label]) => {
                const n = Number(id);
                const active = engineIds.includes(n);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleEngine(n)}
                    className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded border ${
                      active
                        ? "bg-primary/10 border-primary text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid={`chip-engine-${id}`}
                  >
                    {label}
                  </button>
                );
              })}
              {engineIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setOffset(0); setEngineIds([]); }}
                  className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-destructive"
                  data-testid="button-engine-clear"
                >
                  clear
                </button>
              )}
            </div>
          </div>

          {orgId && members.length > 0 && (
            <div>
              <label className="text-xs font-mono uppercase text-muted-foreground">
                Members ({memberIds.length === 0 ? "all" : memberIds.length})
              </label>
              <div className="flex flex-wrap gap-1 mt-1">
                {members.map((m) => {
                  const active = memberIds.includes(m.userId);
                  return (
                    <button
                      key={m.userId}
                      type="button"
                      onClick={() => toggleMember(m.userId)}
                      className={`px-2 py-0.5 text-[10px] font-mono lowercase rounded border ${
                        active
                          ? "bg-primary/10 border-primary text-primary"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                      data-testid={`chip-member-${m.userId}`}
                    >
                      {m.email ?? m.displayName ?? m.userId.slice(0, 8)}
                    </button>
                  );
                })}
                {memberIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { setOffset(0); setMemberIds([]); }}
                    className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-destructive"
                    data-testid="button-member-clear"
                  >
                    clear
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        <section>
          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : isError ? (
            <p className="font-mono text-sm text-destructive">
              {(error as Error)?.message ?? "Failed to load activity"}
            </p>
          ) : !data || data.rows.length === 0 ? (
            <p className="font-mono text-sm text-muted-foreground">No activity in this window.</p>
          ) : (
            <>
              <div className="border border-border rounded-lg bg-card overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead className="border-b border-border bg-card/80">
                    <tr className="text-left">
                      <th className="p-2 w-6"></th>
                      <th className="p-2">When</th>
                      <th className="p-2">Source</th>
                      {orgId && <th className="p-2">User</th>}
                      <th className="p-2">Engine / Event</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Tokens</th>
                      <th className="p-2">Cost USD</th>
                      <th className="p-2">Session</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r, i) => {
                      const key = rowKey(r, i);
                      const isOpen = expanded.has(key);
                      return (
                        <Fragment key={key}>
                          <tr
                            className="border-b border-border/40 cursor-pointer hover:bg-accent/30"
                            onClick={() => toggleExpand(key)}
                            data-testid={`row-activity-${i}`}
                          >
                            <td className="p-2 text-muted-foreground">{isOpen ? "▾" : "▸"}</td>
                            <td className="p-2 whitespace-nowrap">
                              {new Date(r.ts).toLocaleString()}
                            </td>
                            <td className="p-2">{r.source}</td>
                            {orgId && <td className="p-2 truncate max-w-[200px]">{r.userEmail ?? "—"}</td>}
                            <td className="p-2">
                              {r.engineId
                                ? ENGINE_LABELS[r.engineId] ?? `engine ${r.engineId}`
                                : r.eventType ?? "—"}
                            </td>
                            <td className="p-2">{r.status}</td>
                            <td className="p-2">
                              {r.inputTokens != null
                                ? `${r.inputTokens.toLocaleString()} / ${(r.outputTokens ?? 0).toLocaleString()}`
                                : "—"}
                            </td>
                            <td className="p-2">{r.costUsd ?? "—"}</td>
                            <td className="p-2" onClick={(e) => e.stopPropagation()}>
                              {r.sessionId ? (
                                <Link
                                  href={`/session/${r.sessionId}`}
                                  className="text-primary hover:underline"
                                >
                                  open
                                </Link>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                          {isOpen && (
                            <tr className="border-b border-border/40 bg-card/40">
                              <td></td>
                              <td colSpan={orgId ? 8 : 7} className="p-3">
                                <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-[11px]">
                                  <dt className="text-muted-foreground">Provider</dt>
                                  <dd>{r.provider ?? "—"}</dd>
                                  <dt className="text-muted-foreground">Model</dt>
                                  <dd>{r.modelId ?? "—"}</dd>
                                  <dt className="text-muted-foreground">Duration ms</dt>
                                  <dd>{r.durationMs ?? "—"}</dd>
                                  <dt className="text-muted-foreground">Event id</dt>
                                  <dd className="truncate">{r.eventId ?? "—"}</dd>
                                  <dt className="text-muted-foreground">Session id</dt>
                                  <dd className="truncate">{r.sessionId ?? "—"}</dd>
                                  <dt className="text-muted-foreground">User id</dt>
                                  <dd className="truncate">{r.userId ?? "—"}</dd>
                                </dl>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between mt-4 text-xs font-mono text-muted-foreground">
                <span>
                  Showing {offset + 1}–{Math.min(offset + data.rows.length, data.total)} of {data.total}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffset(Math.max(0, offset - limit))}
                    disabled={offset === 0}
                  >
                    PREV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffset(offset + limit)}
                    disabled={offset + data.rows.length >= data.total}
                  >
                    NEXT
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
