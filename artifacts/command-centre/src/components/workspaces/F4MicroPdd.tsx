import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useHarnessF4,
  getListSessionArtifactsQueryKey,
  getListFeatureStateQueryKey,
  MicroPdd,
  HarnessArtifact,
  ArtifactType,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { WorkspaceShell, ErrorBanner, EmptyState } from "./_shared";
import { extractApiError } from "@/lib/sse";
import { downloadZip } from "@/lib/zipExport";
import { Download, Workflow } from "lucide-react";

interface Props {
  sessionId: string;
  artifacts: HarnessArtifact[];
}

const TABS = [
  { k: "cheatSheet", label: "Cheat Sheet" },
  { k: "worksheet", label: "Worksheet" },
  { k: "buildLaunch", label: "Build & Launch" },
  { k: "interfaceContract", label: "Interface Contract" },
] as const;

export function F4MicroPdd({ sessionId, artifacts }: Props) {
  const qc = useQueryClient();

  const sources = useMemo(
    () =>
      artifacts
        .filter((a) => a.artifactType === ArtifactType.MA_BIRTH_PACKAGE)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [artifacts],
  );

  const [sourceId, setSourceId] = useState<string>(sources[0]?.id || "");
  const [vibe, setVibe] = useState("");
  const [result, setResult] = useState<MicroPdd | undefined>();
  const [error, setError] = useState<string | null>(null);

  const m = useHarnessF4({
    mutation: {
      onSuccess: (data) => {
        setResult(data);
        setError(null);
        qc.invalidateQueries({ queryKey: getListSessionArtifactsQueryKey(sessionId) });
        qc.invalidateQueries({ queryKey: getListFeatureStateQueryKey(sessionId) });
      },
      onError: (e) => setError(extractApiError(e).message),
    },
  });

  if (!sources.length) {
    return (
      <WorkspaceShell>
        <EmptyState
          icon={<Workflow className="h-12 w-12" />}
          title="F3 MA BIRTH PACKAGE REQUIRED"
          body="Micro PDD converts an MA Birth Package into a build-ready cheat sheet, worksheet, launch plan, and interface contract."
          hint="Run F3 first to produce a source Birth Package."
        />
      </WorkspaceShell>
    );
  }

  const convert = () => {
    if (!sourceId) {
      setError("Select a source artifact");
      return;
    }
    if (!vibe.trim()) {
      setError("Target VIBE required");
      return;
    }
    setError(null);
    m.mutate({ data: { sessionId, sourceArtifactId: sourceId, targetVibe: vibe } });
  };

  const exportZip = async () => {
    if (!result) return;
    await downloadZip(`micro-pdd-${sessionId.slice(0, 8)}.zip`, {
      "cheat-sheet.md": result.cheatSheet,
      "worksheet.md": result.worksheet,
      "build-launch.md": result.buildLaunch,
      "interface-contract.md": result.interfaceContract,
    });
  };

  return (
    <WorkspaceShell>
      <div className="flex flex-col gap-4 h-full">
        <Card className="p-5 bg-card/50">
          <div className="grid md:grid-cols-[2fr_2fr_auto] gap-3 items-end">
            <div>
              <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Source Birth Package
              </label>
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger data-testid="f4-source" className="font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="font-mono text-xs">
                      {s.id.slice(0, 8)} · {new Date(s.createdAt).toLocaleTimeString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Target VIBE
              </label>
              <Input
                data-testid="f4-vibe"
                value={vibe}
                onChange={(e) => setVibe(e.target.value)}
                placeholder="e.g. Cursor + Next.js + Supabase"
                className="font-mono text-xs"
              />
            </div>
            <Button
              data-testid="f4-convert"
              onClick={convert}
              disabled={m.isPending}
              className="font-display tracking-wider"
            >
              {m.isPending ? "CONVERTING..." : "CONVERT"}
            </Button>
          </div>
          {error && <div className="mt-3"><ErrorBanner message={error} /></div>}
        </Card>

        {result ? (
          <Card className="p-5 bg-card/50 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-secondary">
                Micro PDD
              </h4>
              <Button
                onClick={exportZip}
                size="sm"
                variant="outline"
                className="font-mono text-xs"
                data-testid="f4-export"
              >
                <Download className="h-3 w-3 mr-1" /> EXPORT ZIP
              </Button>
            </div>
            <Tabs defaultValue="cheatSheet" className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid grid-cols-4">
                {TABS.map((t) => (
                  <TabsTrigger key={t.k} value={t.k} className="font-mono text-[10px] uppercase">
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {TABS.map((t) => (
                <TabsContent key={t.k} value={t.k} className="flex-1 min-h-0 mt-3">
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/90 h-full overflow-auto p-3 bg-background/40 rounded border border-border/40">
                    {result[t.k]}
                  </pre>
                </TabsContent>
              ))}
            </Tabs>
          </Card>
        ) : (
          <EmptyState
            icon={<Workflow className="h-12 w-12" />}
            title="MICRO PDD STAGED"
            body="Select a source MA Birth Package and target VIBE, then CONVERT."
          />
        )}
      </div>
    </WorkspaceShell>
  );
}
