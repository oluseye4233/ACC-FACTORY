import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListExemplarsQueryKey } from "@workspace/api-client-react";
import { Library, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export function SaveToExemplarLibraryButton({
  artifactId,
}: {
  artifactId: string;
}) {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const save = async () => {
    setPending(true);
    try {
      await api.post("/api/exemplars/from-artifact", { artifactId });
      setSaved(true);
      await qc.invalidateQueries({ queryKey: getListExemplarsQueryKey() });
      toast({
        title: "Added to Exemplar Library",
        description: "Available in the open backend marketplace.",
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) setSaved(true);
      toast({
        title: error instanceof ApiError && error.status === 409
          ? "Already in Exemplar Library"
          : "Library upload failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant:
          error instanceof ApiError && error.status === 409
            ? undefined
            : "destructive",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      onClick={save}
      size="sm"
      variant="outline"
      className="font-mono text-xs"
      disabled={pending || saved}
      data-testid="exemplar-library-save"
    >
      {saved ? <Check className="h-3 w-3 mr-1" /> : <Library className="h-3 w-3 mr-1" />}
      {saved ? "IN EXEMPLAR LIBRARY" : pending ? "UPLOADING…" : "UPLOAD TO EXEMPLAR LIBRARY"}
    </Button>
  );
}