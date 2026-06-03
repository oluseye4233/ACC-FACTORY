import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { F1000_PENDING_KEY, type F1000RedeemResult } from "@/lib/f1000";

/**
 * Mounted globally: after a user authenticates following a QR/sign-up claim,
 * bind the stashed F1000 invite code to their account. Runs once per sign-in.
 */
export function F1000Redeemer() {
  const { isSignedIn } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const attempted = useRef(false);

  useEffect(() => {
    if (!isSignedIn || attempted.current) return;
    const code = localStorage.getItem(F1000_PENDING_KEY);
    if (!code) return;
    attempted.current = true;

    (async () => {
      try {
        const res = await api.post<F1000RedeemResult>("/api/f1000/redeem", {
          code,
        });
        localStorage.removeItem(F1000_PENDING_KEY);
        queryClient.invalidateQueries();
        if (!res.alreadyRedeemed) {
          toast({
            title: `Founding seat #${res.seq} secured`,
            description:
              "Your $10/mo Practitioner offer is active — choose it at checkout.",
          });
        }
      } catch {
        // Invalid/expired code: drop it silently so we don't loop on retry.
        localStorage.removeItem(F1000_PENDING_KEY);
      }
    })();
  }, [isSignedIn, toast, queryClient]);

  return null;
}
