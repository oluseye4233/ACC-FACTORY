import { FileText } from "lucide-react";
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
};

export function ArtifactPicker({
  value,
  onChange,
  label = "Source project artifact",
  description = "Optionally ground this service in an existing project artifact.",
  testId = "select-source-artifact",
  disabled = false,
}: ArtifactPickerProps) {
  const { data: artifacts, isLoading } = useListArtifacts();
  const selected = artifacts?.find((artifact) => artifact.id === value);

  return (
    <div className="space-y-2">
      <Label className="font-mono text-[10px] uppercase tracking-wider text-primary font-bold flex items-center gap-2">
        <FileText className="h-3.5 w-3.5" />
        {label}
      </Label>
      {isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : (
        <Select
          value={value ?? "none"}
          onValueChange={(next) => onChange(next === "none" ? undefined : next)}
          disabled={disabled}
        >
          <SelectTrigger className="bg-background/50 font-mono text-xs" data-testid={testId}>
            <SelectValue placeholder="Choose an existing artifact…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none" className="font-mono text-xs">
              No source artifact
            </SelectItem>
            {(artifacts ?? []).map((artifact) => (
              <SelectItem key={artifact.id} value={artifact.id} className="font-mono text-xs">
                {artifact.name || artifact.artifactType.replace(/_/g, " ")}
                {" · "}
                {artifact.artifactType.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <p className="text-[10px] font-mono text-muted-foreground">{description}</p>
      {selected && (
        <p className="text-[10px] font-mono text-secondary truncate" data-testid={`${testId}-selected`}>
          Selected: {selected.name || selected.artifactType.replace(/_/g, " ")}
        </p>
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