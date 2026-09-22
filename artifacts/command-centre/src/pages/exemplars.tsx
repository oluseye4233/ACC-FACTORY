import { useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TopNav } from "@/components/layout/TopNav";
import {
  getListExemplarsQueryKey,
  useListExemplars,
  useGetExemplar,
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  BookOpen,
  FileText,
  FolderUp,
  GitFork,
  Loader2,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type LibraryItem = {
  id: string;
  title: string;
  tagline: string;
  jcse: number | null;
  certClass: string | null;
  source: "canonical" | "hand_authored" | "generated";
  kind: "SPC" | "PDD" | "MA" | "MPDD";
  sku: string;
  disc: string | null;
  marketplace?: "curated" | "open";
  body?: string;
};

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
  const items = (data ?? []) as unknown as LibraryItem[];
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadKind, setUploadKind] = useState<"SPC" | "MA" | "MPDD" | "PDD">("SPC");
  const qc = useQueryClient();
  const { toast } = useToast();

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const form = new FormData();
    Array.from(files).forEach((file) => form.append("files", file, file.name));
    form.append("kind", uploadKind);
    try {
      const response = await fetch("/api/exemplars/upload", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const result = (await response.json().catch(() => null)) as
        | { count?: number; error?: string }
        | null;
      if (!response.ok) throw new Error(result?.error || "Upload failed");
      await qc.invalidateQueries({ queryKey: getListExemplarsQueryKey() });
      toast({
        title: `${uploadKind} added to Exemplar Library`,
        description: `${result?.count ?? files.length} item(s) published to the open backend marketplace.`,
      });
    } catch (error) {
      toast({
        title: "SPC upload failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (folderRef.current) folderRef.current.value = "";
    }
  };

  return (
    <>
      <div className="mb-8 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-wider mb-2">EXEMPLAR LIBRARY</h1>
          <p className="text-muted-foreground font-mono text-sm">
            Open backend marketplace for staff-contributed SPCs and MAs, alongside the canonical HARNESS references.
          </p>
          <p className="text-muted-foreground/70 font-mono text-[11px] mt-2">
            Free for authenticated backend users. Paid frontend listings remain on Sphinx Marketplace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <select
            value={uploadKind}
            onChange={(event) =>
              setUploadKind(event.target.value as "SPC" | "MA" | "MPDD" | "PDD")
            }
            disabled={uploading}
            className="h-9 rounded-md border border-input bg-background px-3 font-mono text-xs"
            aria-label="Upload document kind"
          >
            <option value="SPC">SPC</option>
            <option value="MA">MA</option>
            <option value="MPDD">MPDD</option>
            <option value="PDD">PDD</option>
          </select>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            multiple
            accept=".txt,.md,.markdown,.pdf,.docx"
            onChange={(event) => void uploadFiles(event.target.files)}
          />
          <input
            ref={folderRef}
            type="file"
            className="hidden"
            multiple
            accept=".txt,.md,.markdown,.pdf,.docx"
            {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
            onChange={(event) => void uploadFiles(event.target.files)}
          />
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="font-display tracking-wider"
          >
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            UPLOAD {uploadKind}
          </Button>
          <Button
            onClick={() => folderRef.current?.click()}
            disabled={uploading}
            variant="outline"
            className="font-display tracking-wider"
          >
            <FolderUp className="h-4 w-4 mr-2" /> UPLOAD FOLDER
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
          : items.map((ex) => (
              <Card key={ex.id} className="bg-card flex flex-col">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="font-display tracking-wide text-lg flex items-center gap-2">
                      {ex.kind === "SPC" ? <ShieldCheck className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-secondary" />}
                      {ex.title}
                    </CardTitle>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${ex.source === "canonical" ? "bg-primary/10 text-primary border-primary/20" : "bg-secondary/10 text-secondary border-secondary/20"}`}>
                      {ex.marketplace === "open" ? "OPEN MARKETPLACE" : ex.source === "canonical" ? "CANONICAL" : ex.source === "hand_authored" ? "HAND-AUTHORED" : "GENERATED"}
                    </span>
                  </div>
                  <CardDescription className="text-xs">{ex.tagline}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 mt-auto">
                  {ex.disc && (
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/80 leading-snug" title="DISC personality profile">
                      <span className="text-primary/80">DISC</span> · {ex.disc}
                    </div>
                  )}
                  <div
                    className="font-mono text-[10px] text-muted-foreground/80 tracking-tight break-all"
                    title="Universal SKU"
                  >
                    {ex.sku}
                  </div>
                  <div className="flex items-end justify-between gap-4">
                    <div className="flex gap-3 text-xs font-mono text-muted-foreground">
                      {ex.jcse !== null && <span>JCSE {ex.jcse}/50</span>}
                      {ex.certClass && <span>· {ex.certClass}</span>}
                      <span>· {ex.kind}</span>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/exemplars/${ex.id}`}>OPEN</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>
    </>
  );
}

function Detail({ id }: { id: string }) {
  const { data, isLoading, isError } = useGetExemplar(id);
  const item = data as unknown as LibraryItem | undefined;
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
        ) : isError || !item ? (
          <div className="text-destructive font-mono text-sm">Exemplar not found.</div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="font-display text-3xl tracking-wider flex items-center gap-3 mb-2">
                  {item.kind === "SPC" ? <ShieldCheck className="h-6 w-6 text-primary" /> : <BookOpen className="h-6 w-6 text-secondary" />}
                  {item.title}
                </h1>
                <div className="flex flex-wrap gap-3 text-xs font-mono text-muted-foreground">
                  <span>{item.kind}</span>
                  {item.jcse !== null && <span>· JCSE {item.jcse}/50</span>}
                  {item.certClass && <span>· {item.certClass}</span>}
                  <span>· {item.marketplace === "open" ? "open-marketplace" : item.source.replace("_", "-")}</span>
                </div>
                <div
                  className="mt-1 font-mono text-[11px] text-muted-foreground/90 tracking-tight break-all"
                  title="Universal SKU"
                >
                  {item.sku}
                </div>
                {item.disc && (
                  <div className="mt-2 inline-flex items-start gap-2 text-[11px] font-mono text-muted-foreground/90 max-w-2xl">
                    <span className="text-primary font-bold uppercase tracking-wider">DISC</span>
                    <span className="leading-snug">{item.disc}</span>
                  </div>
                )}
              </div>
              <Button asChild className="font-display tracking-wider">
                <Link href={`/session/new?exemplar=${item.id}`}>
                  <GitFork className="h-4 w-4 mr-2" /> FORK TO SESSION
                </Link>
              </Button>
            </div>
          </>
        )}
      </div>
      {item && (
        <Card className="bg-card">
          <CardContent className="p-6">
            <article className="prose prose-invert max-w-none prose-headings:font-display prose-headings:tracking-wide prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-pre:bg-muted/40 prose-pre:text-xs prose-code:text-primary prose-table:text-sm prose-th:font-mono prose-th:uppercase prose-th:text-xs prose-a:text-primary">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.body ?? ""}</ReactMarkdown>
            </article>
          </CardContent>
        </Card>
      )}
    </>
  );
}
