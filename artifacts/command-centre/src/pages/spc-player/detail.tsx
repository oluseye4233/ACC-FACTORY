import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { TopNav } from "@/components/layout/TopNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useGetSpcPlayerRun,
  useGetSpcDevKit,
  useGetSpcPlayerCatalog,
  useGetSpcPlayerWebhookAuthorization,
  useExecuteSpcPlayerRun,
  useAuthorizeSpcPlayerWebhook,
  useDeliverSpcPlayerRun,
  getGetSpcPlayerRunQueryKey,
  getGetSpcPlayerWebhookAuthorizationQueryKey,
  getListSpcPlayerRunsQueryKey,
  getDownloadSpcPlayerRunUrl,
  type SpcPlayerRun,
} from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { ArrowLeft, Download, Play, Shield, Activity, Package, FileJson, Loader2, CheckCircle2, Send } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SpcPlayerDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: loadedRun, isLoading: isRunLoading } = useGetSpcPlayerRun(id || "");
  const { data: devKit, isLoading: isDevKitLoading } = useGetSpcDevKit();
  const { data: catalog, isLoading: isCatalogLoading } = useGetSpcPlayerCatalog();
  const { data: webhookAuthorization } = useGetSpcPlayerWebhookAuthorization(id || "");
  const executeRun = useExecuteSpcPlayerRun();
  const authorizeWebhook = useAuthorizeSpcPlayerWebhook();
  const deliverRun = useDeliverSpcPlayerRun();
  const [executionResult, setExecutionResult] = useState<SpcPlayerRun | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [webhookEndpoint, setWebhookEndpoint] = useState("");
  const [sessionAuthorizedEndpoint, setSessionAuthorizedEndpoint] = useState<string | null>(null);
  const [authorizationMessage, setAuthorizationMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deliveryMessage, setDeliveryMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const run = executionResult ?? loadedRun;
  const authorizedEndpoint = sessionAuthorizedEndpoint ?? webhookAuthorization?.endpoint ?? null;
  const retryAvailableAt = run?.retryAvailableAt
    ? new Date(run.retryAvailableAt).getTime()
    : null;
  const activeAttempt = run?.executionState === "ACTIVE"
    && retryAvailableAt !== null
    && retryAvailableAt > now;
  const canExecute = Boolean(run?.canExecute);

  useEffect(() => {
    if (!run || run.executionState !== "ACTIVE" || retryAvailableAt === null) return;
    const delay = Math.max(0, retryAvailableAt - Date.now()) + 50;
    const timeout = window.setTimeout(() => {
      setNow(Date.now());
      queryClient.invalidateQueries({ queryKey: getGetSpcPlayerRunQueryKey(id) });
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [id, run, retryAvailableAt]);

  const getCardName = (cardId: string) => {
    if (!catalog) return cardId;
    const card = catalog.find((c) => c.id === cardId);
    return card ? card.name : cardId;
  };

  const getCardSlug = (cardId: string) => {
    if (!catalog) return "";
    const card = catalog.find((c) => c.id === cardId);
    return card ? card.slug : "";
  };

  const handleDownloadPackage = () => {
    if (!id) return;
    window.open(getDownloadSpcPlayerRunUrl(id), "_blank", "noopener,noreferrer");
  };

  const handleExecute = () => {
    if (!id) return;
    executeRun.mutate(
      { id },
      {
        onSuccess: (updated) => {
          setExecutionResult(updated);
          queryClient.setQueryData(getGetSpcPlayerRunQueryKey(id), updated);
          queryClient.invalidateQueries({ queryKey: getListSpcPlayerRunsQueryKey() });
          const completed = updated.status === "COMPLETED";
          toast({
            title: completed ? "Execution Complete" : "Execution Failed",
            description: completed
              ? "The selected cards executed in order and the final package is ready."
              : updated.error ?? "The execution failed; the persisted failure is shown below.",
            variant: completed ? "default" : "destructive",
          });
        },
        onError: (err: any) => {
          queryClient.invalidateQueries({ queryKey: getGetSpcPlayerRunQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getListSpcPlayerRunsQueryKey() });
          toast({
            title: "Execution Error",
            description: err?.data?.error || err?.message || "An unexpected error occurred.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleAuthorize = () => {
    if (!id) return;
    const endpoint = webhookEndpoint.trim();
    if (!endpoint) {
      const text = "Enter a public HTTPS webhook endpoint before authorizing delivery.";
      setAuthorizationMessage({ type: "error", text });
      toast({ title: "Endpoint required", description: text, variant: "destructive" });
      return;
    }
    setAuthorizationMessage(null);
    authorizeWebhook.mutate(
      { id, data: { endpoint } },
      {
        onSuccess: (authorization) => {
          setSessionAuthorizedEndpoint(authorization.endpoint);
          queryClient.setQueryData(
            getGetSpcPlayerWebhookAuthorizationQueryKey(id),
            { authorized: true, ...authorization },
          );
          setAuthorizationMessage({ type: "success", text: "Webhook endpoint authorized for this run." });
          toast({
            title: "Webhook authorized",
            description: "Consent recorded for this endpoint. No credentials were requested or stored.",
          });
        },
        onError: (err: any) => {
          const text = err?.data?.error || err?.message || "The webhook endpoint could not be authorized.";
          setAuthorizationMessage({ type: "error", text });
          toast({ title: "Authorization failed", description: text, variant: "destructive" });
        },
      },
    );
  };

  const handleDeliver = () => {
    if (!id || !authorizedEndpoint) return;
    setDeliveryMessage(null);
    deliverRun.mutate(
      { id },
      {
        onSuccess: (delivery) => {
          const text = `Delivered to the authorized endpoint (HTTP ${delivery.statusCode}).`;
          setDeliveryMessage({ type: "success", text });
          toast({ title: "Webhook delivered", description: text });
        },
        onError: (err: any) => {
          const text = err?.data?.error || err?.message || "The final package could not be delivered.";
          setDeliveryMessage({ type: "error", text });
          toast({ title: "Delivery failed", description: text, variant: "destructive" });
        },
      },
    );
  };

  const renderSkeleton = () => (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );

  if (!id) return null;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <TopNav />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/spc-player")}
          className="mb-6 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          data-testid="button-back"
        >
          <ArrowLeft className="mr-2 h-3 w-3" />
          Back to Dashboard
        </Button>

        {isRunLoading || isDevKitLoading || isCatalogLoading ? (
          renderSkeleton()
        ) : run ? (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-border/50">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <Badge variant="outline" className="font-mono text-[10px] tracking-widest text-primary border-primary/40 bg-primary/5">
                    {run.status}
                  </Badge>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    ID: {run.id}
                  </span>
                </div>
                <h1 className="font-display text-3xl md:text-4xl tracking-wider text-foreground mb-3">{run.title}</h1>
                <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed whitespace-pre-wrap">{run.brief}</p>
              </div>

              <div className="flex flex-col gap-3 sm:shrink-0 min-w-[200px]">
                <Button
                  onClick={handleExecute}
                  disabled={executeRun.isPending || !canExecute}
                  className="w-full font-mono text-xs uppercase tracking-wider h-11"
                  data-testid="button-execute"
                >
                  {executeRun.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                  {executeRun.isPending
                    ? "Executing..."
                    : run.status === "COMPLETED"
                      ? "Completed"
                      : activeAttempt
                        ? "Executing..."
                        : run.executionState === "RECOVERABLE" || run.status === "RUNNING" || run.status === "FAILED"
                          ? "Retry Run"
                          : "Execute Run"}
                </Button>
                {activeAttempt && run.retryAvailableAt && (
                  <p className="text-center text-[10px] font-mono text-muted-foreground" data-testid="retry-available-at">
                    An active attempt owns this run. Retry available{" "}
                    <time dateTime={run.retryAvailableAt}>
                      {new Date(run.retryAvailableAt).toLocaleString()}
                    </time>.
                  </p>
                )}
                {!activeAttempt && run.executionState === "RECOVERABLE" && (
                  <p className="text-center text-[10px] font-mono text-amber-600 dark:text-amber-400" data-testid="retry-available-now">
                    The previous attempt was interrupted. Retry is available now.
                  </p>
                )}
                {run.outputPackage && (
                  <Button
                    variant="outline"
                    onClick={handleDownloadPackage}
                    className="w-full font-mono text-[10px] uppercase tracking-wider"
                    data-testid="button-download-package"
                  >
                    <Download className="mr-2 h-3.5 w-3.5" />
                    Download Final JSON Package
                  </Button>
                )}
              </div>
            </div>

            {run.status !== "DRAFT" && (
              <div className="space-y-4" data-testid="execution-result">
                <div className="bg-card border border-border/50 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-mono text-xs font-bold uppercase tracking-wider">
                      {run.status === "RUNNING" ? "Execution in progress" : "Execution Advisory"}
                    </h3>
                    <Badge variant="outline" className="font-mono text-[9px] uppercase">{run.profile}</Badge>
                  </div>
                  {run.executionAdvisory ? (
                    <>
                      <p className="text-xs text-muted-foreground mb-2">
                        Authority: {run.executionAdvisory.authority} · {run.executionAdvisory.status}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Invoked stages: {run.executionAdvisory.invokedStages.join(", ") || "none"}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground mt-3">{run.executionAdvisory.distribution}</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {run.status === "RUNNING" ? "Stages are executing in order; retained results will appear below." : "Execution did not produce an advisory."}
                    </p>
                  )}
                  {run.error && <p className="mt-3 text-sm text-destructive" data-testid="execution-error">{run.error}</p>}
                </div>

                {run.stageResults.length > 0 && (
                  <div className="bg-card border border-border/50 rounded-lg overflow-hidden">
                    <div className="bg-muted/30 px-4 py-3 border-b border-border/50">
                      <h3 className="font-mono text-xs font-bold uppercase tracking-wider">Retained Stage Results</h3>
                    </div>
                    <div className="divide-y divide-border/40">
                      {run.stageResults.map((stage) => (
                        <div key={`${stage.stageIndex}-${stage.cardId}`} className="p-4" data-testid={`stage-result-${stage.stageIndex}`}>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-semibold">{stage.stageIndex + 1}. {stage.cardSlug}</span>
                            <Badge variant="secondary" className="text-[9px]">{stage.verdict}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{stage.content}</p>
                          {stage.evidence.length > 0 && (
                            <p className="text-[10px] font-mono text-muted-foreground mt-2">Evidence: {stage.evidence.join(" · ")}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {run.governanceEvaluation && (
                  <div className="bg-card border border-border/50 rounded-lg p-5" data-testid="governance-evaluation">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-mono text-xs font-bold uppercase tracking-wider">Governance Evaluation</h3>
                      <Badge variant="secondary" className="text-[9px]">{run.governanceEvaluation.verdict}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{run.governanceEvaluation.content}</p>
                    {run.governanceEvaluation.evidence.length > 0 && (
                      <p className="text-[10px] font-mono text-muted-foreground mt-2">Evidence: {run.governanceEvaluation.evidence.join(" · ")}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-6">
                <div className="bg-card border border-border/50 rounded-lg overflow-hidden">
                  <div className="bg-muted/30 px-4 py-3 border-b border-border/50 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <h3 className="font-mono text-xs font-bold uppercase tracking-wider">Governance Policy</h3>
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <span className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Spec Version</span>
                      <span className="text-sm font-semibold">{run.governance.specVersion}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Source Node</span>
                      <span className="text-sm font-mono break-all">{run.governance.source}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Score Policy Axes</span>
                      <div className="flex flex-wrap gap-2">
                        {run.governance.scorePolicy.axes.map((axis) => (
                          <Badge key={axis} variant="secondary" className="font-mono text-[10px] uppercase">
                            <Activity className="mr-1 h-3 w-3" />
                            {axis}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2 italic">Each policy axis is shown independently; no aggregate is displayed.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border/50 rounded-lg overflow-hidden">
                  <div className="bg-muted/30 px-4 py-3 border-b border-border/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-secondary" />
                      <h3 className="font-mono text-xs font-bold uppercase tracking-wider">Dev Kit Registry</h3>
                    </div>
                    <Badge variant="outline" className="font-mono text-[9px] uppercase">{devKit?.name}</Badge>
                  </div>
                  <div className="p-0 divide-y divide-border/40">
                    {devKit?.cardIds.map((cardId, index) => (
                      <div key={`${cardId}-${index}`} className="px-4 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors">
                        <div className="min-w-0 pr-4">
                          <p className="text-xs font-semibold truncate">{getCardName(cardId)}</p>
                          <p className="text-[10px] font-mono text-muted-foreground truncate">{getCardSlug(cardId)}</p>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-muted-foreground/50 shrink-0">{String(index + 1).padStart(2, "0")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2">
                <div className="bg-card border border-border/50 rounded-lg overflow-hidden h-full flex flex-col">
                  <div className="bg-muted/30 px-4 py-3 border-b border-border/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileJson className="h-4 w-4 text-primary" />
                      <h3 className="font-mono text-xs font-bold uppercase tracking-wider">Selected Card References</h3>
                    </div>
                    <span className="font-mono text-[10px] font-bold text-muted-foreground">{run.selectedCardIds.length} SELECTED</span>
                  </div>
                  <div className="p-4 flex-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {run.selectedCardIds.map((cardId) => (
                        <div key={cardId} className="flex flex-col p-3 rounded-md border border-border/60 bg-background" data-testid={`selected-card-${cardId}`}>
                          <div className="flex items-start gap-2 mb-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                            <h4 className="text-xs font-semibold leading-tight line-clamp-2">{getCardName(cardId)}</h4>
                          </div>
                          <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mt-auto pl-5">{getCardSlug(cardId) || cardId}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {run.outputPackage && (
              <div className="bg-card border border-border/50 rounded-lg p-5" data-testid="final-json-output">
                <div className="flex items-center gap-2 mb-4">
                  <FileJson className="h-4 w-4 text-primary" />
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider">Final JSON Output</h3>
                </div>
                <Badge variant="secondary" className="mb-4">Final JSON package</Badge>
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Independent quality axes</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {([
                    ["clarity", run.outputPackage.scores.clarity],
                    ["truthfulness", run.outputPackage.scores.truthfulness],
                    ["detectability", run.outputPackage.scores.detectability],
                  ] as const).map(([axis, score]) => (
                    <div key={axis} className="rounded-md border border-border/60 bg-background p-3" data-testid={`score-${axis}`}>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{axis}</p>
                      <p className="text-xl font-semibold mt-1">{score ?? "—"}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-card border border-border/50 rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-4 py-3 border-b border-border/50 flex items-center gap-2">
                <Send className="h-4 w-4 text-secondary" />
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider">Webhook Connector</h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <Label htmlFor="webhook-endpoint" className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Public HTTPS endpoint</Label>
                  <Input
                    id="webhook-endpoint"
                    type="url"
                    value={webhookEndpoint}
                    onChange={(event) => setWebhookEndpoint(event.target.value)}
                    placeholder="https://example.com/spc-player"
                    className="mt-2"
                    data-testid="input-webhook-endpoint"
                  />
                  <p className="text-[10px] text-muted-foreground mt-2">Authorization stores endpoint metadata and consent only. Do not enter credentials or other secrets.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={handleAuthorize}
                    disabled={authorizeWebhook.isPending}
                    className="font-mono text-[10px] uppercase tracking-wider"
                    data-testid="button-authorize-webhook"
                  >
                    {authorizeWebhook.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    Authorize Webhook
                  </Button>
                  <Button
                    onClick={handleDeliver}
                    disabled={!run.outputPackage || !authorizedEndpoint || deliverRun.isPending}
                    className="font-mono text-[10px] uppercase tracking-wider"
                    data-testid="button-deliver-webhook"
                  >
                    {deliverRun.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-2 h-3.5 w-3.5" />}
                    Deliver Final Package
                  </Button>
                </div>
                {authorizedEndpoint && (
                  <p className="text-xs text-primary" data-testid="webhook-authorization-status">
                    Authorized endpoint: <span className="font-mono break-all">{authorizedEndpoint}</span>
                  </p>
                )}
                {authorizationMessage && (
                  <p className={`text-xs ${authorizationMessage.type === "success" ? "text-primary" : "text-destructive"}`} role="status">{authorizationMessage.text}</p>
                )}
                {deliveryMessage && (
                  <p className={`text-xs ${deliveryMessage.type === "success" ? "text-primary" : "text-destructive"}`} role="status">{deliveryMessage.text}</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20">
            <h2 className="text-xl font-semibold mb-2">Run Not Found</h2>
            <p className="text-muted-foreground">The requested SPC Player run could not be located.</p>
          </div>
        )}
      </main>
    </div>
  );
}