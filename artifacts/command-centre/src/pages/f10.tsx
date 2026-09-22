import { useEffect, useState } from "react";
import {
  useListF10Releases,
  useCreateF10Release,
  useGetF10Release,
  useProcessF10Release,
  useGetF10Catalog,
  useListF10Sources,
  useCreateF10ExportManifest,
  useDownloadF10Export,
  usePushF10ExportToGitHub,
  useListF10Destinations,
  useCreateF10Destination,
  getListF10ReleasesQueryKey,
  getGetF10ReleaseQueryKey,
  getListF10DestinationsQueryKey,
  useListF10ProviderConnections,
  useAuthorizeF10ProviderConnection,
  useRevokeF10ProviderConnection,
  useListF10BundleDeployments,
  useGetF10BundleDeployment,
  useCreateF10BundleDeployment,
  useProcessF10BundleDeployment,
  useReconcileF10BundleDeployment,
  getListF10ProviderConnectionsQueryKey,
  getListF10BundleDeploymentsQueryKey,
  getGetF10BundleDeploymentQueryKey,
  F10DestinationRequestAdapterId,
  F10DestinationRequestAdapterVersion,
  type F10Release,
  type F10ExportInput,
  type F10ExportInputOutputKind,
  type F10ExportInputTarget,
  type F10ExportInputFamily,
  type F10ExportInputDeliveryMode,
  type F10ExportManifest,
  type F10GitHubPushResult,
  useListF10ColonizationRuns,
  useCreateF10ColonizationRun,
  useGetF10ColonizationRun,
  getListF10ColonizationRunsQueryKey,
  getGetF10ColonizationRunQueryKey,
  F10ColonizationInputRequestClass,
  F10ColonizationInputArtifactClass,
  F10ColonizationInputTargetClass,
  type F10ColonizationRun
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ShieldCheck,
  Clock,
  AlertTriangle,
  Ban,
  CheckCircle2,
  TerminalSquare,
  ServerCrash,
  Activity,
  Play,
  Github,
  ExternalLink
} from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";

interface ExtendedF10Release extends F10Release {
  machineArtifactId?: string;
  destinationRef?: string;
  destinationIdentity?: string;
  createdAt?: string;
  updatedAt?: string;
  policyHash?: string;
  attemptCount?: number;
  attempts?: any[];
  receipt?: any;
  dlq?: any;
}

const PROVIDER_CONFIG_FIELDS: Record<"AWS" | "AZURE" | "OPENAI_AGENTS" | "GEMINI_AGENTS", Array<{ key: string; label: string; required?: boolean }>> = {
  AWS: [{ key: "region", label: "Region", required: true }, { key: "resourceName", label: "Resource name", required: true }, { key: "accountId", label: "Account ID" }, { key: "roleArn", label: "Role ARN" }],
  AZURE: [{ key: "subscriptionId", label: "Subscription ID", required: true }, { key: "resourceGroup", label: "Resource group", required: true }, { key: "location", label: "Location", required: true }, { key: "resourceName", label: "Resource name", required: true }, { key: "tenantId", label: "Tenant ID" }],
  OPENAI_AGENTS: [{ key: "model", label: "Model", required: true }, { key: "environment", label: "Environment", required: true }, { key: "projectId", label: "Project ID" }, { key: "agentId", label: "Agent ID" }],
  GEMINI_AGENTS: [{ key: "projectId", label: "Project ID", required: true }, { key: "location", label: "Location", required: true }, { key: "model", label: "Model", required: true }, { key: "environment", label: "Environment", required: true }, { key: "agentId", label: "Agent ID" }, { key: "displayName", label: "Display name" }],
};

const releaseSchema = z.object({
  machineArtifactId: z.string().min(1, "Machine Artifact ID is required"),
  destinationId: z.string().uuid("Must be a valid UUID"),
  releaseIntent: z.string().min(1, "Release intent is required"),
});

function getErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "error" in err) {
    return (err as any).error;
  }
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: unknown }).data;
    if (data && typeof data === "object" && "reason" in data && typeof data.reason === "string") return data.reason;
    if (data && typeof data === "object" && "error" in data && typeof data.error === "string") return data.error;
  }
  return "An unexpected error occurred.";
}

function getStateColor(state?: string) {
  switch (state) {
    case "REQUESTED":
    case "VERIFYING":
    case "AUTHORIZED":
      return "bg-secondary text-secondary-foreground";
    case "QUEUED":
    case "DISPATCHING":
      return "bg-blue-600 text-white";
    case "ACKNOWLEDGED":
      return "bg-primary text-primary-foreground";
    case "BLOCKED":
    case "FAILED_PERMANENT":
    case "DEAD_LETTERED":
    case "CANCELLED":
      return "bg-destructive text-destructive-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getStateIcon(state?: string) {
  switch (state) {
    case "QUEUED":
    case "DISPATCHING":
      return <Clock className="h-4 w-4" />;
    case "ACKNOWLEDGED":
      return <CheckCircle2 className="h-4 w-4" />;
    case "BLOCKED":
      return <Ban className="h-4 w-4" />;
    case "FAILED_PERMANENT":
    case "DEAD_LETTERED":
      return <ServerCrash className="h-4 w-4" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
}

function ReleaseDetailDialog({
  releaseId,
  open,
  onOpenChange
}: {
  releaseId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: rawData, isLoading, isError } = useGetF10Release(releaseId || "", {
    query: {
      enabled: !!releaseId,
      queryKey: getGetF10ReleaseQueryKey(releaseId || "")
    }
  });

  const data = rawData as ExtendedF10Release | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 bg-background border-border">
        <DialogHeader className="px-6 py-4 border-b border-border bg-muted/30">
          <DialogTitle className="font-display tracking-widest text-xl text-primary flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            RELEASE DOSSIER {releaseId?.substring(0,8)}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs uppercase">
            Immutable audit log for outbound transmission
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center font-mono text-sm text-muted-foreground">
              Retrieving ledger...
            </div>
          ) : isError || !data ? (
            <div className="flex h-32 items-center justify-center font-mono text-sm text-destructive">
              Failed to load release details.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm font-mono">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase mb-1">State</span>
                  <Badge variant="outline" className={`rounded-sm font-mono border-0 ${getStateColor(data.state)}`}>
                    {data.state}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase mb-1">Created At</span>
                  <span>{data.createdAt ? format(new Date(data.createdAt), "yyyy-MM-dd HH:mm:ss.SSS") : "N/A"}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block text-[10px] uppercase mb-1">Artifact ID</span>
                  <span className="break-all">{data.machineArtifactId}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block text-[10px] uppercase mb-1">Destination</span>
                  <span className="break-all">{data.destinationRef || data.destinationIdentity}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block text-[10px] uppercase mb-1">Idempotency Key</span>
                  <span className="break-all text-xs text-muted-foreground">{data.idempotencyKey}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block text-[10px] uppercase mb-1">Policy Hash</span>
                  <span className="break-all text-xs text-muted-foreground">{data.policyHash}</span>
                </div>
              </div>

              {data.blockedReasons && data.blockedReasons.length > 0 && (
                <div className="border border-destructive/50 bg-destructive/10 p-4 rounded-sm">
                  <h4 className="font-mono text-xs font-bold text-destructive uppercase mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> Blocked Reasons
                  </h4>
                  <ul className="list-disc list-inside space-y-1 pl-4 font-mono text-sm text-destructive/90">
                    {data.blockedReasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              <Separator className="bg-border" />

              <div>
                <h4 className="font-display tracking-widest text-primary mb-3">APPEND-ONLY TRANSITIONS</h4>
                <div className="space-y-2">
                  {data.transitions?.map((t: any, i: number) => (
                    <div key={i} className="flex gap-4 items-start p-3 bg-muted/20 border border-border/50 rounded-sm font-mono text-xs">
                      <div className="w-40 shrink-0 text-muted-foreground">
                        {t.createdAt ? format(new Date(t.createdAt), "HH:mm:ss.SSS") : ""}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">{t.fromState}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className={`px-1.5 py-0.5 rounded-sm text-[10px] ${getStateColor(t.toState)}`}>
                            {t.toState}
                          </span>
                        </div>
                        <div className="text-muted-foreground">{t.reason}</div>
                      </div>
                    </div>
                  ))}
                  {(!data.transitions || data.transitions.length === 0) && (
                    <div className="text-sm font-mono text-muted-foreground italic">No transitions recorded.</div>
                  )}
                </div>
              </div>

              {data.attempts && data.attempts.length > 0 && (
                <>
                  <Separator className="bg-border" />
                  <div>
                    <h4 className="font-display tracking-widest text-primary mb-3">DISPATCH ATTEMPTS</h4>
                    <div className="space-y-2">
                      {data.attempts.map((a: any, i: number) => (
                        <div key={i} className="grid grid-cols-4 gap-2 p-3 bg-muted/20 border border-border/50 rounded-sm font-mono text-xs">
                          <div><span className="text-muted-foreground block text-[10px]">Attempt</span>#{a.attemptNumber}</div>
                          <div><span className="text-muted-foreground block text-[10px]">State</span>{a.state}</div>
                          <div className="col-span-2"><span className="text-muted-foreground block text-[10px]">Result</span>{a.resultClass || "N/A"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {data.receipt && (
                <>
                  <Separator className="bg-border" />
                  <div className="border border-primary/30 bg-primary/5 p-4 rounded-sm">
                    <h4 className="font-display tracking-widest text-primary mb-2 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" /> DELIVERY RECEIPT
                    </h4>
                    <p className="font-mono text-[10px] text-muted-foreground mb-4 uppercase">
                      A signed delivery receipt proves receipt only, not deployment or execution.
                    </p>
                    <pre className="font-mono text-xs bg-black/50 p-3 rounded-sm overflow-auto text-primary-foreground/80">
                      {JSON.stringify(data.receipt, null, 2)}
                    </pre>
                  </div>
                </>
              )}

              {data.dlq && (
                <>
                  <Separator className="bg-border" />
                  <div className="border border-destructive/30 bg-destructive/5 p-4 rounded-sm">
                    <h4 className="font-display tracking-widest text-destructive mb-2 flex items-center gap-2">
                      <ServerCrash className="h-4 w-4" /> DEAD LETTER QUEUE
                    </h4>
                    <pre className="font-mono text-xs bg-black/50 p-3 rounded-sm overflow-auto text-destructive-foreground/80">
                      {JSON.stringify(data.dlq, null, 2)}
                    </pre>
                  </div>
                </>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

const colonizationSchema = z.object({
  requestClass: z.nativeEnum(F10ColonizationInputRequestClass).default(F10ColonizationInputRequestClass.SENSE_ONLY),
  artifactRef: z.string().min(1, "Required"),
  artifactHash: z.string().regex(/^sha256:[a-f0-9]{64}$/, "Must be sha256:hash"),
  artifactClass: z.nativeEnum(F10ColonizationInputArtifactClass).default(F10ColonizationInputArtifactClass.SPC),
  ucgCertificateRef: z.string().min(1, "Required"),
  target: z.string().min(1, "Required"),
  targetClass: z.nativeEnum(F10ColonizationInputTargetClass).default(F10ColonizationInputTargetClass.SOFTWARE_PLATFORM),
  connectorAdapter: z.string().min(1, "Required"),
  f9AttestationRef: z.string().optional(),
  consentChannel: z.string().min(1, "Required"),
});

function getColStateColor(state?: string) {
  switch (state) {
    case "RUNNING": return "bg-blue-600 text-white border-0";
    case "REFUSED": return "bg-destructive text-destructive-foreground border-0";
    case "STAGED_ONLY": return "bg-secondary text-secondary-foreground border-0";
    case "PROMOTED": return "bg-primary text-primary-foreground border-0";
    default: return "bg-muted text-muted-foreground";
  }
}

function ColonizationRunDialog({ runId, open, onOpenChange }: { runId: string | null; open: boolean; onOpenChange: (o: boolean) => void; }) {
  const { data: rawData, isLoading, isError } = useGetF10ColonizationRun(runId || "", {
    query: { enabled: !!runId, queryKey: getGetF10ColonizationRunQueryKey(runId || "") }
  });
  const data = rawData as F10ColonizationRun | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 bg-background border-border">
        <DialogHeader className="px-6 py-4 border-b border-border bg-muted/30">
          <DialogTitle className="font-display tracking-widest text-xl text-primary flex items-center gap-2">
            <TerminalSquare className="h-5 w-5" />
            SAVANT CONNECTOR RUN {data?.runId || runId?.substring(0,8)}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs uppercase text-muted-foreground">
            Strict isolation constraints apply. NO LIFE, NO CERTIFICATION.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          {isLoading ? (
             <div className="flex h-32 items-center justify-center font-mono text-sm text-muted-foreground">Retrieving ledger...</div>
          ) : isError || !data ? (
             <div className="flex h-32 items-center justify-center font-mono text-sm text-destructive">Failed to load run details.</div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm font-mono">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase mb-1">State</span>
                  <Badge variant="outline" className={`rounded-sm font-mono border-0 ${getColStateColor(data.state)}`}>
                    {data.state}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase mb-1">Created At</span>
                  <span>{data.createdAt ? format(new Date(data.createdAt), "yyyy-MM-dd HH:mm:ss.SSS") : "N/A"}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block text-[10px] uppercase mb-1">Artifact</span>
                  <span className="break-all">{data.artifactClass} // {data.artifactRef}</span>
                  <div className="text-[10px] text-muted-foreground mt-1 break-all">{data.artifactHash}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block text-[10px] uppercase mb-1">Target</span>
                  <span className="break-all">{data.targetClass} // {data.target}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block text-[10px] uppercase mb-1">UCG Certificate Ref</span>
                  <span className="break-all text-xs">{data.ucgCertificateRef || "NONE"}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block text-[10px] uppercase mb-1">F9 Attestation Ref</span>
                  <span className="break-all text-xs">{(data as any).f9AttestationRef || "NONE PROVIDED"}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block text-[10px] uppercase mb-1">Max Reachable Phase</span>
                  <span className="font-bold">{data.maxReachablePhase}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block text-[10px] uppercase mb-1">GRO Mode</span>
                  <span className="font-bold">{data.groMode}</span>
                </div>
              </div>

              {data.state === "REFUSED" && data.refusal && (
                <div className="border border-destructive/50 bg-destructive/10 p-4 rounded-sm">
                  <h4 className="font-mono text-xs font-bold text-destructive uppercase mb-2 flex items-center gap-2">
                    <Ban className="h-4 w-4" /> CITED REFUSAL
                  </h4>
                  <div className="space-y-2 font-mono text-xs text-destructive/90">
                    <div><strong>CAUSE:</strong> {data.refusal.cause || "UNKNOWN_CAUSE"}</div>
                    <div><strong>ACTION REQUIRED:</strong> {data.refusal.requiredToProceed || "NONE"}</div>
                    <pre className="mt-2 p-2 bg-black/40 rounded-sm text-[10px] overflow-auto">
                      {JSON.stringify(data.refusal, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              <Separator className="bg-border" />

              <div>
                <h4 className="font-display tracking-widest text-primary mb-3">PHASE STATUSES (C0-C8)</h4>
                <div className="grid grid-cols-3 gap-2">
                  {(["C0", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"] as const).map(p => {
                    const status = data.phaseStatuses?.[p] || "PENDING";
                    const isError = status === "REFUSED";
                    const isSuccess = status === "COMPLETE";
                    return (
                      <div key={p} className={`border p-2 rounded-sm font-mono text-[10px] uppercase flex flex-col gap-1 ${isError ? 'bg-destructive/10 border-destructive/50 text-destructive' : isSuccess ? 'bg-primary/10 border-primary/50 text-primary' : 'bg-muted/20 border-border text-muted-foreground'}`}>
                        <span className="font-bold">{p}</span>
                        <span>{status}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator className="bg-border" />

              <div>
                <h4 className="font-display tracking-widest text-primary mb-3">ADAPTER READINESS</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-xs">
                  {Object.entries(data.adapterReadiness || {}).map(([key, val]) => {
                    const strVal = String(val);
                    const isReady = strVal === "READY" || strVal === "AVAILABLE";
                    return (
                      <div key={key} className="flex justify-between border-b border-border/50 pb-1">
                        <span className="text-muted-foreground uppercase">{key}</span>
                        <span className={isReady ? "text-primary font-bold" : "text-destructive"}>{strVal}</span>
                      </div>
                    );
                  })}
                  {Object.keys(data.adapterReadiness || {}).length === 0 && (
                    <div className="text-muted-foreground italic col-span-2">No readiness checks completed.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

interface F10ConsoleProps {
  /** When present, F10 is rendered as the final stage of a session's production line. */
  sessionId?: string;
  embedded?: boolean;
}

type F9ProductionRun = {
  status?: string;
  artifactContent?: { machine_artifact_id?: string } | null;
};

export default function F10Console({ sessionId, embedded = false }: F10ConsoleProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("handoff");
  const [upstreamArtifactId, setUpstreamArtifactId] = useState<string | null>(null);

  // Hand-off State
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<string>("");
  const [selectedTarget, setSelectedTarget] = useState<string>("");
  const [showManifestDialog, setShowManifestDialog] = useState(false);
  const [manifestData, setManifestData] = useState<F10ExportManifest | null>(null);
  const [githubStatus, setGithubStatus] = useState<{ connected: boolean; oauthAvailable?: boolean } | null>(null);
  const [githubRepos, setGithubRepos] = useState<Array<{ fullName: string; defaultBranch: string }>>([]);
  const [githubRepository, setGithubRepository] = useState("");
  const [githubBranch, setGithubBranch] = useState("main");
  const [githubResult, setGithubResult] = useState<F10GitHubPushResult | null>(null);

  // Live Dispatch State
  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null);
  const [newDestination, setNewDestination] = useState({
    name: "",
    adapterId: F10DestinationRequestAdapterId.https,
    adapterVersion: F10DestinationRequestAdapterVersion.NUMBER_1,
    endpoint: "",
    secretRef: "",
    authorizationScopes: ""
  });

  // Colonization State
  const [selectedColRunId, setSelectedColRunId] = useState<string | null>(null);
  const { data: colRuns = [], isLoading: colRunsLoading } = useListF10ColonizationRuns({
    query: {
      queryKey: getListF10ColonizationRunsQueryKey(),
      refetchInterval: 15000,
    }
  });
  const createColRun = useCreateF10ColonizationRun();

  const colForm = useForm<z.infer<typeof colonizationSchema>>({
    resolver: zodResolver(colonizationSchema),
    defaultValues: {
      requestClass: "SENSE_ONLY",
      artifactRef: "",
      artifactHash: "sha256:",
      artifactClass: "SPC",
      ucgCertificateRef: "",
      target: "",
      targetClass: "SOFTWARE_PLATFORM",
      connectorAdapter: "SAVANT_DEFAULT",
      f9AttestationRef: "",
      consentChannel: "STANDARD_TCP",
    }
  });

  function onColSubmit(values: z.infer<typeof colonizationSchema>) {
    createColRun.mutate({ data: {
      ...values,
      f9AttestationRef: values.f9AttestationRef || undefined,
    } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListF10ColonizationRunsQueryKey() });
        toast({ title: "Run Created", description: "Savant Connector protocol enqueued." });
        colForm.reset();
      },
      onError: (err: unknown) => {
        toast({ title: "Request Failed", description: getErrorMessage(err), variant: "destructive" });
      }
    });
  }

  // Queries
  const { data: catalog, isLoading: isLoadingCatalog } = useGetF10Catalog();
  const { data: sourcesData, isLoading: isLoadingSources } = useListF10Sources();
  const sources = sourcesData || [];

  const { data: destinationsData } = useListF10Destinations();
  const destinations = destinationsData || [];
  const { data: providerConnections = [], isLoading: connectionsLoading } = useListF10ProviderConnections();
  const { data: bundleDeployments = [], isLoading: deploymentsLoading } = useListF10BundleDeployments({
    query: {
      queryKey: getListF10BundleDeploymentsQueryKey(),
      refetchInterval: 60_000,
      refetchOnWindowFocus: true,
    },
  });
  const [provider, setProvider] = useState<"AWS" | "AZURE" | "OPENAI_AGENTS" | "GEMINI_AGENTS">("AWS");
  const [providerTarget, setProviderTarget] = useState("AWS_LAMBDA");
  const [deploymentSource, setDeploymentSource] = useState("");
  const [deploymentConnection, setDeploymentConnection] = useState("");
  const [deploymentConfig, setDeploymentConfig] = useState<Record<string, string>>({});
  const [selectedBundleDeployment, setSelectedBundleDeployment] = useState("");
  const { data: bundleDeploymentDetail } = useGetF10BundleDeployment(selectedBundleDeployment, { query: { enabled: Boolean(selectedBundleDeployment), queryKey: getGetF10BundleDeploymentQueryKey(selectedBundleDeployment) } });

  const { data: releasesRaw, isLoading: isLoadingReleases } = useListF10Releases();
  const releases = (releasesRaw as ExtendedF10Release[]) || [];

  // Mutations
  const createF10ExportManifest = useCreateF10ExportManifest();
  const downloadF10Export = useDownloadF10Export();
  const pushF10ExportToGitHub = usePushF10ExportToGitHub();
  const createDestination = useCreateF10Destination();
  const createRelease = useCreateF10Release();
  const processRelease = useProcessF10Release();
  const authorizeProviderConnection = useAuthorizeF10ProviderConnection();
  const revokeProviderConnection = useRevokeF10ProviderConnection();
  const createBundleDeployment = useCreateF10BundleDeployment();
  const processBundleDeployment = useProcessF10BundleDeployment();
  const reconcileBundleDeployment = useReconcileF10BundleDeployment();

  // Hand-off Logic
  const filteredSources = sources.filter(s => {
    if (sourceFilter !== "ALL" && s.outputKind !== sourceFilter) return false;
    return true;
  });

  const selectedFamilyData = catalog?.families.find(f => f.family === selectedFamily);
  const selectedSource = sources.find(s => s.id === selectedSourceId);
  const selectedSourceOutputKind = selectedSource?.outputKind;

  useEffect(() => {
    if (selectedFamilyData && selectedSourceOutputKind) {
      const isSupported = selectedFamilyData.supportedOutputs?.includes(selectedSourceOutputKind as any) ?? true;
      if (!isSupported) {
        setSelectedFamily("");
        setSelectedTarget("");
      }
    }
  }, [selectedSourceOutputKind, selectedFamilyData]);

  useEffect(() => {
    if (selectedFamilyData && selectedFamilyData.targets.length > 0) {
      if (!selectedFamilyData.targets.includes(selectedTarget)) {
        setSelectedTarget(selectedFamilyData.targets[0]);
      }
    } else {
      setSelectedTarget("");
    }
  }, [selectedFamily, selectedFamilyData, selectedTarget]);

  useEffect(() => {
    if (selectedFamily !== "GITHUB") return;
    let current = true;
    api.get<{ connected: boolean; oauthAvailable?: boolean }>("/api/integrations/github")
      .then(status => {
        if (!current) return;
        setGithubStatus(status);
        if (status.connected) {
          void api.get<{ repos: Array<{ fullName: string; defaultBranch: string }> }>("/api/integrations/github/repos")
            .then(data => {
              if (!current) return;
              setGithubRepos(data.repos);
              const first = data.repos[0];
              if (first) {
                setGithubRepository(value => value || first.fullName);
                setGithubBranch(first.defaultBranch || "main");
              }
            });
        }
      })
      .catch(() => { if (current) setGithubStatus({ connected: false }); });
    return () => { current = false; };
  }, [selectedFamily]);

  const handleGitHubRepositoryChange = (fullName: string) => {
    setGithubRepository(fullName);
    const repo = githubRepos.find(item => item.fullName === fullName);
    setGithubBranch(repo?.defaultBranch || "main");
    setGithubResult(null);
  };

  const handlePushToGitHub = async () => {
    if (!selectedSource || selectedFamily !== "GITHUB" || !selectedTarget || !githubRepository || !githubBranch) return;
    try {
      const result = await pushF10ExportToGitHub.mutateAsync({ data: {
        sourceArtifactId: selectedSource.id,
        outputKind: selectedSource.outputKind as F10ExportInputOutputKind,
        family: "GITHUB",
        target: selectedTarget as F10ExportInputTarget,
        deliveryMode: "EXPORT",
        repository: githubRepository,
        branch: githubBranch,
      } });
      setGithubResult(result);
      toast({
        title: result.idempotent ? "Already Pushed" : "GitHub Push Complete",
        description: `${result.repository} · ${result.branch}`,
      });
    } catch (err: unknown) {
      toast({ title: "GitHub Push Failed", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  const handlePreviewManifest = async () => {
    if (!selectedSource || !selectedFamily || !selectedTarget) return;

    const mode = selectedFamilyData?.liveMode === "INTERNAL_HANDOFF" ? "INTERNAL_HANDOFF" : "EXPORT";
    const input: F10ExportInput = {
      sourceArtifactId: selectedSource.id,
      outputKind: selectedSource.outputKind as F10ExportInputOutputKind,
      family: selectedFamily as F10ExportInputFamily,
      target: selectedTarget as any,
      deliveryMode: mode as F10ExportInputDeliveryMode
    };

    try {
      const manifest = await createF10ExportManifest.mutateAsync({ data: input });
      setManifestData(manifest);
      setShowManifestDialog(true);
    } catch (err: unknown) {
      toast({
        title: "Preview Failed",
        description: getErrorMessage(err),
        variant: "destructive"
      });
    }
  };

  const handleDownloadBundle = async () => {
    if (!selectedSource || !selectedFamily || !selectedTarget) return;

    const mode = selectedFamilyData?.liveMode === "INTERNAL_HANDOFF" ? "INTERNAL_HANDOFF" : "EXPORT";
    const input: F10ExportInput = {
      sourceArtifactId: selectedSource.id,
      outputKind: selectedSource.outputKind as F10ExportInputOutputKind,
      family: selectedFamily as F10ExportInputFamily,
      target: selectedTarget as any,
      deliveryMode: mode as F10ExportInputDeliveryMode
    };

    try {
      const blob = await downloadF10Export.mutateAsync({ data: input });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `f10-export-${selectedSource.id.substring(0,8)}-${input.family}-${input.target}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download Complete",
        description: "The bundle has been successfully downloaded.",
      });
    } catch (err: unknown) {
      toast({
        title: "Download Failed",
        description: getErrorMessage(err),
        variant: "destructive"
      });
    }
  };

  // Live Dispatch Logic
  async function handleCreateDestination() {
    createDestination.mutate(
      {
        data: {
          ...newDestination,
          authorizationScopes: newDestination.authorizationScopes.split(",").map(s => s.trim()).filter(Boolean)
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListF10DestinationsQueryKey() });
          setNewDestination({ name: "", adapterId: F10DestinationRequestAdapterId.https, adapterVersion: F10DestinationRequestAdapterVersion.NUMBER_1, endpoint: "", secretRef: "", authorizationScopes: "" });
          toast({ title: "Destination Created" });
        },
        onError: (err: unknown) => {
          toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
        }
      }
    );
  }

  const providerTargets: Record<string, string[]> = {
    AWS: ["AWS_LAMBDA", "AWS_ECS_FARGATE", "AWS_S3"],
    AZURE: ["AZURE_FUNCTIONS", "AZURE_CONTAINER_APPS", "AZURE_BLOB_STORAGE"],
    OPENAI_AGENTS: ["OPENAI_AGENTS_SDK"],
    GEMINI_AGENTS: ["GEMINI_ADK", "GEMINI_VERTEX_AGENT_ENGINE"],
  };
  function handleCreateProviderConnection(connectionId?: string, providerOverride = provider) {
      authorizeProviderConnection.mutate({ data: { provider: providerOverride, returnTo: sessionId ? `${window.location.origin}/session/${sessionId}` : `${window.location.origin}/f10`, connectionId } }, {
      onSuccess: (result: any) => { if (result?.authorizeUrl) window.location.assign(result.authorizeUrl); else toast({ title: "Provider unavailable", description: "Use the deterministic export fallback.", variant: "destructive" }); },
      onError: (e) => toast({ title: "Connection failed", description: getErrorMessage(e), variant: "destructive" }),
    });
  }
  function handleCreateBundleDeployment() {
    const missing = PROVIDER_CONFIG_FIELDS[provider].filter(field => field.required && !deploymentConfig[field.key]?.trim());
    if (missing.length) { toast({ title: "Target configuration incomplete", description: `Enter ${missing.map(field => field.label).join(", ")}.`, variant: "destructive" }); return; }
    createBundleDeployment.mutate({ data: { sourceArtifactId: deploymentSource, provider, target: providerTarget as any, connectionRef: deploymentConnection, outputKind: (sources.find(source => source.id === deploymentSource)?.outputKind || "SPC") as any, targetConfig: deploymentConfig as any, releaseIntent: `command-centre-${Date.now()}` } }, {
      onSuccess: (result: any) => { queryClient.invalidateQueries({ queryKey: getListF10BundleDeploymentsQueryKey() }); toast({ title: result?.deployment === false ? "Export fallback ready" : "Deployment queued", description: result?.deployment === false ? "Provider is unconfigured or revoked; no deployment was claimed." : "Provider acceptance and execution are not confirmed." }); },
      onError: (e) => toast({ title: "Deployment failed", description: getErrorMessage(e), variant: "destructive" }),
    });
  }

  const form = useForm<z.infer<typeof releaseSchema>>({
    resolver: zodResolver(releaseSchema),
    defaultValues: {
      machineArtifactId: "",
      destinationId: "",
      releaseIntent: "",
    },
  });

  useEffect(() => {
    if (!sessionId) return;
    let current = true;
    api
      .get<F9ProductionRun[]>(
        `/api/harness/f9/runs?sessionId=${encodeURIComponent(sessionId)}`,
      )
      .then((runs) => {
        const emitted = runs.find(
          (run) => run.status === "EMITTED" && run.artifactContent?.machine_artifact_id,
        );
        const artifactId = emitted?.artifactContent?.machine_artifact_id ?? null;
        if (current) {
          setUpstreamArtifactId(artifactId);
          if (artifactId) form.setValue("machineArtifactId", artifactId);
        }
      })
      .catch(() => {
        if (current) setUpstreamArtifactId(null);
      });
    return () => {
      current = false;
    };
  }, [sessionId, form]);

  function onSubmit(values: z.infer<typeof releaseSchema>) {
    createRelease.mutate(
      { data: sessionId ? { ...values, sessionId } : values },
      {
        onSuccess: (data: any) => {
          queryClient.invalidateQueries({ queryKey: getListF10ReleasesQueryKey() });

          if (data.state === "BLOCKED") {
            toast({
              title: "Release Blocked",
              description: "The release request failed policy or custody prerequisites.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Release Requested",
              description: "The machine artifact has been enqueued for F10 dispatch.",
            });
            form.reset();
          }
        },
        onError: (err: unknown) => {
          toast({
            title: "Request Failed",
            description: getErrorMessage(err),
            variant: "destructive",
          });
        }
      }
    );
  }

  function onProcess(id: string) {
    processRelease.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListF10ReleasesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetF10ReleaseQueryKey(id) });
          toast({
            title: "Dispatch Triggered",
            description: "The worker has been signaled to process the release.",
          });
        },
        onError: (err: unknown) => {
          queryClient.invalidateQueries({ queryKey: getListF10ReleasesQueryKey() });
          toast({
            title: "Dispatch Failed",
            description: getErrorMessage(err),
            variant: "destructive",
          });
        }
      }
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {!embedded && <TopNav />}
      <main className={embedded ? "w-full p-1 md:p-2 space-y-8" : "container py-8 max-w-6xl space-y-8"}>
        <ReleaseDetailDialog
          releaseId={selectedReleaseId}
          open={!!selectedReleaseId}
          onOpenChange={(o) => !o && setSelectedReleaseId(null)}
        />

        <ColonizationRunDialog
          runId={selectedColRunId}
          open={!!selectedColRunId}
          onOpenChange={(o) => !o && setSelectedColRunId(null)}
        />

        <Dialog open={showManifestDialog} onOpenChange={setShowManifestDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0">
            <DialogHeader className="px-6 py-4 border-b border-border bg-muted/30">
              <DialogTitle className="font-display tracking-widest text-xl text-primary">
                MANIFEST PREVIEW
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="flex-1 p-6">
              {manifestData && (
                <div className="space-y-6 font-mono text-sm">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div><span className="text-muted-foreground block text-[10px] uppercase">Source ID</span>{manifestData.source.id}</div>
                    <div><span className="text-muted-foreground block text-[10px] uppercase">Source Hash</span><span className="break-all">{manifestData.source.contentSha256}</span></div>
                    <div><span className="text-muted-foreground block text-[10px] uppercase">Profile Family</span>{manifestData.profile.family}</div>
                    <div><span className="text-muted-foreground block text-[10px] uppercase">Profile Target</span>{manifestData.profile.target}</div>
                    <div className="col-span-2"><span className="text-muted-foreground block text-[10px] uppercase">Bundle Hash Scope</span>{manifestData.bundleSha256Scope || "N/A"}</div>
                  </div>

                  <div>
                    <h4 className="font-bold uppercase text-xs mb-2">Files ({manifestData.files.length})</h4>
                    <div className="space-y-2">
                      {manifestData.files.map(f => (
                        <div key={f.path} className="p-2 border border-border/50 bg-muted/10 text-xs">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-primary">{f.path}</span>
                            <span className="text-muted-foreground">{f.bytes} bytes</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-muted-foreground uppercase">Role: {f.role}</span>
                            <span className="truncate ml-4 max-w-[200px]" title={f.sha256}>Hash: {f.sha256}</span>
                          </div>
                        </div>
                      ))}
                      {manifestData.files.length === 0 && (
                        <div className="text-muted-foreground italic text-xs">No files listed in manifest.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>

        <div>
          <h1 className="text-4xl font-display tracking-widest text-primary flex items-center gap-3 uppercase">
            <TerminalSquare className="h-8 w-8" />
            {embedded ? "F10 Connector" : "F10 Release Console"}
          </h1>
          <p className="font-mono text-sm text-muted-foreground mt-2 uppercase tracking-wide">
             {embedded
               ? "The production-line handoff after F9. Verify custody, authorize the destination, and record the delivery receipt."
               : "Portable multi-artifact handoffs and immutable transmission of signed F9 machine artifacts across controlled boundaries."}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-8 bg-muted/50 border border-border rounded-none w-full justify-start h-auto p-0">
            <TabsTrigger
              value="handoff"
              className="rounded-none font-display tracking-widest text-base py-3 px-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border-r border-border"
            >
              HYBRID HANDOFF
            </TabsTrigger>
            <TabsTrigger
              value="live"
              className="rounded-none font-display tracking-widest text-base py-3 px-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border-r border-border"
            >
              LIVE SIGNED DISPATCH
            </TabsTrigger>
            <TabsTrigger
              value="savant"
              className="rounded-none font-display tracking-widest text-base py-3 px-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border-r border-border"
            >
              SAVANT CONNECTOR
            </TabsTrigger>
          </TabsList>

          <TabsContent value="handoff" className="m-0 focus-visible:outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column: Source Selection */}
              <Card className="border-border bg-card/50 backdrop-blur h-[600px] flex flex-col">
                <CardHeader className="border-b border-border bg-muted/20 pb-4">
                  <CardTitle className="font-display tracking-widest text-lg">SOURCE SELECTION</CardTitle>
                  <CardDescription className="font-mono text-xs uppercase">
                    Select an eligible artifact for extraction
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-border bg-muted/10">
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                      <Button
                        variant={sourceFilter === "ALL" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSourceFilter("ALL")}
                        className="h-7 text-[10px] font-mono shrink-0"
                        data-testid="filter-ALL"
                      >
                        ALL
                      </Button>
                      {catalog?.outputKinds.map(kind => (
                        <Button
                          key={kind}
                          variant={sourceFilter === kind ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSourceFilter(kind)}
                          className="h-7 text-[10px] font-mono shrink-0"
                          data-testid={`filter-${kind}`}
                        >
                          {kind.replace(/_/g, ' ')}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <ScrollArea className="flex-1 bg-card/30">
                    {isLoadingSources || isLoadingCatalog ? (
                      <div className="p-8 text-center font-mono text-sm text-muted-foreground uppercase">
                        Synchronizing catalog...
                      </div>
                    ) : filteredSources.length === 0 ? (
                      <div className="p-8 text-center font-mono text-sm text-muted-foreground uppercase">
                        No eligible sources found.
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {filteredSources.map(source => (
                          <div
                            key={source.id}
                            onClick={() => setSelectedSourceId(source.id)}
                            className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors group ${selectedSourceId === source.id ? 'bg-primary/5 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}`}
                            data-testid={`source-row-${source.id}`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="overflow-hidden pr-4">
                                <div className="font-mono text-sm font-bold text-primary group-hover:text-primary/80 transition-colors truncate">
                                  {source.name || source.id.substring(0,8)}
                                </div>
                                <div className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
                                  {source.id}
                                </div>
                              </div>
                              <Badge variant={selectedSourceId === source.id ? "default" : "outline"} className="font-mono text-[10px] shrink-0">
                                {source.outputKind}
                              </Badge>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground uppercase">
                              <span className="truncate pr-4">TYPE: {source.type}</span>
                              <span className="shrink-0">{format(new Date(source.createdAt), "yyyy-MM-dd HH:mm")}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Right Column: Configuration */}
              <Card className="border-border bg-card/50 backdrop-blur h-[600px] flex flex-col">
                <CardHeader className="border-b border-border bg-muted/20 pb-4">
                  <CardTitle className="font-display tracking-widest text-lg">TARGET CONFIGURATION</CardTitle>
                  <CardDescription className="font-mono text-xs uppercase">
                    Specify destination platform and delivery profile
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 p-6 flex flex-col">
                  <div className="space-y-6 flex-1">
                    <div className="space-y-2">
                      <label className="font-mono text-xs uppercase text-muted-foreground">Destination Family</label>
                      <Select value={selectedFamily} onValueChange={setSelectedFamily} disabled={!selectedSource}>
                        <SelectTrigger data-testid="select-family" className="font-mono text-sm">
                          <SelectValue placeholder={!selectedSource ? "Select a source first" : "Select destination family"} />
                        </SelectTrigger>
                        <SelectContent>
                          {catalog?.families.map(f => {
                            const isSupported = selectedSourceOutputKind ? f.supportedOutputs?.includes(selectedSourceOutputKind as any) ?? true : true;
                            return (
                              <SelectItem
                                key={f.family}
                                value={f.family}
                                data-testid={`family-option-${f.family}`}
                                className="font-mono text-sm"
                                disabled={!isSupported}
                              >
                                {f.family.replace(/_/g, ' ')}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>

                      {!selectedFamily && selectedSourceOutputKind && selectedSourceOutputKind !== "CODE_DJ" && (
                        <p className="font-mono text-[10px] text-muted-foreground mt-2">
                          Note: PROGRAMMING ENVIRONMENT requires a CODE DJ output.
                        </p>
                      )}
                    </div>

                    {selectedFamilyData && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                        <label className="font-mono text-xs uppercase text-muted-foreground">Dependent Target</label>
                        <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                          <SelectTrigger data-testid="select-target" className="font-mono text-sm">
                            <SelectValue placeholder="Select target configuration" />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedFamilyData.targets.map(t => {
                              const normalizedId = t.replace(/[^a-zA-Z0-9]/g, '-');
                              return (
                                <SelectItem key={t} value={t} data-testid={`target-option-${normalizedId}`} className="font-mono text-sm">
                                  {t}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {selectedFamilyData && (
                      <div className="p-4 bg-muted/20 border border-border/50 rounded-sm space-y-3 animate-in fade-in">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-[10px] bg-background border-primary/20 text-primary">{selectedFamilyData.liveMode}</Badge>
                          {selectedFamilyData.fallbackMode && (
                            <Badge variant="secondary" className="font-mono text-[10px]">{selectedFamilyData.fallbackMode} FALLBACK</Badge>
                          )}
                        </div>
                        <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                          {selectedFamilyData.configuration}
                        </p>

                        {/* Honest Mode Labels */}
                        {selectedFamilyData.liveMode === "USER_AUTHORIZED" && (
                          <div className="mt-2 p-3 bg-secondary/10 border border-secondary/20 rounded-sm">
                            <p className="font-mono text-[10px] text-secondary-foreground uppercase leading-relaxed">
                              Bundle can be pushed using existing user-authorized GitHub flow where connected. Connects through your own external subscription/access process.
                            </p>
                            {selectedFamily === "GITHUB" && (
                              <div className="mt-3 space-y-3">
                                {githubStatus?.connected ? (
                                  <>
                                    <div className="space-y-1">
                                      <label className="font-mono text-[10px] uppercase text-muted-foreground">Repository</label>
                                      <Select value={githubRepository} onValueChange={handleGitHubRepositoryChange}>
                                        <SelectTrigger data-testid="select-github-repository" className="font-mono text-xs bg-background">
                                          <SelectValue placeholder="Select a repository" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {githubRepos.map(repo => <SelectItem key={repo.fullName} value={repo.fullName}>{repo.fullName}</SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1">
                                      <label className="font-mono text-[10px] uppercase text-muted-foreground">Branch</label>
                                      <Input data-testid="input-github-branch" value={githubBranch} onChange={event => setGithubBranch(event.target.value)} className="font-mono text-xs bg-background" />
                                    </div>
                                    <Button
                                      type="button"
                                      onClick={handlePushToGitHub}
                                      disabled={!selectedSourceId || !selectedTarget || !githubRepository || !githubBranch || pushF10ExportToGitHub.isPending}
                                      data-testid="btn-push-github"
                                      className="w-full font-mono uppercase text-xs"
                                    >
                                      <Github className="h-4 w-4 mr-2" />
                                      {pushF10ExportToGitHub.isPending ? "Pushing..." : "Push to GitHub"}
                                    </Button>
                                    {githubResult && (
                                      <a href={githubResult.commitUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-mono text-[10px] text-primary underline">
                                        View commit {githubResult.commitSha.slice(0, 8)} <ExternalLink className="h-3 w-3" />
                                      </a>
                                    )}
                                  </>
                                ) : (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    data-testid="btn-connect-github"
                                    onClick={() => { window.location.href = githubStatus?.oauthAvailable ? "/api/integrations/github/oauth/start" : "/account"; }}
                                    className="w-full font-mono uppercase text-xs"
                                  >
                                    <Github className="h-4 w-4 mr-2" /> Connect GitHub
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {selectedFamilyData.liveMode === "INTERNAL_HANDOFF" && (
                          <div className="mt-2 p-3 bg-primary/10 border border-primary/20 rounded-sm">
                            <p className="font-mono text-[10px] text-primary uppercase leading-relaxed">
                              Internal import package. Not a live deployment.
                            </p>
                          </div>
                        )}
                        {selectedFamilyData.liveMode === "EXPORT" && (
                          <div className="mt-2 p-3 bg-muted/50 border border-border rounded-sm">
                            <p className="font-mono text-[10px] text-muted-foreground uppercase leading-relaxed">
                              Export bundle. Connects through your own external subscription/access process.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4 pt-6 border-t border-border">
                    <Button
                      variant="outline"
                      onClick={handlePreviewManifest}
                      disabled={!selectedSourceId || !selectedFamily || !selectedTarget || createF10ExportManifest.isPending}
                      data-testid="btn-preview-manifest"
                      className="flex-1 font-mono uppercase text-xs tracking-wider"
                    >
                      {createF10ExportManifest.isPending ? "Generating..." : "Preview Manifest"}
                    </Button>
                    <Button
                      onClick={handleDownloadBundle}
                      disabled={!selectedSourceId || !selectedFamily || !selectedTarget || downloadF10Export.isPending}
                      data-testid="btn-download-bundle"
                      className="flex-1 font-mono uppercase text-xs tracking-wider"
                    >
                      {downloadF10Export.isPending ? "Bundling..." : "Download Bundle"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="live" className="m-0 focus-visible:outline-none">
            <Card className="mb-8 border-primary/30 bg-primary/5">
              <CardHeader><CardTitle className="font-display tracking-widest text-lg">NATIVE PROVIDER BUNDLE LANE</CardTitle><CardDescription className="font-mono text-xs">Connect your own provider account. The server creates the bundle; provider acceptance is not proof of execution.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <select className="h-10 rounded-md border border-input bg-background px-3 font-mono text-xs" value={provider} onChange={e => { const p = e.target.value as typeof provider; setProvider(p); setProviderTarget(providerTargets[p][0]); setDeploymentConfig({}); setDeploymentConnection(""); }}>
                    {Object.keys(providerTargets).map(p => <option key={p}>{p}</option>)}
                  </select>
                  <select className="h-10 rounded-md border border-input bg-background px-3 font-mono text-xs" value={providerTarget} onChange={e => setProviderTarget(e.target.value)}>
                    {providerTargets[provider].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex gap-2"><Button type="button" size="sm" onClick={() => handleCreateProviderConnection()} disabled={authorizeProviderConnection.isPending}> {authorizeProviderConnection.isPending ? "Opening authorization..." : "Connect account"} </Button></div>
                <div className="grid gap-3 md:grid-cols-3">
                  <select className="h-10 rounded-md border border-input bg-background px-3 font-mono text-xs" value={deploymentSource} onChange={e => setDeploymentSource(e.target.value)}><option value="">Source artifact</option>{sources.map(s => <option key={s.id} value={s.id}>{s.name || s.id.slice(0, 8)}</option>)}</select>
                  <select className="h-10 rounded-md border border-input bg-background px-3 font-mono text-xs" value={deploymentConnection} onChange={e => setDeploymentConnection(e.target.value)}><option value="">Authorization connection</option>{providerConnections.filter(c => c.provider === provider && c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                  <Button type="button" onClick={handleCreateBundleDeployment} disabled={createBundleDeployment.isPending || !deploymentSource || !deploymentConnection}>{createBundleDeployment.isPending ? "Generating..." : "Deploy or export fallback"}</Button>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {PROVIDER_CONFIG_FIELDS[provider].map(field => (
                    <Input key={field.key} aria-label={field.label} placeholder={`${field.label}${field.required ? " *" : ""}`} value={deploymentConfig[field.key] ?? ""} onChange={event => setDeploymentConfig(current => ({ ...current, [field.key]: event.target.value }))} />
                  ))}
                </div>
                <div className="space-y-2">{connectionsLoading ? <p className="font-mono text-xs">Loading connections...</p> : providerConnections.map(c => <div key={c.id} className="flex items-center justify-between border border-border/50 p-2 font-mono text-xs"><span>{c.provider} · {c.name} · {c.active ? "ACTIVE" : "REVOKED"}</span>{c.active ? <Button size="sm" variant="outline" onClick={() => revokeProviderConnection.mutate({ id: c.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListF10ProviderConnectionsQueryKey() }) })}>Revoke</Button> : <Button size="sm" variant="outline" onClick={() => { setProvider(c.provider as typeof provider); handleCreateProviderConnection(c.id, c.provider as typeof provider); }} disabled={authorizeProviderConnection.isPending}>Reconnect</Button>}</div>)}</div>
                <div className="border-t border-border/50 pt-3 space-y-2">
                  <p className="font-mono text-[10px] uppercase text-muted-foreground">Bundle deployment history</p>
                  {deploymentsLoading ? <p className="font-mono text-xs">Loading deployment history...</p> : bundleDeployments.map(d => (
                    <div key={d.id} className="flex items-center justify-between gap-3 border border-border/50 p-2 font-mono text-xs">
                       <span>
                         {d.provider} / {d.target} · delivery {d.state} · {d.bundleHash.slice(0, 12)}…{" "}
                         <span className="text-muted-foreground">
                           execution {d.executionStatus.replaceAll("_", " ").toLowerCase()}
                           {" · "}
                           {d.reconciliationPausedAt
                             ? `checks paused: ${d.reconciliationPauseReason || "connection unavailable"}`
                             : d.executionCheckedAt
                               ? `last checked ${new Date(d.executionCheckedAt).toLocaleString()}`
                               : "not checked yet"}
                         </span>
                       </span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setSelectedBundleDeployment(d.id)}>Audit</Button>
                        {d.state === "QUEUED" && <Button size="sm" variant="outline" onClick={() => processBundleDeployment.mutate({ id: d.id }, { onSettled: () => queryClient.invalidateQueries({ queryKey: getListF10BundleDeploymentsQueryKey() }) })}>Process</Button>}
                         {d.state === "ACKNOWLEDGED" && !["COMPLETED", "FAILED"].includes(d.executionStatus) && <Button size="sm" variant="outline" disabled={reconcileBundleDeployment.isPending} onClick={() => reconcileBundleDeployment.mutate({ id: d.id }, {
                          onSuccess: (result) => {
                            queryClient.invalidateQueries({ queryKey: getListF10BundleDeploymentsQueryKey() });
                            queryClient.invalidateQueries({ queryKey: getGetF10BundleDeploymentQueryKey(d.id) });
                            toast({ title: "Execution status checked", description: `Provider reports ${result.executionStatus.toLowerCase()}. Delivery acceptance remains separately recorded.` });
                          },
                          onError: (error) => {
                            queryClient.invalidateQueries({ queryKey: getGetF10BundleDeploymentQueryKey(d.id) });
                            toast({ title: "Reconciliation unavailable", description: `${getErrorMessage(error)} The signed acceptance receipt is unchanged.`, variant: "destructive" });
                          },
                         })}>Refresh status</Button>}
                      </div>
                    </div>
                  ))}
                  {selectedBundleDeployment && bundleDeploymentDetail && (
                    <div className="border border-primary/30 bg-background p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="font-mono text-[10px] uppercase text-primary">Delivery acceptance, provider execution, destination-specific audit and receipt</p>
                        <Button size="sm" variant="ghost" onClick={() => setSelectedBundleDeployment("")}>Close</Button>
                      </div>
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] text-muted-foreground">{JSON.stringify(bundleDeploymentDetail, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Form */}
              <div className="lg:col-span-1">
                <Card className="border-border bg-card/50 backdrop-blur">
                  <CardHeader className="border-b border-border bg-muted/20">
                    <CardTitle className="font-display tracking-widest text-lg">NEW F10 RELEASE</CardTitle>
                    <CardDescription className="font-mono text-xs uppercase">
                      Authorize the emitted F9 artifact for controlled dispatch
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="machineArtifactId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-mono text-xs uppercase">Machine Artifact ID</FormLabel>
                              <FormControl>
                                <Input
                                  className="font-mono text-sm"
                                  placeholder="F9 machine artifact ID"
                                  readOnly={Boolean(sessionId)}
                                  {...field}
                                  data-testid="input-artifact-id"
                                />
                              </FormControl>
                              {sessionId && (
                                <FormDescription className="font-mono text-[10px]">
                                  {upstreamArtifactId
                                    ? "Pinned to this session's emitted F9 Machine Artifact."
                                    : "Waiting for this session's emitted F9 Machine Artifact."}
                                </FormDescription>
                              )}
                              <FormMessage className="font-mono text-xs" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="destinationId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-mono text-xs uppercase">Destination</FormLabel>
                              <FormControl>
                                 <select className="h-10 w-full rounded-md border border-input bg-background px-3 font-mono text-sm" {...field} data-testid="input-destination-id">
                                   <option value="">Select a destination</option>
                                   {destinations.filter((destination) => destination.active).map((destination) => (
                                     <option key={destination.id} value={destination.id}>{destination.name}</option>
                                   ))}
                                 </select>
                              </FormControl>
                              <FormMessage className="font-mono text-xs" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="releaseIntent"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-mono text-xs uppercase">Release Intent</FormLabel>
                              <FormControl>
                                <Input className="font-mono text-sm" placeholder="e.g. initial_deployment" {...field} data-testid="input-release-intent" />
                              </FormControl>
                              <FormDescription className="font-mono text-[10px]">
                                Used for idempotency partitioning
                              </FormDescription>
                              <FormMessage className="font-mono text-xs" />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="submit"
                          className="w-full font-mono uppercase tracking-widest"
                          disabled={createRelease.isPending}
                          data-testid="button-submit-release"
                        >
                          {createRelease.isPending ? "AUTHORIZING..." : "AUTHORIZE DISPATCH"}
                        </Button>
                      </form>
                      <div className="mt-6 border-t border-border pt-4 space-y-2">
                        <p className="font-mono text-xs uppercase text-muted-foreground">Register Destination</p>
                        <Input placeholder="Name" value={newDestination.name} onChange={(event) => setNewDestination({ ...newDestination, name: event.target.value })} />
                        <Input placeholder="HTTPS endpoint" value={newDestination.endpoint} onChange={(event) => setNewDestination({ ...newDestination, endpoint: event.target.value })} />
                        <Input placeholder="F10 secret reference" value={newDestination.secretRef} onChange={(event) => setNewDestination({ ...newDestination, secretRef: event.target.value })} />
                        <Input placeholder="Scopes (comma separated)" value={newDestination.authorizationScopes} onChange={(event) => setNewDestination({ ...newDestination, authorizationScopes: event.target.value })} />
                        <Button type="button" variant="outline" className="w-full font-mono uppercase text-xs" onClick={handleCreateDestination} disabled={createDestination.isPending}>
                          {createDestination.isPending ? "Registering..." : "Register Destination"}
                        </Button>
                      </div>
                    </Form>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Ledger */}
              <div className="lg:col-span-2">
                <Card className="border-border bg-card/50 backdrop-blur h-full flex flex-col min-h-[600px]">
                  <CardHeader className="border-b border-border bg-muted/20">
                    <CardTitle className="font-display tracking-widest text-lg">RELEASE LEDGER</CardTitle>
                    <CardDescription className="font-mono text-xs uppercase">
                      Historical record of all outbound live HTTPS transmissions
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 flex-1 relative">
                    <ScrollArea className="absolute inset-0">
                      {isLoadingReleases ? (
                        <div className="p-8 text-center font-mono text-sm text-muted-foreground uppercase">
                          Synchronizing ledger...
                        </div>
                      ) : releases.length === 0 ? (
                        <div className="p-8 text-center font-mono text-sm text-muted-foreground uppercase">
                          No releases recorded.
                        </div>
                      ) : (
                        <div className="divide-y divide-border">
                          {releases.map((release) => (
                            <div
                              key={release.id}
                              className="p-4 hover:bg-muted/30 transition-colors flex flex-col gap-3 group"
                              data-testid={`row-release-${release.id}`}
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-full ${getStateColor(release.state)}`}>
                                    {getStateIcon(release.state)}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-sm font-bold">{release.id?.substring(0,8)}</span>
                                      <Badge variant="outline" className={`rounded-sm text-[10px] font-mono border-0 ${getStateColor(release.state)}`}>
                                        {release.state}
                                      </Badge>
                                    </div>
                                    <div className="font-mono text-xs text-muted-foreground mt-0.5">
                                      {release.createdAt ? format(new Date(release.createdAt), "yyyy-MM-dd HH:mm:ss") : "Unknown Date"}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {release.state === "QUEUED" && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs font-mono border-primary text-primary hover:bg-primary/10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onProcess(release.id!);
                                      }}
                                      disabled={processRelease.isPending}
                                      data-testid={`button-process-${release.id}`}
                                    >
                                      <Play className="h-3 w-3 mr-1" /> PROCESS
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs font-mono uppercase opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => setSelectedReleaseId(release.id!)}
                                    data-testid={`button-view-${release.id}`}
                                  >
                                    VIEW DOSSIER
                                  </Button>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs pl-11">
                                <div className="truncate">
                                  <span className="text-muted-foreground mr-2">ART:</span>
                                  {release.machineArtifactId?.substring(0,24)}...
                                </div>
                                <div className="truncate">
                                  <span className="text-muted-foreground mr-2">DST:</span>
                                  {release.destinationRef}
                                </div>
                                <div className="truncate">
                                  <span className="text-muted-foreground mr-2">POL:</span>
                                  {release.policyHash?.substring(0,16)}...
                                </div>
                                <div>
                                  <span className="text-muted-foreground mr-2">ATT:</span>
                                  {release.attemptCount || 0}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

            </div>
          </TabsContent>

          <TabsContent value="savant" className="m-0 focus-visible:outline-none">
            <div className="flex items-center gap-3 bg-destructive/5 border border-destructive/20 p-4 rounded-sm mb-8">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <div className="text-sm">
                <span className="font-bold text-destructive uppercase block mb-1">Savant Connector Protocol</span>
                <span className="text-muted-foreground font-mono text-xs">
                  CONNECTOR OWNS NO VERDICT OR CERTIFICATION. SAFE_LIFE ONLY. Physical target F9 attestation must be rigorously cited. Consent simulation and LIFE promotions are hard-blocked.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <Card className="rounded-sm border-border shadow-none">
                  <CardHeader className="border-b border-border bg-muted/20 pb-4">
                    <CardTitle className="font-display tracking-widest text-lg text-primary flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      INITIATE RUN
                    </CardTitle>
                    <CardDescription className="font-mono text-xs uppercase">
                      Queue a new colonization protocol sequence.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <Form {...colForm}>
                      <form onSubmit={colForm.handleSubmit(onColSubmit)} className="space-y-4">
                        <FormField control={colForm.control} name="requestClass" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-[10px] uppercase text-muted-foreground">Request Class</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="font-mono text-xs rounded-sm"><SelectValue /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {Object.values(F10ColonizationInputRequestClass).map(v => <SelectItem key={v} value={v} className="font-mono text-xs">{v}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                        <FormField control={colForm.control} name="artifactClass" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-[10px] uppercase text-muted-foreground">Artifact Class</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="font-mono text-xs rounded-sm"><SelectValue /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {Object.values(F10ColonizationInputArtifactClass).map(v => <SelectItem key={v} value={v} className="font-mono text-xs">{v}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                        <FormField control={colForm.control} name="artifactRef" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-[10px] uppercase text-muted-foreground">Artifact Reference</FormLabel>
                            <FormControl><Input {...field} className="font-mono text-xs rounded-sm" placeholder="ID or URI..." /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={colForm.control} name="artifactHash" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-[10px] uppercase text-muted-foreground">Artifact Hash</FormLabel>
                            <FormControl><Input {...field} className="font-mono text-xs rounded-sm" placeholder="sha256:..." /></FormControl>
                            <FormMessage className="text-[10px] font-mono" />
                          </FormItem>
                        )} />
                        <FormField control={colForm.control} name="targetClass" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-[10px] uppercase text-muted-foreground">Target Class</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="font-mono text-xs rounded-sm"><SelectValue /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {Object.values(F10ColonizationInputTargetClass).map(v => <SelectItem key={v} value={v} className="font-mono text-xs">{v}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                        <FormField control={colForm.control} name="target" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-[10px] uppercase text-muted-foreground">Target Identifier</FormLabel>
                            <FormControl><Input {...field} className="font-mono text-xs rounded-sm" placeholder="IP, MAC, or URI..." /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={colForm.control} name="connectorAdapter" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-[10px] uppercase text-muted-foreground">Connector Adapter</FormLabel>
                            <FormControl><Input {...field} className="font-mono text-xs rounded-sm" placeholder="e.g. SAVANT_DEFAULT" /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={colForm.control} name="ucgCertificateRef" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-[10px] uppercase text-muted-foreground">UCG Certificate Ref</FormLabel>
                            <FormControl><Input {...field} className="font-mono text-xs rounded-sm" placeholder="Required" /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={colForm.control} name="f9AttestationRef" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-[10px] uppercase text-muted-foreground">Physical F9 Attestation Ref</FormLabel>
                            <FormControl><Input {...field} value={field.value || ""} className="font-mono text-xs rounded-sm" placeholder="Optional but strictly audited" /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={colForm.control} name="consentChannel" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-[10px] uppercase text-muted-foreground">Consent Channel</FormLabel>
                            <FormControl><Input {...field} className="font-mono text-xs rounded-sm" placeholder="e.g. STANDARD_TCP" /></FormControl>
                          </FormItem>
                        )} />

                        <Button type="submit" disabled={createColRun.isPending} className="w-full mt-4 rounded-sm font-display tracking-widest text-xs" variant="default">
                          {createColRun.isPending ? "INITIALIZING..." : "EXECUTE RUN"}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-2">
                <Card className="rounded-sm border-border shadow-none h-full flex flex-col">
                  <CardHeader className="border-b border-border bg-muted/20 pb-4">
                    <CardTitle className="font-display tracking-widest text-lg flex items-center gap-2">
                      <TerminalSquare className="h-4 w-4" />
                      LEDGER
                    </CardTitle>
                    <CardDescription className="font-mono text-xs uppercase">
                      Immutable audit log of colonization interactions.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 flex-1">
                    <div className="space-y-2">
                      {colRuns.map(run => (
                        <div key={run.id} className="p-3 bg-card border border-border rounded-sm flex flex-col gap-2 hover:border-primary cursor-pointer transition-colors" onClick={() => setSelectedColRunId(run.id)}>
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-sm font-bold text-foreground flex items-center gap-2">
                              <TerminalSquare className="h-4 w-4" />
                              {run.runId}
                            </span>
                            <Badge variant="outline" className={`rounded-sm font-mono text-[10px] ${getColStateColor(run.state)}`}>
                              {run.state}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs font-mono text-muted-foreground">
                            <div className="truncate">TGT: {run.target}</div>
                            <div>PHASE: <span className="text-foreground font-bold">{run.phase}</span></div>
                            <div className="text-right">{format(new Date(run.createdAt), "HH:mm:ss.SSS")}</div>
                          </div>
                        </div>
                      ))}
                      {colRuns.length === 0 && !colRunsLoading && (
                        <div className="text-sm font-mono text-muted-foreground p-4 border border-dashed border-border text-center">No runs recorded in ledger.</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
