import { useState } from "react";
import { Redirect } from "wouter";
import { TopNav } from "@/components/layout/TopNav";
import {
  useGetMe,
  useAdminListBadgeRevocations,
  useAdminRevokeBadge,
  adminPreviewBadgeRevocation,
} from "@workspace/api-client-react";
import type { AdminBadgeRevocationPreview } from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, AlertTriangle } from "lucide-react";

type RevokeBadgeId = "AISE" | "AISE_BUILD";

function partyLabel(p: {
  userId: string;
  email?: string | null;
  displayName?: string | null;
}): string {
  if (p.displayName && p.displayName.trim().length > 0) {
    return `${p.displayName} (${p.email ?? p.userId.slice(0, 8)})`;
  }
  if (p.email) return p.email;
  return p.userId;
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export default function AdminBadges() {
  const { data: me, isLoading: isLoadingMe } = useGetMe();
  const { toast } = useToast();

  const [targetUserId, setTargetUserId] = useState("");
  const [badgeId, setBadgeId] = useState<RevokeBadgeId>("AISE");
  const [reason, setReason] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [preview, setPreview] = useState<AdminBadgeRevocationPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [repeatAck, setRepeatAck] = useState(false);

  const revoke = useAdminRevokeBadge();
  const {
    data: revocationsData,
    isLoading: isLoadingRevs,
    refetch,
  } = useAdminListBadgeRevocations(
    { limit: 100 },
    {
      query: {
        enabled: me?.role === "ADMIN",
        queryKey: ["/admin/badges/revocations", { limit: 100 }] as const,
      },
    },
  );

  if (isLoadingMe) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <TopNav />
        <main className="flex-1 container py-8 px-4 md:px-6 max-w-5xl">
          <Skeleton className="h-32 w-full" />
        </main>
      </div>
    );
  }

  if (!me || me.role !== "ADMIN") {
    return <Redirect to="/command" />;
  }

  const openConfirm = async () => {
    const tid = targetUserId.trim();
    const r = reason.trim();
    if (tid.length === 0) {
      toast({ title: "User ID required", variant: "destructive" });
      return;
    }
    if (r.length === 0) {
      toast({ title: "Reason required", variant: "destructive" });
      return;
    }

    setPreview(null);
    setPreviewError(null);
    setRepeatAck(false);
    setConfirmOpen(true);
    setPreviewLoading(true);

    try {
      const data = await adminPreviewBadgeRevocation({ userId: tid, badgeId });
      setPreview(data);
    } catch (err) {
      const e = err as { data?: { error?: string }; status?: number };
      setPreviewError(e?.data?.error ?? "Could not load prior revocation history.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const doRevoke = () => {
    const tid = targetUserId.trim();
    const r = reason.trim();
    revoke.mutate(
      { data: { userId: tid, badgeId, reason: r } },
      {
        onSuccess: (result) => {
          toast({
            title: "Badge revoked",
            description: `${badgeId} removed for ${tid.slice(0, 8)}… (revocation #${result.revocationCount})`,
          });
          setReason("");
          setConfirmOpen(false);
          setPreview(null);
          setRepeatAck(false);
          void refetch();
        },
        onError: (err) => {
          const data = (err as { data?: { error?: string } })?.data;
          toast({
            title: "Revoke failed",
            description: data?.error ?? "Try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const revocations = revocationsData?.revocations ?? [];

  const priorCount = preview?.revocationCount ?? 0;
  const isRepeat = priorCount >= 2;
  const nextCount = priorCount + 1;
  const confirmDisabled =
    previewLoading ||
    !!previewError ||
    revoke.isPending ||
    (isRepeat && !repeatAck);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav />
      <main className="flex-1 container py-8 px-4 md:px-6 max-w-5xl">
        <div className="mb-8">
          <h1 className="font-display text-4xl tracking-wider mb-2 flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-destructive" />
            BADGE REVOCATIONS
          </h1>
          <p className="text-muted-foreground font-mono text-sm">
            Admin-only console for revoking AISE / AISE_BUILD badges and
            reviewing the audit trail.
          </p>
        </div>

        <Card className="mb-8" data-testid="card-revoke-form">
          <CardHeader>
            <CardTitle className="font-display tracking-wider">
              REVOKE A BADGE
            </CardTitle>
            <CardDescription className="font-mono">
              Deletes the badge row and writes an audit entry.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="target-user" className="font-mono text-xs">
                TARGET USER ID (UUID)
              </Label>
              <Input
                id="target-user"
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                className="font-mono"
                data-testid="input-target-user"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-mono text-xs">BADGE</Label>
              <Select
                value={badgeId}
                onValueChange={(v) => setBadgeId(v as RevokeBadgeId)}
              >
                <SelectTrigger data-testid="select-badge">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AISE">AISE</SelectItem>
                  <SelectItem value="AISE_BUILD">AISE_BUILD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason" className="font-mono text-xs">
                REASON (required, max 1000 chars)
              </Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Explain why this badge is being revoked…"
                data-testid="input-reason"
              />
            </div>
            <Button
              variant="destructive"
              onClick={openConfirm}
              disabled={revoke.isPending}
              data-testid="button-revoke"
            >
              {revoke.isPending ? "REVOKING…" : "REVOKE BADGE"}
            </Button>
          </CardContent>
        </Card>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent data-testid="dialog-revoke-confirm">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display tracking-wider">
                CONFIRM REVOKE — {badgeId}
              </AlertDialogTitle>
              <AlertDialogDescription className="font-mono text-xs">
                Review the badge's prior revocation history before confirming.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-3">
              {previewLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : previewError ? (
                <div
                  className="border border-destructive rounded p-3 font-mono text-xs text-destructive"
                  data-testid="preview-error"
                >
                  {previewError}
                </div>
              ) : preview ? (
                <>
                  <div
                    className="font-mono text-xs space-y-1"
                    data-testid="preview-summary"
                  >
                    <div>
                      <span className="text-muted-foreground">target: </span>
                      {targetUserId.slice(0, 8)}…
                    </div>
                    <div>
                      <span className="text-muted-foreground">badge row: </span>
                      {preview.badgeExists
                        ? (preview.currentStatus ?? "—")
                        : "NOT PRESENT (revoke will 404)"}
                    </div>
                    <div data-testid="preview-count">
                      <span className="text-muted-foreground">
                        prior revocations:{" "}
                      </span>
                      <span
                        className={
                          isRepeat ? "text-destructive font-semibold" : ""
                        }
                      >
                        {priorCount}
                      </span>
                    </div>
                    {preview.lastRevokedAt && (
                      <div>
                        <span className="text-muted-foreground">
                          last revoked:{" "}
                        </span>
                        {new Date(preview.lastRevokedAt)
                          .toISOString()
                          .replace("T", " ")
                          .slice(0, 19)}
                        Z
                      </div>
                    )}
                    {preview.lastReason && (
                      <div className="whitespace-pre-wrap">
                        <span className="text-muted-foreground">
                          last reason:{" "}
                        </span>
                        {preview.lastReason}
                      </div>
                    )}
                  </div>

                  {isRepeat && (
                    <div
                      className="border-2 border-destructive bg-destructive/10 rounded p-3 space-y-2"
                      data-testid="repeat-warning"
                    >
                      <div className="flex items-start gap-2 font-mono text-xs text-destructive">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                        <div>
                          <div className="font-semibold uppercase tracking-wider">
                            Repeat revocation
                          </div>
                          <div>
                            This will be the {ordinal(nextCount)} time this
                            badge has been revoked for this user. Check for a
                            pattern (repeat bad-evidence submissions, abuse)
                            before proceeding.
                          </div>
                        </div>
                      </div>
                      <label className="flex items-start gap-2 font-mono text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={repeatAck}
                          onChange={(e) => setRepeatAck(e.target.checked)}
                          className="mt-0.5"
                          data-testid="checkbox-repeat-ack"
                        />
                        <span>
                          I have reviewed the prior history and intend to revoke
                          again.
                        </span>
                      </label>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-revoke">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  if (!confirmDisabled) doRevoke();
                }}
                disabled={confirmDisabled}
                data-testid="button-confirm-revoke"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {revoke.isPending
                  ? "REVOKING…"
                  : isRepeat
                    ? `CONFIRM ${ordinal(nextCount).toUpperCase()} REVOKE`
                    : "CONFIRM REVOKE"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Card data-testid="card-revocations">
          <CardHeader>
            <CardTitle className="font-display tracking-wider">
              RECENT REVOCATIONS
            </CardTitle>
            <CardDescription className="font-mono">
              {isLoadingRevs
                ? "Loading…"
                : `${revocations.length} entr${revocations.length === 1 ? "y" : "ies"} (most recent first)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingRevs ? (
              <Skeleton className="h-24 w-full" />
            ) : revocations.length === 0 ? (
              <p className="font-mono text-sm text-muted-foreground">
                No revocations on record yet.
              </p>
            ) : (
              <div className="space-y-3">
                {revocations.map((r) => (
                  <div
                    key={r.id}
                    className="border border-border rounded p-3 space-y-1"
                    data-testid={`revocation-${r.id}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs uppercase text-primary">
                        {r.badgeId}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {new Date(r.revokedAt).toISOString().replace("T", " ").slice(0, 19)}
                        Z
                      </span>
                    </div>
                    <div className="font-mono text-xs">
                      <span className="text-muted-foreground">target: </span>
                      {partyLabel(r.target)}
                    </div>
                    <div className="font-mono text-xs">
                      <span className="text-muted-foreground">by admin: </span>
                      {partyLabel(r.admin)}
                    </div>
                    <div className="font-mono text-xs whitespace-pre-wrap">
                      <span className="text-muted-foreground">reason: </span>
                      {r.reason}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
