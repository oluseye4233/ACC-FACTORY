import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateSphinxMarketplaceStatus, type SphinxMarketplaceStatus } from "@workspace/api-client-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/catalog/ConfirmDialog";
import { errorMessage } from "@/lib/catalog";
import { invalidateCatalog } from "./invalidate";

export function MarketplaceLaunchControl({ status, sphinxCount }: { status: SphinxMarketplaceStatus; sphinxCount: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const mutation = useUpdateSphinxMarketplaceStatus();
  const [target, setTarget] = useState<boolean | null>(null);

  if (!status.canManage) return null;

  const apply = async () => {
    if (target === null) return;
    try {
      await mutation.mutateAsync({ data: { publicOpen: target } });
      await invalidateCatalog(qc);
      toast({ title: target ? "Sphinx discovery opened" : "Sphinx discovery closed" });
      setTarget(null);
    } catch (e) {
      toast({ title: "Launch control failed", description: errorMessage(e), variant: "destructive" });
    }
  };

  return (
    <section className="rounded-md border border-secondary/50 bg-secondary/5 p-3" data-testid="panel-launch-control">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[hsl(40_70%_30%)]">Admin · global discovery launch</p>
          <p className="text-xs text-muted-foreground">
            Policy {status.policyVersion}. {sphinxCount} artifact{sphinxCount === 1 ? "" : "s"} selected for Sphinx.
          </p>
        </div>
        <label className="flex items-center gap-2 font-mono text-xs">
          {status.publicOpen ? "Public catalog open" : "Public catalog closed"}
          <Switch
            checked={status.publicOpen}
            disabled={mutation.isPending}
            onCheckedChange={(v) => setTarget(v)}
            aria-label="Public Sphinx discovery"
            data-testid="switch-public-open"
          />
        </label>
      </div>
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title={target ? "Open public Sphinx discovery" : "Close public Sphinx discovery"}
        confirmLabel={target ? "Open discovery" : "Close discovery"}
        pending={mutation.isPending}
        onConfirm={() => void apply()}
      >
        {target ? (
          <>
            <p>All owner-opted-in, review-approved artifacts become publicly discoverable at /sphinx as metadata only.</p>
            <p>Payments and checkout do not activate. No full bodies or owner data are exposed.</p>
          </>
        ) : (
          <p>The public /sphinx catalog will stop listing artifacts. Owner selections are kept and queued for the next launch.</p>
        )}
      </ConfirmDialog>
    </section>
  );
}
