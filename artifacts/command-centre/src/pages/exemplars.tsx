import { Link, useRoute } from "wouter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TopNav } from "@/components/layout/TopNav";
import { useListExemplars, useGetExemplar } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BookOpen, FileText, GitFork, ShieldCheck } from "lucide-react";

export default function Exemplars() {
  const [matchedDetail, params] = useRoute<{ id: string }>("/exemplars/:id");
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav />
      <main className="flex-1 container py-8 px-4 md:px-6 max-w-5xl">
        {matchedDetail && params?.id ? <Detail id={params.id} /> : <List />}
      </main>
    </div>
  );
}

function List() {
  const { data, isLoading } = useListExemplars();
  return (
    <>
      <div className="mb-8">
        <h1 className="font-display text-4xl tracking-wider mb-2">EXEMPLAR LIBRARY</h1>
        <p className="text-muted-foreground font-mono text-sm">
          Canonical SPC and PDD reference cards the HARNESS engines were grounded in. Browse for shape, scoring, and structure.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
          : data?.map((ex) => (
              <Card key={ex.id} className="bg-card flex flex-col">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="font-display tracking-wide text-lg flex items-center gap-2">
                      {ex.kind === "SPC" ? <ShieldCheck className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-secondary" />}
                      {ex.title}
                    </CardTitle>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${ex.source === "canonical" ? "bg-primary/10 text-primary border-primary/20" : "bg-secondary/10 text-secondary border-secondary/20"}`}>
                      {ex.source === "canonical" ? "CANONICAL" : ex.source === "hand_authored" ? "HAND-AUTHORED" : "GENERATED"}
                    </span>
                  </div>
                  <CardDescription className="text-xs">{ex.tagline}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-end justify-between gap-4 mt-auto">
                  <div className="flex gap-3 text-xs font-mono text-muted-foreground">
                    {ex.jcse !== null && <span>JCSE {ex.jcse}/50</span>}
                    {ex.certClass && <span>· {ex.certClass}</span>}
                    <span>· {ex.kind}</span>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/exemplars/${ex.id}`}>OPEN</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
      </div>
    </>
  );
}

function Detail({ id }: { id: string }) {
  const { data, isLoading, isError } = useGetExemplar(id);
  return (
    <>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-3 font-mono">
          <Link href="/exemplars">
            <ArrowLeft className="h-4 w-4 mr-2" /> EXEMPLAR LIBRARY
          </Link>
        </Button>
        {isLoading ? (
          <Skeleton className="h-10 w-80" />
        ) : isError || !data ? (
          <div className="text-destructive font-mono text-sm">Exemplar not found.</div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="font-display text-3xl tracking-wider flex items-center gap-3 mb-2">
                  {data.kind === "SPC" ? <ShieldCheck className="h-6 w-6 text-primary" /> : <BookOpen className="h-6 w-6 text-secondary" />}
                  {data.title}
                </h1>
                <div className="flex gap-3 text-xs font-mono text-muted-foreground">
                  <span>{data.kind}</span>
                  {data.jcse !== null && <span>· JCSE {data.jcse}/50</span>}
                  {data.certClass && <span>· {data.certClass}</span>}
                  <span>· {data.source.replace("_", "-")}</span>
                </div>
              </div>
              <Button asChild className="font-display tracking-wider">
                <Link href={`/session/new?exemplar=${data.id}`}>
                  <GitFork className="h-4 w-4 mr-2" /> FORK TO SESSION
                </Link>
              </Button>
            </div>
          </>
        )}
      </div>
      {data && (
        <Card className="bg-card">
          <CardContent className="p-6">
            <article className="prose prose-invert max-w-none prose-headings:font-display prose-headings:tracking-wide prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-pre:bg-muted/40 prose-pre:text-xs prose-code:text-primary prose-table:text-sm prose-th:font-mono prose-th:uppercase prose-th:text-xs prose-a:text-primary">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.body}</ReactMarkdown>
            </article>
          </CardContent>
        </Card>
      )}
    </>
  );
}
