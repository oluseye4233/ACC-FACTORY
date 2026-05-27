import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Send, ExternalLink } from "lucide-react";

interface SphinxListing {
  listingId: string | null;
  listingUrl: string | null;
  publishedAt: string;
}

interface Props {
  artifactId: string;
  artifactType: string;
  /** Existing pointer if this SPC was already published. */
  existing?: SphinxListing | null;
  onPublished?: (listing: SphinxListing) => void;
}

export function PublishToSphinxButton({
  artifactId,
  artifactType,
  existing,
  onPublished,
}: Props) {
  const [pending, setPending] = useState(false);
  const [listing, setListing] = useState<SphinxListing | null>(existing ?? null);
  const { toast } = useToast();

  if (artifactType !== "SPC") return null;

  const publish = async () => {
    setPending(true);
    try {
      const r = await api.post<{
        ok: boolean;
        listingId: string | null;
        listingUrl: string | null;
      }>("/api/integrations/sphinx/publish", { artifactId });
      const next: SphinxListing = {
        listingId: r.listingId,
        listingUrl: r.listingUrl,
        publishedAt: new Date().toISOString(),
      };
      setListing(next);
      onPublished?.(next);
      toast({
        title: listing ? "Republished to Sphinx" : "Published to Sphinx",
        description: r.listingUrl ?? r.listingId ?? "Listing created.",
      });
    } catch (e) {
      if (e instanceof ApiError) {
        const body = e.body as { code?: string } | null;
        if (body?.code === "SPHINX_NOT_CONNECTED") {
          toast({
            title: "Sphinx not connected",
            description: "Open Account → Connected Services to paste your API key.",
            variant: "destructive",
          });
          return;
        }
      }
      toast({
        title: "Publish failed",
        description: e instanceof ApiError ? e.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  };

  if (listing && listing.listingUrl) {
    return (
      <div className="flex items-center gap-2">
        <a
          href={listing.listingUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
          data-testid="sphinx-listing-link"
        >
          <ExternalLink className="h-3 w-3" />
          View on Sphinx
        </a>
        <Button
          onClick={publish}
          size="sm"
          variant="ghost"
          className="font-mono text-[10px]"
          disabled={pending}
          data-testid="sphinx-republish"
        >
          {pending ? "RE-PUBLISHING…" : "RE-PUBLISH"}
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={publish}
      size="sm"
      variant="outline"
      className="font-mono text-xs"
      disabled={pending}
      data-testid="sphinx-publish"
    >
      <Send className="h-3 w-3 mr-1" />
      {pending ? "UPLOADING…" : "UPLOAD TO SPHINX"}
    </Button>
  );
}
