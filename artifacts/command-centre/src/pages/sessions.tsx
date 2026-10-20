import { useRef, useState } from "react";
import { Link } from "wouter";
import { TopNav } from "@/components/layout/TopNav";
import { useListSessions } from "@workspace/api-client-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Calendar, Activity, Download } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
import { format } from "date-fns";

type SessionRecord = {
  id: string;
  idLabel: string;
  sessionName: string;
  status: string;
  updatedAt: unknown;
  canOpen: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatSessionName(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "Untitled build";
}

function formatSessionId(value: unknown, index: number): string {
  return typeof value === "string" && value.trim() ? value : `unknown-${index}`;
}

function formatSessionStatus(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "UNKNOWN";
}

function formatSessionDate(value: unknown, includeTime: boolean): string {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) {
    return "Unknown date";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return format(date, includeTime ? "yyyy-MM-dd HH:mm" : "yyyy-MM-dd");
}

function normalizeSession(value: unknown, index: number): SessionRecord {
  const session = isRecord(value) ? value : {};
  const hasValidId = typeof session.id === "string" && session.id.trim();

  return {
    id: formatSessionId(session.id, index),
    idLabel: hasValidId ? session.id as string : "Unknown ID",
    sessionName: formatSessionName(session.sessionName),
    status: formatSessionStatus(session.status),
    updatedAt: session.updatedAt,
    canOpen: Boolean(hasValidId),
  };
}

export default function Sessions() {
  const { data: sessions, isLoading, isError, isFetching, refetch } = useListSessions();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [retrying, setRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const retryLock = useRef(false);
  const unavailable = isError || (!isLoading && !Array.isArray(sessions));
  const hasRecords = Array.isArray(sessions) && sessions.length > 0;
  const busy = Boolean(isLoading || isFetching || retrying);

  async function retry() {
    if (retryLock.current || isFetching) return;
    retryLock.current = true;
    setRetrying(true);
    setRetryFailed(false);
    try { await refetch(); }
    catch { setRetryFailed(true); }
    finally { retryLock.current = false; setRetrying(false); }
  }

  const normalizedSessions = Array.isArray(sessions)
    ? sessions.map(normalizeSession)
    : [];

  const filteredSessions = normalizedSessions.filter(session => {
    // Filter by search
    if (searchQuery && !session.sessionName.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !session.id.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Filter by tab
    if (activeTab === "in_progress") return session.status !== "COMPLETE";
    if (activeTab === "complete") return session.status === "COMPLETE";
    
    return true;
  }) || [];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav />
      <main className="flex-1 container py-8 px-4 md:px-6 max-w-6xl">
        
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-4xl tracking-wider mb-2">
              SESSIONS ARCHIVE
            </h1>
            <p className="text-muted-foreground font-mono text-sm">
              All historical and active HARNESS instances
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="font-mono flex-1 sm:flex-none">
              <a href={`${BASE}/api/me/spcs/export.csv`} download>
                <Download className="h-4 w-4 mr-2" /> SPC CSV
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="font-mono flex-1 sm:flex-none">
              <a href={`${BASE}/api/me/spcs/export.pdf`} download>
                <Download className="h-4 w-4 mr-2" /> SPC PDF
              </a>
            </Button>
            <Button asChild className="font-display tracking-wider gap-2 w-full sm:w-auto">
              <Link href="/session/new">
                <Plus className="h-4 w-4" />
                NEW SESSION
              </Link>
            </Button>
          </div>
        </div>

        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
            <TabsList aria-label="Filter sessions by status" className="bg-card border w-full md:w-auto h-auto p-1 flex-wrap">
              <TabsTrigger value="all" className="font-mono text-xs h-8">ALL</TabsTrigger>
              <TabsTrigger value="in_progress" className="font-mono text-xs h-8">IN PROGRESS</TabsTrigger>
              <TabsTrigger value="complete" className="font-mono text-xs h-8">COMPLETE</TabsTrigger>
              <TabsTrigger value="library" className="font-mono text-xs h-8" disabled>LIBRARY (WIP)</TabsTrigger>
            </TabsList>
            
            <div className="relative w-full md:w-72">
              <label htmlFor="session-search" className="sr-only">Search sessions by name or ID</label>
              <Search aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="session-search"
                placeholder="Search by name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-card font-mono text-sm"
              />
            </div>
          </div>

          <TabsContent value={activeTab} className="mt-0 outline-none">
            {unavailable && (
              <section role="alert" aria-label="Sessions unavailable" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                <div className="min-w-0 font-mono text-sm">
                  <p>Could not load the sessions archive. This does not mean there are no sessions.</p>
                  {hasRecords && <p className="mt-1 text-muted-foreground">Previously loaded records are shown below; their status may be out of date.</p>}
                  {retryFailed && <p className="mt-1">Retry failed. Please try again.</p>}
                </div>
                <Button variant="outline" onClick={() => void retry()} disabled={busy} aria-busy={busy}>
                  {busy ? "Retrying sessions..." : "Retry sessions"}
                </Button>
              </section>
            )}
            <section aria-label="Sessions archive results" aria-busy={busy} className="min-w-0 border rounded-lg bg-card overflow-hidden">
              <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
                {isLoading ? "Loading sessions." : unavailable ? "Sessions unavailable." : `${filteredSessions.length} sessions match the current filters.`}
              </p>
              <div className="overflow-x-auto">
                <table role="table" className="w-full text-left border-collapse">
                  <caption className="sr-only">Sessions matching the selected status and search</caption>
                  <thead className="sr-only md:not-sr-only md:table-header-group">
                    <tr className="border-b bg-muted/50">
                      <th scope="col" className="py-3 px-4 font-mono text-xs text-muted-foreground font-medium">SESSION NAME</th>
                      <th scope="col" className="py-3 px-4 font-mono text-xs text-muted-foreground font-medium w-40">STATUS</th>
                      <th scope="col" className="py-3 px-4 font-mono text-xs text-muted-foreground font-medium w-48">LAST MODIFIED</th>
                      <th scope="col" className="py-3 px-4 font-mono text-xs text-muted-foreground font-medium w-24 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {isLoading ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-muted-foreground font-mono text-sm animate-pulse">
                          RETRIEVING RECORDS...
                        </td>
                      </tr>
                     ) : unavailable && !hasRecords ? (
                       <tr><td colSpan={4} className="py-12 px-4 text-center text-muted-foreground font-mono text-sm">SESSION RECORDS UNAVAILABLE</td></tr>
                     ) : filteredSessions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-muted-foreground font-mono text-sm">
                          NO RECORDS MATCHING CRITERIA
                        </td>
                      </tr>
                    ) : (
                      filteredSessions.map(session => (
                        <tr
                          key={session.id}
                          className="hover:bg-accent/30 transition-colors group flex flex-col md:table-row p-3 md:p-0 border-b last:border-b-0"
                        >
                          <td className="md:py-4 md:px-4 md:table-cell block">
                            <div className="font-medium mb-1 break-words [overflow-wrap:anywhere]">
                              {session.canOpen ? <Link href={`/session/${encodeURIComponent(session.id)}`} aria-label={`Open session ${session.sessionName}`} className="text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{session.sessionName}</Link> : session.sessionName}
                            </div>
                            <div className="font-mono text-[10px] md:text-xs text-muted-foreground break-all">
                              ID: {session.idLabel}
                            </div>
                            {/* Mobile-only inline meta */}
                            <div className="mt-2 flex flex-wrap items-center gap-2 md:hidden">
                              <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                                session.status === 'COMPLETE' ? 'bg-primary/10 text-primary border-primary/20' :
                                'bg-accent text-accent-foreground'
                              }`}>
                                {session.status === 'COMPLETE' ? <CheckCircleIcon className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
                                {session.status}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                                <Calendar className="h-3 w-3" />
                                {formatSessionDate(session.updatedAt, false)}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4 hidden md:table-cell">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-mono font-bold px-2 py-1 rounded border ${
                              session.status === 'COMPLETE' ? 'bg-primary/10 text-primary border-primary/20' :
                              'bg-accent text-accent-foreground'
                            }`}>
                              {session.status === 'COMPLETE' ? <CheckCircleIcon className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
                              {session.status}
                            </span>
                          </td>
                          <td className="py-4 px-4 hidden md:table-cell">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatSessionDate(session.updatedAt, true)}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right hidden md:table-cell">
                            {session.canOpen ? <Button asChild size="sm" variant="ghost" className="font-mono text-xs">
                              <Link href={`/session/${encodeURIComponent(session.id)}`} aria-label={`Continue session ${session.sessionName}`}>ENTER</Link>
                            </Button> : <span className="font-mono text-xs text-muted-foreground">UNAVAILABLE</span>}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function CheckCircleIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
