import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Redirect } from "wouter";
import { AlertTriangle, FileUp, RefreshCw, Upload } from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";
import type {
  ProviderBillingImportResult,
  ProviderBillingReport,
} from "@workspace/api-client-react";
import { TopNav } from "@/components/layout/TopNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const REPORT_QUERY_PREFIX = ["/admin/provider-billing"] as const;
const MAX_UPLOAD_BYTES = 1_000_000;

function currentUtcMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function fmtUsd(value: number | null): string {
  if (value === null) return "Not available";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function providerName(provider: string): string {
  const names: Record<string, string> = {
    claude: "Anthropic",
    openai: "OpenAI",
    gemini: "Google Gemini",
    deepseek: "DeepSeek",
    kimi: "Moonshot",
    qwen: "Alibaba Qwen",
    glm: "Zhipu GLM",
  };
  return names[provider] ?? provider;
}

function signedUsd(value: number | null): string {
  if (value === null) return "—";
  if (value === 0) return fmtUsd(0);
  return `${value > 0 ? "+" : "−"}${fmtUsd(Math.abs(value))}`;
}

function monthLabel(month: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return "selected month";
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year!, monthNumber! - 1, 1)).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );
}

export default function AdminProviderBilling() {
  const { data: me, isLoading: isLoadingMe } = useGetMe();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [month, setMonth] = useState(currentUtcMonth);
  const [file, setFile] = useState<File | null>(null);

  const {
    data,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery<ProviderBillingReport>({
    queryKey: [...REPORT_QUERY_PREFIX, month],
    queryFn: () =>
      api.get<ProviderBillingReport>(
        `/api/admin/provider-billing/${encodeURIComponent(month)}`,
      ),
    enabled: me?.role === "ADMIN" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month),
  });

  const upload = useMutation({
    mutationFn: async ({
      csv,
      fileName,
      reportMonth,
    }: {
      csv: string;
      fileName: string;
      reportMonth: string;
    }) =>
      api.postCsv<ProviderBillingImportResult>(
        `/api/admin/provider-billing/${encodeURIComponent(reportMonth)}`,
        csv,
        fileName,
      ),
    onSuccess: async (result) => {
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      await queryClient.invalidateQueries({
        queryKey: [...REPORT_QUERY_PREFIX, result.month],
      });
      toast({
        title: "Billing report imported",
        description: `${result.importedLines} model line${result.importedLines === 1 ? "" : "s"} saved for ${result.providers.map(providerName).join(", ")}.${result.replacedProviders.length > 0 ? ` Replaced: ${result.replacedProviders.map(providerName).join(", ")}.` : ""}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Could not import billing report",
        description: error instanceof Error ? error.message : "Check the CSV and try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoadingMe) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <TopNav />
        <main className="flex-1 container py-8 px-4 md:px-6 max-w-6xl">
          <Skeleton className="h-32 w-full" />
        </main>
      </div>
    );
  }

  if (!me || me.role !== "ADMIN") return <Redirect to="/command" />;

  const handleUpload = async () => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast({
        title: "CSV is too large",
        description: "Billing report uploads must be 1 MB or smaller.",
        variant: "destructive",
      });
      return;
    }
    try {
      const csv = await file.text();
      upload.mutate({ csv, fileName: file.name, reportMonth: month });
    } catch {
      toast({
        title: "Could not read the selected file",
        description: "Choose a readable CSV file and try again.",
        variant: "destructive",
      });
    }
  };

  const materialProviders =
    data?.providers.filter((provider) => provider.materialDifference) ?? [];
  const coverageCount =
    data?.providers.filter((provider) => provider.reportUploaded).length ?? 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav />
      <main className="flex-1 container py-8 px-4 md:px-6 max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Provider bill comparison</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Compare the spend ledger’s model-use estimates with billing reports for
              the same UTC month. Reports and differences are visible to admins.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="billing-month">Report month (UTC)</Label>
              <Input
                id="billing-month"
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="w-44"
                data-testid="input-billing-month"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => void refetch()}
              disabled={isFetching}
              data-testid="button-refresh-provider-billing"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Link href="/admin/ops">
              <Button variant="ghost">Ops →</Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5" />
              Import provider billing CSV
            </CardTitle>
            <CardDescription>
              Use one row per billed model with the exact columns{" "}
              <code className="font-mono">provider,model,amount_usd</code>. The month
              comes from the selector above. Amounts are net USD; negative values are
              accepted for credits and adjustments.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div className="space-y-2">
                <Label htmlFor="provider-billing-csv">CSV report</Label>
                <Input
                  ref={fileInput}
                  id="provider-billing-csv"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    const selected = event.currentTarget.files?.[0] ?? null;
                    setFile(selected);
                  }}
                  data-testid="input-provider-billing-csv"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum 1 MB. Provider keys match the ledger: claude, openai,
                  gemini, deepseek, kimi, qwen, glm. Anthropic and Google provider
                  names are mapped to claude and gemini. A repeat upload replaces
                  that month’s report for the provider keys included in the file.
                </p>
              </div>
              <Button
                onClick={() => void handleUpload()}
                disabled={!file || upload.isPending || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)}
                data-testid="button-upload-provider-billing"
              >
                <Upload className="mr-2 h-4 w-4" />
                {upload.isPending ? "Importing…" : `Import ${monthLabel(month)}`}
              </Button>
            </div>
            <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs">
              {"provider,model,amount_usd\nclaude,claude-sonnet-4-6,12.345678\nopenai,gpt-5.4,7.50"}
            </pre>
            <p className="text-xs text-muted-foreground">
              The original file contents are parsed in memory and not retained. Only
              the source filename and provider/model totals are saved. No billing
              credentials are requested or stored.
            </p>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-52 w-full" />
          </div>
        ) : isError || !data ? (
          <Card>
            <CardContent className="py-8 text-sm text-destructive">
              Could not load the provider comparison for {monthLabel(month)}. Try
              refreshing the report.
            </CardContent>
          </Card>
        ) : (
          <>
            {materialProviders.length > 0 && (
              <div
                className="flex items-start gap-3 rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm"
                role="status"
                data-testid="banner-material-provider-differences"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <strong>
                    {materialProviders.length} provider
                    {materialProviders.length === 1 ? "" : "s"} with a material
                    difference
                  </strong>
                  <p className="mt-1 text-muted-foreground">
                    {materialProviders.map((provider) => providerName(provider.provider)).join(", ")}{" "}
                    {materialProviders.length === 1 ? "has" : "have"} an estimate-to-bill
                    gap of at least $1 and 5%. Review the provider/model breakdown
                    below.
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Internal estimate · all providers</CardDescription>
                  <CardTitle className="text-2xl" data-testid="text-provider-billing-estimated">
                    {fmtUsd(data.estimatedUsd)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Ledger total for {monthLabel(data.month)}.
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Provider-reported · uploaded bills</CardDescription>
                  <CardTitle className="text-2xl" data-testid="text-provider-billing-reported">
                    {fmtUsd(data.reportedUsd)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Bills uploaded for {coverageCount} of {data.providers.length} providers.
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Difference · covered providers only</CardDescription>
                  <CardTitle
                    className="text-2xl"
                    data-testid="text-provider-billing-difference"
                  >
                    {signedUsd(data.differenceUsd)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Positive means reported bills were higher than estimates. Providers
                  without a bill are excluded.
                </CardContent>
              </Card>
            </div>

            {data.providers.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-sm text-muted-foreground">
                  No model-use estimates or provider bills were recorded for this month.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {data.providers.map((provider) => (
                  <Card key={provider.provider} data-testid={`card-provider-${provider.provider}`}>
                    <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle>{providerName(provider.provider)}</CardTitle>
                          <Badge variant={provider.reportUploaded ? "outline" : "secondary"}>
                            {provider.reportUploaded ? "Bill uploaded" : "No bill uploaded"}
                          </Badge>
                          {provider.materialDifference && (
                            <Badge variant="destructive">Material difference</Badge>
                          )}
                        </div>
                        <CardDescription className="mt-2">
                          {provider.explanation}
                          {provider.fileName ? ` Source: ${provider.fileName}.` : ""}
                        </CardDescription>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-right text-xs sm:min-w-[23rem]">
                        <div>
                          <div className="text-muted-foreground">Estimate</div>
                          <div className="mt-1 font-mono text-sm tabular-nums">
                            {fmtUsd(provider.estimatedUsd)}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Provider bill</div>
                          <div className="mt-1 font-mono text-sm tabular-nums">
                            {fmtUsd(provider.reportedUsd)}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Bill − estimate</div>
                          <div className="mt-1 font-mono text-sm tabular-nums">
                            {signedUsd(provider.differenceUsd)}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {provider.models.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No model-level usage lines are available.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[760px] border-collapse text-sm">
                            <thead>
                              <tr className="border-b text-left text-xs text-muted-foreground">
                                <th className="py-2 pr-4 font-medium">Model</th>
                                <th className="py-2 pr-4 text-right font-medium">Estimate</th>
                                <th className="py-2 pr-4 text-right font-medium">Reported</th>
                                <th className="py-2 pr-4 text-right font-medium">Bill − estimate</th>
                                <th className="py-2 font-medium">Explanation</th>
                              </tr>
                            </thead>
                            <tbody>
                              {provider.models.map((model) => (
                                <tr
                                  key={model.modelId}
                                  className="border-b last:border-0"
                                  data-testid={`row-provider-model-${provider.provider}-${model.modelId}`}
                                >
                                  <td className="py-3 pr-4 font-mono text-xs">{model.modelId}</td>
                                  <td className="py-3 pr-4 text-right font-mono tabular-nums">
                                    {fmtUsd(model.estimatedUsd)}
                                  </td>
                                  <td className="py-3 pr-4 text-right font-mono tabular-nums">
                                    {fmtUsd(model.reportedUsd)}
                                  </td>
                                  <td className="py-3 pr-4 text-right font-mono tabular-nums">
                                    {signedUsd(model.differenceUsd)}
                                  </td>
                                  <td className="py-3 text-xs text-muted-foreground">
                                    {model.explanation}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Model estimates use recorded ledger costs for the selected UTC month.
              A provider difference is material at $1 or more and at least 5% of the
              larger of the estimate and bill. Differences can reflect pricing,
              discounts, region, adjustments, or model-name differences in the
              uploaded report.
            </p>
          </>
        )}
      </main>
    </div>
  );
}