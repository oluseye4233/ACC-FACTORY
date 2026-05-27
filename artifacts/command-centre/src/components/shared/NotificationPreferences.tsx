import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

type Prefs = {
  organizationId: string | null;
  digestEnabled: boolean;
  billingAlertsEnabled: boolean;
  highCostAlertsEnabled: boolean;
  highCostThresholdUsd: number;
  lastDigestSentAt: string | null;
};

type Patch = {
  organizationId?: string | null;
  digestEnabled?: boolean;
  billingAlertsEnabled?: boolean;
  highCostAlertsEnabled?: boolean;
  highCostThresholdUsd?: number;
};

export function NotificationPreferences({
  orgId,
  scopeLabel,
}: {
  orgId: string | null;
  scopeLabel: string;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const queryKey = ["/api/me/notification-preferences", orgId ?? "personal"];
  const path = orgId
    ? `/api/me/notification-preferences?orgId=${encodeURIComponent(orgId)}`
    : "/api/me/notification-preferences";

  const prefsQ = useQuery({
    queryKey,
    queryFn: () => api.get<Prefs>(path),
  });

  const [threshold, setThreshold] = useState<string>("");
  useEffect(() => {
    if (prefsQ.data) {
      setThreshold(prefsQ.data.highCostThresholdUsd.toFixed(2));
    }
  }, [prefsQ.data]);

  const update = useMutation({
    mutationFn: (patch: Patch) =>
      api.patch<Prefs>("/api/me/notification-preferences", {
        organizationId: orgId,
        ...patch,
      }),
    onSuccess: (data) => {
      qc.setQueryData(queryKey, data);
      toast({ title: "Preferences updated" });
    },
    onError: (err: Error) =>
      toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  if (prefsQ.isLoading || !prefsQ.data) {
    return <Skeleton className="h-40 w-full" />;
  }

  const prefs = prefsQ.data;

  const handleThresholdSave = () => {
    const parsed = Number(threshold);
    if (!Number.isFinite(parsed) || parsed < 0.01 || parsed > 10000) {
      toast({
        title: "Invalid threshold",
        description: "Enter an amount between $0.01 and $10,000.",
        variant: "destructive",
      });
      return;
    }
    update.mutate({ highCostThresholdUsd: Number(parsed.toFixed(2)) });
  };

  return (
    <div className="space-y-6" data-testid={`notification-prefs-${orgId ?? "personal"}`}>
      <p className="text-xs font-mono text-muted-foreground">
        Scope: <strong>{scopeLabel}</strong>. Changes apply only to this scope.
      </p>

      <ToggleRow
        id={`digest-${orgId ?? "personal"}`}
        title="Weekly digest"
        description={
          orgId
            ? "Monday rollup of this organization's engine runs and billing events."
            : "Monday rollup of your personal engine runs and billing events."
        }
        checked={prefs.digestEnabled}
        disabled={update.isPending}
        onChange={(v) => update.mutate({ digestEnabled: v })}
      />

      <ToggleRow
        id={`billing-${orgId ?? "personal"}`}
        title="Billing alerts"
        description={
          orgId
            ? "Email owners and admins if a team-seat invoice fails."
            : "Email you if a personal subscription invoice fails."
        }
        checked={prefs.billingAlertsEnabled}
        disabled={update.isPending}
        onChange={(v) => update.mutate({ billingAlertsEnabled: v })}
      />

      <ToggleRow
        id={`highcost-${orgId ?? "personal"}`}
        title="High-cost alerts"
        description={
          orgId
            ? "Email you when an org-visible engine run exceeds your threshold."
            : "Not used for personal scope — high-cost alerts only fire for org-visible runs."
        }
        checked={prefs.highCostAlertsEnabled}
        disabled={update.isPending || !orgId}
        onChange={(v) => update.mutate({ highCostAlertsEnabled: v })}
      />

      <div className="space-y-2">
        <Label
          htmlFor={`threshold-${orgId ?? "personal"}`}
          className="font-mono text-xs uppercase tracking-wider"
        >
          High-cost threshold (USD)
        </Label>
        <div className="flex gap-2 items-center">
          <Input
            id={`threshold-${orgId ?? "personal"}`}
            type="number"
            min={0.01}
            max={10000}
            step={0.01}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="font-mono w-40"
            data-testid={`input-threshold-${orgId ?? "personal"}`}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleThresholdSave}
            disabled={
              update.isPending ||
              Number(threshold) === prefs.highCostThresholdUsd ||
              threshold === ""
            }
            data-testid={`button-save-threshold-${orgId ?? "personal"}`}
          >
            SAVE THRESHOLD
          </Button>
        </div>
        <p className="text-xs font-mono text-muted-foreground">
          Default is $1.00. Alerts only fire when high-cost alerts are enabled.
        </p>
      </div>

      {prefs.lastDigestSentAt && (
        <p className="text-xs font-mono text-muted-foreground">
          Last digest sent: {new Date(prefs.lastDigestSentAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function ToggleRow({
  id,
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <Label htmlFor={id} className="font-mono text-sm">
          {title}
        </Label>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        data-testid={`switch-${id}`}
      />
    </div>
  );
}
