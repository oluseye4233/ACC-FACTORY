import { useMemo, useState } from "react";
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
import { api, type ActivityResponse } from "@/lib/api";

const ENGINE_LABELS: Record<number, string> = {
  1: "F1 Diagnose",
  2: "F2 Atomic",
  3: "F3 Build MA",
  4: "F4 Micro PDD",
  5: "F5 Build SPC",
  6: "F6 Draft PDD",
  7: "F7 MVP PDD",
  8: "F6-VDJ / DE-SPC",
  9: "F8 Code DJ",
  10: "ATLAS J",
  11: "PFP",
};

export default function Activity() {
  // Allow `?orgId=...` to scope to an org's combined activity. Owners/admins only.
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const orgId = params.get("orgId");

  const [source, setSource] = useState<string>("all");
  const [engineId, setEngineId] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const qs = useMemo(() => {
    const u = new URLSearchParams();
    if (source !== "all") u.set("source", source);
    if (engineId !== "all") u.set("engineId", engineId);
    if (from) u.set("from", new Date(from).toISOString());
    if (to) u.set("to", new Date(to).toISOString());
    u.set("limit", String(limit));
    u.set("offset", String(offset));
    return u.toString();
  }, [source, engineId, from, to, offset]);

  const endpoint = orgId ? `/api/orgs/${orgId}/activity` : "/api/me/activity";
  const csvEndpoint = `${endpoint}?${qs.replace(/format=[^&]*&?/, "")}&format=csv`;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [endpoint, qs],
    queryFn: () => api.get<ActivityResponse>(`${endpoint}?${qs}`),
  });

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
          <Button variant="outline" asChild>
            <a href={csvEndpoint} download>
              EXPORT CSV
            </a>
          </Button>
        </header>

        <section className="border border-border rounded-lg p-4 bg-card mb-6">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="text-xs font-mono uppercase text-muted-foreground">Source</label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger>
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
              <label className="text-xs font-mono uppercase text-muted-foreground">Engine</label>
              <Select value={engineId} onValueChange={setEngineId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {Object.entries(ENGINE_LABELS).map(([id, label]) => (
                    <SelectItem key={id} value={id}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-mono uppercase text-muted-foreground">From</label>
              <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-mono uppercase text-muted-foreground">To</label>
              <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
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
                    {data.rows.map((r, i) => (
                      <tr key={`${r.ts}-${i}`} className="border-b border-border/40">
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
                        <td className="p-2">
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
                    ))}
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
