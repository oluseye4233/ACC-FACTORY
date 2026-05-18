import { useState } from "react";
import { Link } from "wouter";
import { TopNav } from "@/components/layout/TopNav";
import { useListMyPrompts } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, FileText, Search, ShieldCheck, Sparkles } from "lucide-react";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const KIND_OPTIONS = [
  { value: "ALL", label: "ALL" },
  { value: "ATOMIC_PROMPT", label: "ATOMIC" },
  { value: "PROMPT_DIAGNOSTIC", label: "DIAGNOSTIC" },
  { value: "SPC", label: "SPC" },
] as const;

export default function Prompts() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<(typeof KIND_OPTIONS)[number]["value"]>("ALL");
  const { data, isLoading } = useListMyPrompts({
    page,
    pageSize: 20,
    q: q || undefined,
    kind: kind === "ALL" ? undefined : kind,
  });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav />
      <main className="flex-1 container py-8 px-4 md:px-6 max-w-6xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-4xl tracking-wider mb-2">PROMPT LIBRARY</h1>
            <p className="text-muted-foreground font-mono text-sm">
              Every atomic prompt, diagnostic, and SPC you have forged. Export your full SPC corpus below.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" className="font-mono">
              <a href={`${BASE}/api/me/spcs/export.csv`} download>
                <Download className="h-4 w-4 mr-2" /> SPC CSV
              </a>
            </Button>
            <Button asChild variant="outline" className="font-mono">
              <a href={`${BASE}/api/me/spcs/export.pdf`} download>
                <Download className="h-4 w-4 mr-2" /> SPC PDF
              </a>
            </Button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <Tabs value={kind} onValueChange={(v) => { setKind(v as typeof kind); setPage(1); }}>
            <TabsList className="bg-card border h-auto p-1">
              {KIND_OPTIONS.map((k) => (
                <TabsTrigger key={k.value} value={k.value} className="font-mono text-xs h-8">
                  {k.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search prompts..."
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              className="pl-9 bg-card font-mono text-sm"
            />
          </div>
        </div>

        <Card className="bg-card">
          <CardContent className="p-0">
            <div className="divide-y">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-4">
                    <Skeleton className="h-5 w-2/3 mb-2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                ))
              ) : items.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground font-mono text-sm">
                  NO PROMPTS YET. RUN F1 OR F5 TO START FORGING.
                </div>
              ) : (
                items.map((p) => (
                  <Link
                    key={p.id}
                    href={`/session/${p.sessionId}`}
                    className="flex items-start gap-4 p-4 hover:bg-accent/40 transition-colors"
                  >
                    <div className="mt-0.5">
                      {p.artifactType === "SPC" ? (
                        <ShieldCheck className="h-4 w-4 text-primary" />
                      ) : p.artifactType === "PROMPT_DIAGNOSTIC" ? (
                        <Sparkles className="h-4 w-4 text-secondary" />
                      ) : (
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-xs font-bold text-primary">{p.artifactType}</span>
                        {p.certTier && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border bg-secondary/10 text-secondary border-secondary/20">
                            {p.certTier}
                          </span>
                        )}
                        {p.jcseScore !== null && p.jcseScore !== undefined && (
                          <span className="text-[10px] font-mono text-muted-foreground">JCSE {p.jcseScore}/50</span>
                        )}
                        {p.spcOrigin === "digitally_evolved" && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border bg-primary/10 text-primary border-primary/20">
                            DE-SPC
                          </span>
                        )}
                        {p.sessionName && (
                          <span className="text-[10px] font-mono text-muted-foreground truncate">
                            · {p.sessionName}
                          </span>
                        )}
                      </div>
                      <p className="text-sm line-clamp-2">{p.preview}</p>
                      <div className="text-[10px] font-mono text-muted-foreground mt-1">
                        {format(new Date(p.createdAt), "yyyy-MM-dd HH:mm")}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 font-mono text-xs">
            <div className="text-muted-foreground">
              Page {page} of {totalPages} · {total} total
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                PREV
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                NEXT
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
