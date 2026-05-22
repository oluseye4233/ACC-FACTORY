import { useState } from "react";
import { Redirect } from "wouter";
import { TopNav } from "@/components/layout/TopNav";
import {
  useGetMe,
  useAdminListBadgeRevocations,
  useAdminRevokeBadge,
  useAdminRestoreBadge,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, AlertTriangle, ChevronDown, RotateCcw } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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

const pairKey = (userId: string, badgeId: string) => `${userId}::${badgeId}`;

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

  const [restoreTarget, setRestoreTarget] = useState<{
    userId: string;
    badgeId: RevokeBadgeId;
    targetLabel: string;
  } | null>(null);
  const [restoreNote, setRestoreNote] = useState("");
  const [restoredPairs, setRestoredPairs] = useState<Set<string>>(new Set());

  const revoke = useAdminRevokeBadge();
  const restore = useAdminRestoreBadge();
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
          setRestoredPairs((prev) => {
            const next = new Set(prev);
            next.delete(pairKey(tid, badgeId));
            return next;
          });
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

  const openRestoreDialog = (
    userId: string,
    bId: RevokeBadgeId,
    targetLabel: string,
  ) => {
    setRestoreTarget({ userId, badgeId: bId, targetLabel });
    setRestoreNote("");
  };

  const closeRestoreDialog = () => {
    if (restore.isPending) return;
    setRestoreTarget(null);
    setRestoreNote("");
  };

  const handleRestoreConfirm = () => {
    if (!restoreTarget) return;
    const note = restoreNote.trim();
    const { userId, badgeId: bId } = restoreTarget;
    restore.mutate(
      {
        data: {
          userId,
          badgeId: bId,
          ...(note.length > 0 ? { note } : {}),
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Badge restored",
            description: `${bId} reinstated for ${restoreTarget.targetLabel}.`,
          });
          setRestoredPairs((prev) => {
            const next = new Set(prev);
            next.add(pairKey(userId, bId));
            return next;
          });
          setRestoreTarget(null);
          setRestoreNote("");
          void refetch();
        },
        onError: (err) => {
          const data = (err as { data?: { error?: string; status?: string } })
            ?.data;
          // If already restored / not currently revoked, mark as restored locally so the UI reflects it.
          if (data?.status && data.status !== "REVOKED") {
            setRestoredPairs((prev) => {
              const next = new Set(prev);
              next.add(pairKey(userId, bId));
              return next;
            });
          }
          toast({
            title: "Restore failed",
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

                  {preview.history.length > 0 && (
                    <Collapsible data-testid="history-collapsible">
                      <CollapsibleTrigger
                        className="flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-muted-foreground hover-elevate active-elevate-2 rounded px-2 py-1 -mx-2 [&[data-state=open]>svg]:rotate-180"
                        data-testid="button-toggle-history"
                      >
                        <ChevronDown className="w-3 h-3 transition-transform" />
                        <span>
                          View full history ({preview.history.length})
                        </span>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <ol
                          className="mt-2 max-h-64 overflow-y-auto border border-border rounded divide-y divide-border"
                          data-testid="history-list"
                        >
                          {preview.history
                            .slice()
                            .reverse()
                            .map((entry, idx) => {
                              const seq = preview.history.length - idx;
                              return (
                                <li
                                  key={`${entry.revokedAt}-${idx}`}
                                  className="p-3 space-y-1"
                                  data-testid={`history-entry-${seq}`}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                                    <span className="text-primary font-semibold">
                                      #{seq}
                                    </span>
                                    <span className="text-muted-foreground">
                                      {new Date(entry.revokedAt)
                                        .toISOString()
                                        .replace("T", " ")
                                        .slice(0, 19)}
                                      Z
                                    </span>
                                  </div>
                                  {entry.revokedByUserId && (
                                    <div className="font-mono text-xs">
                                      <span className="text-muted-foreground">
                                        by admin:{" "}
                                      </span>
                                      {entry.revokedByUserId.slice(0, 8)}…
                                    </div>
                                  )}
                                  <div className="font-mono text-xs whitespace-pre-wrap">
                                    <span className="text-muted-foreground">
                                      reason:{" "}
                                    </span>
                                    {entry.reason}
                                  </div>
                                </li>
                              );
                            })}
                        </ol>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

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
                {revocations.map((r) => {
                  const isRestored = restoredPairs.has(
                    pairKey(r.target.userId, r.badgeId),
                  );
                  const targetLabel = partyLabel(r.target);
                  return (
                    <div
                      key={r.id}
                      className={`border border-border rounded p-3 space-y-1 ${
                        isRestored ? "opacity-60" : ""
                      }`}
                      data-testid={`revocation-${r.id}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs uppercase text-primary">
                            {r.badgeId}
                          </span>
                          {isRestored && (
                            <span
                              className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/30"
                              data-testid={`badge-restored-${r.id}`}
                            >
                              RESTORED
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs text-muted-foreground">
                            {new Date(r.revokedAt)
                              .toISOString()
                              .replace("T", " ")
                              .slice(0, 19)}
                            Z
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isRestored || restore.isPending}
                            onClick={() =>
                              openRestoreDialog(
                                r.target.userId,
                                r.badgeId as RevokeBadgeId,
                                targetLabel,
                              )
                            }
                            data-testid={`button-restore-${r.id}`}
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            {isRestored ? "RESTORED" : "RESTORE"}
                          </Button>
                        </div>
                      </div>
                      <div className="font-mono text-xs">
                        <span className="text-muted-foreground">target: </span>
                        {targetLabel}
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
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog
        open={restoreTarget !== null}
        onOpenChange={(open) => {
          if (!open) closeRestoreDialog();
        }}
      >
        <DialogContent data-testid="dialog-restore-badge">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wider">
              RESTORE BADGE
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              Reinstate{" "}
              <span className="text-foreground">{restoreTarget?.badgeId}</span>{" "}
              for{" "}
              <span className="text-foreground">
                {restoreTarget?.targetLabel}
              </span>
              . The revocation audit trail is preserved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="restore-note" className="font-mono text-xs">
              NOTE (optional, max 1000 chars)
            </Label>
            <Textarea
              id="restore-note"
              value={restoreNote}
              onChange={(e) => setRestoreNote(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Optional note shown to the user when their badge is restored…"
              data-testid="input-restore-note"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeRestoreDialog}
              disabled={restore.isPending}
              data-testid="button-restore-cancel"
            >
              CANCEL
            </Button>
            <Button
              onClick={handleRestoreConfirm}
              disabled={restore.isPending}
              data-testid="button-restore-confirm"
            >
              {restore.isPending ? "RESTORING…" : "CONFIRM RESTORE"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
