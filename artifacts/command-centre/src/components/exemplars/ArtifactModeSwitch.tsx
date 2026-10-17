import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateExemplarVisibility } from "@workspace/api-client-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/catalog/ConfirmDialog";
import { CatalogStatusBadge } from "@/components/catalog/CatalogStatusBadge";
import { discoveryStatus, errorMessage, isCurated, isSphinx, type CatalogItem } from "@/lib/catalog";
import { invalidateCatalog } from "./invalidate";

type Pending = null | "optin" | "archive";

export function ArtifactModeSwitch({
  item,
  publicOpen,
  compact,
}: {
  item: CatalogItem;
  publicOpen: boolean | undefined;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const mutation = useUpdateExemplarVisibility();
  const [confirm, setConfirm] = useState<Pending>(null);
  const sphinx = isSphinx(item);
  const archived = item.active === false;

  // Non-owners and curated platform references: status only, never controls.
  if (!item.isOwner || isCurated(item)) {
    return (
      <div className="flex flex-wrap items-center gap-2" data-testid={`status-mode-${item.id}`}>
        <CatalogStatusBadge status={discoveryStatus(item, publicOpen)} />
        {isCurated(item) && item.isOwner !== undefined && (
          <span className="font-mono text-[10px] text-muted-foreground">Curated platform reference - not opt-in</span>
        )}
      </div>
    );
  }

  const run = async (data: { active?: boolean; artifactMode?: "LIBRARY_ARTIFACT" | "SPHINX_ARTIFACT"; commercialConsent?: boolean }, ok: string) => {
    try {
      await mutation.mutateAsync({ id: item.id, data });
      await invalidateCatalog(qc, item.id);
      toast({ title: ok });
      setConfirm(null);
    } catch (e) {
      toast({ title: "Update failed", description: errorMessage(e), variant: "destructive" });
    }
  };

  const eligible = !!item.eligibility?.eligible;
  const canToggle = !archived && (sphinx || (eligible && publicOpen !== undefined));
  const reasons = [
    ...(item.eligibility?.reasons ?? []),
    ...(publicOpen === undefined && !sphinx ? ["Catalog status is unavailable. Wait for it to load before opting in."] : []),
  ];

  if (archived) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <CatalogStatusBadge status={discoveryStatus(item, publicOpen)} />
        <Button
          size="sm"
          variant="outline"
          className="h-7 font-mono text-[10px]"
          disabled={mutation.isPending}
          onClick={() => void run({ active: true }, "Artifact reactivated in library")}
          data-testid={`button-reactivate-${item.id}`}
        >
          Reactivate
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase">
          <span className={!sphinx ? "font-bold" : "text-muted-foreground"}>Library artifact</span>
          <Switch
            checked={sphinx}
            disabled={!canToggle || mutation.isPending}
            onCheckedChange={(next) => {
              if (next) setConfirm("optin");
              else void run({ artifactMode: "LIBRARY_ARTIFACT" }, "Returned to library only. Public entry removed.");
            }}
            aria-label="Select for Sphinx marketplace"
            data-testid={`switch-sphinx-${item.id}`}
          />
          <span className={sphinx ? "font-bold text-primary" : "text-muted-foreground"}>Sphinx artifact</span>
        </label>
        <CatalogStatusBadge status={discoveryStatus(item, publicOpen)} />
        {!compact && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 font-mono text-[10px] text-muted-foreground"
            onClick={() => setConfirm("archive")}
            data-testid={`button-archive-${item.id}`}
          >
            Archive
          </Button>
        )}
      </div>
      {!eligible && !sphinx && (
        <ul className="space-y-0.5 font-mono text-[10px] text-muted-foreground" data-testid={`text-ineligible-${item.id}`}>
          {(reasons.length ? reasons : ["Awaiting internal qualification review."]).slice(0, compact ? 1 : 6).map((r) => (
            <li key={r}>- {r}</li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={confirm === "optin"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Select for Sphinx"
        confirmLabel="I consent - select for Sphinx"
        pending={mutation.isPending}
        onConfirm={() =>
          void run(
            { artifactMode: "SPHINX_ARTIFACT", commercialConsent: true },
            publicOpen ? "Metadata is now publicly discoverable" : "Queued for Sphinx launch",
          )
        }
      >
        <p>
          {publicOpen
            ? "Sphinx discovery is open. This artifact's metadata (title, tagline, kind, JCSE, class, SKU) becomes publicly discoverable immediately."
            : "Sphinx discovery is currently closed. This artifact's metadata will become publicly discoverable at the future launch, without further action from you."}
        </p>
        <p>The full body is never published. Commerce and checkout are not activated; no payments are taken.</p>
        <p>You can switch back to Library at any time to remove the public entry.</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === "archive"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Archive artifact"
        confirmLabel="Archive"
        pending={mutation.isPending}
        onConfirm={() => void run({ active: false }, "Archived. Reset to library; public entry removed.")}
      >
        <p>Archiving resets this artifact to Library mode and removes any public Sphinx entry. You can reactivate it later.</p>
      </ConfirmDialog>
    </div>
  );
}
