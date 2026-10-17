import { Link } from "wouter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  getGetExemplarQueryKey,
  getGetSphinxMarketplaceStatusQueryKey,
  useGetExemplar,
  useGetSphinxMarketplaceStatus,
} from "@workspace/api-client-react";
import { ArrowLeft, Download, GitFork } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { buildExemplarDownloadFilename, getExemplarDownloadFormat } from "@/lib/exemplar-download";
import { KIND_LABEL, errorMessage, sourceLabel } from "@/lib/catalog";
import { F0AdvisoryTag } from "@/components/catalog/CatalogStatusBadge";
import { useDocumentMeta } from "@/hooks/use-document-meta";
import { ArtifactModeSwitch } from "./ArtifactModeSwitch";
import { QualificationReviewForm } from "./QualificationReviewForm";
import { CATALOG_STALE_MS } from "./invalidate";

export function ExemplarDetail({ id }: { id: string }) {
  const { data: item, isLoading, isError, error, refetch } = useGetExemplar(id, {
    query: { queryKey: getGetExemplarQueryKey(id), staleTime: CATALOG_STALE_MS },
  });
  const { data: status } = useGetSphinxMarketplaceStatus({
    query: { queryKey: getGetSphinxMarketplaceStatusQueryKey(), staleTime: CATALOG_STALE_MS, refetchInterval: CATALOG_STALE_MS },
  });
  useDocumentMeta(
    item ? `${item.title} · Exemplar Library · ATANDA` : "Exemplar · ATANDA",
    item?.tagline ?? "ATANDA Exemplar Library artifact.",
  );

  const download = () => {
    if (!item?.body) return;
    const format = getExemplarDownloadFormat(item.body);
    const filename = buildExemplarDownloadFilename({ id: item.id, kind: item.kind, title: item.title }, format.extension);
    const url = URL.createObjectURL(new Blob([item.body], { type: format.mimeType }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-3 font-mono">
        <Link href="/exemplars" data-testid="link-back-library">
          <ArrowLeft className="mr-2 h-4 w-4" /> EXEMPLAR LIBRARY
        </Link>
      </Button>
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-80" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : isError || !item ? (
        <div role="alert" className="space-y-2 rounded-md border border-destructive/40 p-4">
          <p className="font-mono text-sm text-destructive">Exemplar not found or unavailable. {errorMessage(error, "")}</p>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-4">
            <header className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {KIND_LABEL[item.kind]} · {sourceLabel(item)}
              </p>
              <h1 className="font-display text-4xl leading-none tracking-wider">{item.title}</h1>
              <p className="text-sm text-muted-foreground">{item.tagline}</p>
              {item.kind === "F0_REPORT" && <F0AdvisoryTag className="text-[11px]" />}
            </header>
            <article className="prose max-w-none rounded-md border bg-card p-6 prose-headings:font-display prose-headings:tracking-wide prose-pre:bg-muted/60 prose-pre:text-xs prose-code:text-primary prose-table:text-sm prose-a:text-primary">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.body ?? ""}</ReactMarkdown>
            </article>
          </div>
          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <div className="space-y-2 rounded-md border bg-card p-4">
              <Button onClick={download} variant="outline" className="w-full font-display tracking-wider" data-testid={`button-download-exemplar-${item.id}`}>
                <Download className="mr-2 h-4 w-4" /> DOWNLOAD
              </Button>
              <Button asChild className="w-full font-display tracking-wider">
                <Link href={`/session/new?exemplar=${item.id}`} data-testid="link-fork-session">
                  <GitFork className="mr-2 h-4 w-4" /> FORK TO SESSION
                </Link>
              </Button>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border bg-card p-4 font-mono text-[11px]">
              <dt className="text-muted-foreground">JCSE</dt>
              <dd>{item.jcse !== null ? `${item.jcse}/50` : "Not scored"}</dd>
              {item.certClass && (
                <>
                  <dt className="text-muted-foreground">Class</dt>
                  <dd>{item.certClass}</dd>
                </>
              )}
              {item.disc && (
                <>
                  <dt className="text-muted-foreground">DISC</dt>
                  <dd>{item.disc}</dd>
                </>
              )}
              <dt className="text-muted-foreground">SKU</dt>
              <dd className="break-all">{item.sku}</dd>
            </dl>
            <div className="space-y-2 rounded-md border bg-card p-4">
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sphinx discovery</p>
              <ArtifactModeSwitch item={item} publicOpen={status?.publicOpen} />
              {item.qualification && (
                <p className="font-mono text-[10px] text-muted-foreground" data-testid="text-qualification">
                  Review {item.qualification.decision.toLowerCase()} · v{item.qualification.version} · JCSE {item.qualification.jcse} ·{" "}
                  {item.qualification.tokenCount.toLocaleString()} tokens · policy {item.qualification.policyVersion} ·{" "}
                  {new Date(item.qualification.reviewedAt).toLocaleDateString()}
                </p>
              )}
            </div>
            <QualificationReviewForm key={`${item.id}-${item.qualification?.reviewedAt ?? "none"}`} item={item} />
          </aside>
        </div>
      )}
    </div>
  );
}
