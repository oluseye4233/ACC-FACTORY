import { Link } from "wouter";
import { Lightbulb, X } from "lucide-react";
import { useState } from "react";

interface Props {
  /** Persist dismissal per-session + per-placement so it stays quiet once closed. */
  dismissKey: string;
  headline: string;
  body: string;
}

/**
 * Proactive F0 advisory nudge. F0 is a boutique consulting side-step OUTSIDE the
 * F1–F9 production floor, so this is a soft prompt (never a gate): shown before
 * F1 (frame the idea) and after F7/F8 (pressure-test before shipping). It links
 * to the F0 advisory layer and can be dismissed.
 */
export function F0AdvisoryPrompt({ dismissKey, headline, body }: Props) {
  const storageKey = `f0-advisory-dismissed:${dismissKey}`;
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <div
      data-testid="f0-advisory-prompt"
      className="mb-4 flex items-start gap-3 rounded-lg border border-secondary/40 bg-secondary/10 p-4"
    >
      <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
      <div className="flex-1">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-secondary">
          {headline}
        </p>
        <p className="mt-1 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {body}
        </p>
        <Link
          href="/f0"
          className="mt-2 inline-block font-mono text-[11px] font-bold text-secondary underline hover:opacity-80"
          data-testid="f0-advisory-link"
        >
          OPEN F0 ADVISORY →
        </Link>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss advisory prompt"
        data-testid="f0-advisory-dismiss"
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
