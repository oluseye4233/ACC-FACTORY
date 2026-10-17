import { Link } from "wouter";
import { ExternalLink, Library } from "lucide-react";

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
  /** Retained for caller compatibility; direct publishing is gated by library qualification. */
  onPublished?: (listing: SphinxListing) => void;
}

/**
 * Sphinx selection now happens in the Exemplar Library after internal
 * qualification. This component only directs users there (no bypass).
 */
export function PublishToSphinxButton({ artifactType, existing }: Props) {
  if (artifactType !== "SPC") return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {existing?.listingUrl && (
        <a
          href={existing.listingUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
          data-testid="sphinx-listing-link"
        >
          <ExternalLink className="h-3 w-3" />
          View on Sphinx
        </a>
      )}
      <Link
        href="/exemplars"
        className="inline-flex h-8 items-center gap-1 rounded-md border px-3 font-mono text-xs hover:bg-muted"
        data-testid="sphinx-qualify-link"
        title="Qualify and select artifacts for Sphinx in the Exemplar Library"
      >
        <Library className="h-3 w-3" />
        QUALIFY FOR SPHINX IN LIBRARY
      </Link>
    </div>
  );
}
