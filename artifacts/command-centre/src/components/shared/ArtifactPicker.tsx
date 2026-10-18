import { FileText } from "lucide-react";
import { artifactDisplayName } from "@workspace/artifact-naming";
import {
  useListArtifacts,
  type HarnessArtifact,
} from "@workspace/api-client-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type ArtifactPickerProps = {
  value?: string;
  onChange: (artifactId: string | undefined) => void;
  label?: string;
  description?: string;
  testId?: string;
  disabled?: boolean;
  readOnly?: boolean;
};

export function ArtifactPicker({
  value,
  onChange,
  label = "Source project artifact",
  description = "Optionally ground this service in an existing project artifact.",
  testId = "select-source-artifact",
  disabled = false,
  readOnly = false,
}: ArtifactPickerProps) {
  const { data: artifacts, isLoading, isError } = useListArtifacts();
  const selected = artifacts?.find((artifact) => artifact.id === value);

  return (
    <div className="space-y-2">
      <Label className="font-mono text-[10px] uppercase tracking-wider text-primary font-bold flex items-center gap-2">
        <FileText className="h-3.5 w-3.5" />
        {label}
      </Label>
      {isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : readOnly ? (
        <div className="rounded-md border bg-background/50 p-3 text-sm" data-testid={`${testId}-locked`}>
          {selected ? (
            <>
              <p className="font-semibold break-words">{artifactDisplayName(selected)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{selected.artifactType.replace(/_/g, " ")} · {new Date(selected.createdAt).toLocaleString()}</p>
              <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">Artifact ID: {selected.id}</p>
            </>
          ) : (
            <p role="alert" className="text-destructive">
              {isError ? "Unable to load the source artifact. Retry before continuing." : "The bound source artifact is unavailable. Return to the originating stage; no replacement will be selected."}
            </p>
          )}
        </div>
      ) : (
        <Select
          value={value ?? "none"}
          onValueChange={(next) => onChange(next === "none" ? undefined : next)}
          disabled={disabled}
        >
          <SelectTrigger className="bg-background/50 font-mono text-xs" data-testid={testId}>
            <SelectValue placeholder="Choose an existing artifact…">
              {selected ? artifactDisplayName(selected) : value ? "Source artifact unavailable" : "No source artifact"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none" className="font-mono text-xs">
              No source artifact
            </SelectItem>
            {(artifacts ?? []).map((artifact) => (
              <SelectItem key={artifact.id} value={artifact.id} className="text-xs" textValue={`${artifactDisplayName(artifact)} · ${artifact.artifactType} · ${artifact.id}`}>
                <div className="max-w-[min(75vw,650px)] whitespace-normal py-1">
                  <span className="block font-semibold break-words">{artifactDisplayName(artifact)}</span>
                  <span className="block text-muted-foreground">{artifact.artifactType.replace(/_/g, " ")} · {new Date(artifact.createdAt).toLocaleString()}</span>
                  <span className="block break-all font-mono text-[10px] text-muted-foreground">ID: {artifact.id}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <p className="text-[10px] font-mono text-muted-foreground">{description}</p>
      {selected && !readOnly && (
        <div className="text-[10px] font-mono break-words" data-testid={`${testId}-selected`}>
          <p className="text-secondary">Selected: {artifactDisplayName(selected)}</p>
          <p className="text-muted-foreground">{selected.artifactType.replace(/_/g, " ")} · {new Date(selected.createdAt).toLocaleString()}</p>
          <p className="break-all text-muted-foreground">Artifact ID: {selected.id}</p>
        </div>
      )}
      {!isLoading && (artifacts ?? []).length === 0 && (
        <p className="text-[10px] font-mono text-muted-foreground">
          No saved artifacts yet. Create one from a HARNESS session first.
        </p>
      )}
    </div>
  );
}

export type { HarnessArtifact };