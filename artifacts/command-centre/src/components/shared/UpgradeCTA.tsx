import { useEffect, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";

interface UpgradeCTAProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message?: string;
  /** True when the dialog was triggered by a 402 cost-cap, not a tier gate. */
  costCap?: boolean;
}

type MeResult = {
  subscriber: { f1000Member: boolean; tier: string };
};

export function UpgradeCTA({
  open,
  onOpenChange,
  message = "This feature requires a higher tier.",
  costCap = false,
}: UpgradeCTAProps) {
  const [, setLocation] = useLocation();
  const [onRamp, setOnRamp] = useState(false);
  const [busy, setBusy] = useState(false);

  // When opened, check whether this is an F1000 Practitioner who has hit their
  // $49 usage cap — if so, offer the one-click Architect on-ramp.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api
      .get<MeResult>("/api/me")
      .then((me) => {
        if (cancelled) return;
        setOnRamp(
          me.subscriber.f1000Member && me.subscriber.tier === "PRACTITIONER",
        );
      })
      .catch(() => {
        if (!cancelled) setOnRamp(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const upgradeToArchitect = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ url: string }>("/api/billing/checkout", {
        tier: "ARCHITECT",
        interval: "month",
      });
      if (res.url) window.location.href = res.url;
    } catch {
      setBusy(false);
      setLocation("/pricing");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-secondary/20 bg-background/95 backdrop-blur">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-2xl tracking-wider text-secondary">
            {costCap ? "USAGE BUDGET REACHED" : "AUTHORIZATION REQUIRED"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-foreground">
            {costCap && onRamp
              ? "You've used your $49 F1000 AI-usage budget. Upgrade to ARCHITECT to keep building — the cap lifts immediately. You'll confirm the change on Stripe before any charge."
              : onRamp
                ? "This needs ARCHITECT. As a First-1000 member you can upgrade in one click — you'll confirm on Stripe before any charge."
                : message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="font-mono">CANCEL</AlertDialogCancel>
          {onRamp ? (
            <Button
              onClick={upgradeToArchitect}
              disabled={busy}
              className="font-display tracking-wider bg-secondary text-secondary-foreground hover:bg-secondary/90"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  REDIRECTING…
                </>
              ) : (
                "UPGRADE TO ARCHITECT"
              )}
            </Button>
          ) : (
            <AlertDialogAction
              onClick={() => setLocation("/pricing")}
              className="font-display tracking-wider bg-secondary text-secondary-foreground hover:bg-secondary/90"
            >
              UPGRADE ACCESS
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
