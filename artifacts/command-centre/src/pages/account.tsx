import { useState } from "react";
import { useClerk } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { TopNav } from "@/components/layout/TopNav";
import {
  useGetMe,
  useUpdateMyProfile,
  useDeleteMyAccount,
} from "@workspace/api-client-react";
import { TierBadge } from "@/components/shared/TierBadge";
import { NotificationPreferences } from "@/components/shared/NotificationPreferences";
import { SphinxConnect } from "@/components/shared/SphinxConnect";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Download, Trash2, Save, AlertTriangle } from "lucide-react";

export default function Account() {
  const { data: me, isLoading } = useGetMe();
  const { signOut } = useClerk();
  const qc = useQueryClient();
  const { toast } = useToast();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const [displayName, setDisplayName] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const updateProfile = useUpdateMyProfile();
  const deleteAccount = useDeleteMyAccount();

  // Hydrate the form once when /me data arrives.
  if (me && displayName === "" && !updateProfile.isPending) {
    if (me.displayName && me.displayName.length > 0) {
      setDisplayName(me.displayName);
    }
  }

  const handleSaveProfile = () => {
    const name = displayName.trim();
    if (name.length === 0) {
      toast({ title: "Display name required", variant: "destructive" });
      return;
    }
    updateProfile.mutate(
      { data: { displayName: name } },
      {
        onSuccess: () => {
          toast({ title: "Profile updated" });
          void qc.invalidateQueries({ queryKey: ["/me"] });
        },
        onError: (err) => {
          toast({
            title: "Update failed",
            description: (err as { data?: { error?: string } })?.data?.error ?? "Try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch(`${basePath}/api/me/export`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `atanda-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Export downloaded" });
    } catch (err) {
      toast({
        title: "Export failed",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = () => {
    if (confirmPhrase !== "DELETE") {
      toast({
        title: "Confirmation required",
        description: 'Type "DELETE" to confirm permanent account deletion.',
        variant: "destructive",
      });
      return;
    }
    deleteAccount.mutate(
      { data: { confirm: "DELETE" } },
      {
        onSuccess: async () => {
          toast({
            title: "Account deleted",
            description: "All your data has been removed. Signing you out.",
          });
          qc.clear();
          await signOut({ redirectUrl: basePath || "/" });
        },
        onError: (err) => {
          toast({
            title: "Delete failed",
            description: (err as { data?: { error?: string } })?.data?.error ?? "Try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav />
      <main className="flex-1 container py-12 px-4 md:px-6 max-w-3xl">
        <div className="mb-10">
          <h1 className="font-display text-4xl tracking-wider mb-2">ACCOUNT</h1>
          <p className="text-muted-foreground font-mono text-sm">
            Operator profile, plan summary, and data controls.
          </p>
        </div>

        {isLoading || !me ? (
          <div className="space-y-6">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-44 w-full" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Profile */}
            <Card data-testid="card-profile">
              <CardHeader>
                <CardTitle className="font-display tracking-wider">PROFILE</CardTitle>
                <CardDescription className="font-mono">
                  Email comes from your sign-in provider and is changed there.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="font-mono text-xs uppercase tracking-wider">
                    Email
                  </Label>
                  <Input
                    id="email"
                    value={me.email ?? ""}
                    disabled
                    className="font-mono"
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="displayName" className="font-mono text-xs uppercase tracking-wider">
                    Display name
                  </Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={120}
                    placeholder="Operator"
                    data-testid="input-display-name"
                  />
                </div>
                <Button
                  onClick={handleSaveProfile}
                  disabled={updateProfile.isPending || displayName.trim() === (me.displayName ?? "")}
                  data-testid="button-save-profile"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateProfile.isPending ? "SAVING…" : "SAVE CHANGES"}
                </Button>
              </CardContent>
            </Card>

            {/* Plan summary */}
            <Card data-testid="card-plan">
              <CardHeader>
                <CardTitle className="font-display tracking-wider">PLAN</CardTitle>
                <CardDescription className="font-mono">
                  Manage your subscription from the Billing page.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-muted-foreground">Current tier</span>
                  <TierBadge tier={me.subscriber.tier} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-muted-foreground">Status</span>
                  <span className="font-mono text-sm" data-testid="text-sub-status">
                    {me.subscriber.status}
                  </span>
                </div>
                {me.subscriber.currentPeriodEnd && (
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-muted-foreground">Renews / ends</span>
                    <span className="font-mono text-sm">
                      {new Date(me.subscriber.currentPeriodEnd).toISOString().slice(0, 10)}
                    </span>
                  </div>
                )}
                {me.role === "ADMIN" && (
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-muted-foreground">Role</span>
                    <span className="font-mono text-sm text-primary">ADMIN</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notifications */}
            <Card data-testid="card-notifications">
              <CardHeader>
                <CardTitle className="font-display tracking-wider">NOTIFICATIONS</CardTitle>
                <CardDescription className="font-mono">
                  Control the weekly digest and billing alerts for your personal account.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <NotificationPreferences orgId={null} scopeLabel="Personal account" />
              </CardContent>
            </Card>

            {/* Connected services */}
            <Card data-testid="card-connected-services">
              <CardHeader>
                <CardTitle className="font-display tracking-wider">CONNECTED SERVICES</CardTitle>
                <CardDescription className="font-mono">
                  Link external platforms so you can publish HARNESS outputs to them
                  directly from a session.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider mb-2">
                    Ark.Onecraft Sphinx Marketplace
                  </h3>
                  <SphinxConnect />
                </div>
              </CardContent>
            </Card>

            {/* Data export */}
            <Card data-testid="card-export">
              <CardHeader>
                <CardTitle className="font-display tracking-wider">YOUR DATA</CardTitle>
                <CardDescription className="font-mono">
                  Download a JSON bundle of everything we hold on your account — profile, sessions,
                  artifacts, badges, subscriber record.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={handleExport}
                  disabled={isExporting}
                  data-testid="button-export"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {isExporting ? "PREPARING…" : "DOWNLOAD MY DATA"}
                </Button>
              </CardContent>
            </Card>

            {/* Danger zone */}
            <Card className="border-destructive/40" data-testid="card-danger">
              <CardHeader>
                <CardTitle className="font-display tracking-wider text-destructive flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  DANGER ZONE
                </CardTitle>
                <CardDescription className="font-mono">
                  Permanently delete your account, all sessions, artifacts and badges. This cannot be
                  undone.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="confirm" className="font-mono text-xs uppercase tracking-wider">
                    Type <span className="text-destructive">DELETE</span> to confirm
                  </Label>
                  <Input
                    id="confirm"
                    value={confirmPhrase}
                    onChange={(e) => setConfirmPhrase(e.target.value)}
                    placeholder="DELETE"
                    className="font-mono"
                    data-testid="input-confirm-delete"
                  />
                </div>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={confirmPhrase !== "DELETE" || deleteAccount.isPending}
                  data-testid="button-delete-account"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deleteAccount.isPending ? "DELETING…" : "DELETE MY ACCOUNT"}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
