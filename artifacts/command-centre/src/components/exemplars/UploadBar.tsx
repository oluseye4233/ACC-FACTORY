import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { FileInput, FolderUp, Loader2, Upload } from "lucide-react";
import { portalHref } from "@/lib/portal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { invalidateCatalog } from "./invalidate";

type UploadKind = "SPC" | "MA" | "MPDD" | "PDD";

/**
 * Exemplar archive upload. File intake is centralised in the IMPRIMA Portal: only the embedded
 * (portal) instance shows file pickers; elsewhere a link opens the portal library intake tab.
 */
export function UploadBar({ embedded = false }: { embedded?: boolean } = {}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadKind, setUploadKind] = useState<UploadKind>("SPC");
  const qc = useQueryClient();
  const { toast } = useToast();

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const form = new FormData();
    Array.from(files).forEach((file) => form.append("files", file, file.name));
    form.append("kind", uploadKind);
    try {
      const response = await fetch("/api/exemplars/upload", { method: "POST", credentials: "include", body: form });
      const result = (await response.json().catch(() => null)) as { count?: number; error?: string } | null;
      if (!response.ok) throw new Error(result?.error || "Upload failed");
      await invalidateCatalog(qc);
      toast({
        title: `${uploadKind} added to Exemplar Library`,
        description: `${result?.count ?? files.length} item(s) added as library artifacts. Qualify them to select for Sphinx.`,
      });
    } catch (error) {
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (folderRef.current) folderRef.current.value = "";
    }
  };

  if (!embedded) {
    return (
      <Link href={portalHref({ tab: "intake", intake: "library" })} className="inline-flex h-9 items-center gap-2 rounded-md border border-primary/50 px-3 font-display text-sm tracking-wider text-primary hover:bg-primary/10" data-testid="link-library-intake">
        <FileInput className="h-4 w-4" /> UPLOAD IN IMPRIMA PORTAL
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="upload-bar-embedded">
      <select
        value={uploadKind}
        onChange={(e) => setUploadKind(e.target.value as UploadKind)}
        disabled={uploading}
        className="h-9 rounded-md border border-input bg-card px-3 font-mono text-xs"
        aria-label="Upload document kind"
        data-testid="select-upload-kind"
      >
        <option value="SPC">SPC</option>
        <option value="MA">MA</option>
        <option value="MPDD">MPDD</option>
        <option value="PDD">PDD</option>
      </select>
      <input ref={fileRef} type="file" className="hidden" multiple accept=".txt,.md,.markdown,.pdf,.docx" onChange={(e) => void uploadFiles(e.target.files)} />
      <input
        ref={folderRef}
        type="file"
        className="hidden"
        multiple
        accept=".txt,.md,.markdown,.pdf,.docx"
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
        onChange={(e) => void uploadFiles(e.target.files)}
      />
      <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="font-display tracking-wider" data-testid="button-upload-file">
        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
        UPLOAD {uploadKind}
      </Button>
      <Button onClick={() => folderRef.current?.click()} disabled={uploading} variant="outline" className="font-display tracking-wider" data-testid="button-upload-folder">
        <FolderUp className="mr-2 h-4 w-4" /> UPLOAD FOLDER
      </Button>
    </div>
  );
}
