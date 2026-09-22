import { Link } from "wouter";
import { PlaySquare, X } from "lucide-react";
import { useState } from "react";

interface Props {
  /** Persist dismissal per-session + per-placement so it stays quiet once closed. */
  dismissKey: string;
  sessionId: string;
}

/**
 * Proactive SPC Player advisory nudge. Links to the pre-build SPC Player
 * which is an optional side-step for testing capability combinations.
 */
export function SpcPlayerAdvisoryPrompt({ dismissKey, sessionId }: Props) {
  const storageKey = `spc-player-advisory-dismissed:${dismissKey}`;
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
      data-testid="spc-player-advisory-prompt"
      className="mb-4 flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/10 p-4"
    >
      <PlaySquare className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div className="flex-1">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
          OPTIONAL PRE-BUILD: SPC PLAYER
        </p>
        <p className="mt-1 font-mono text-[11px] leading-relaxed text-muted-foreground">
          Want to test capability combinations before committing them to the forge? Assemble a Kit Deck of up to 12 SPCs and execute a dry run. This side-step does not advance F-stages or consume your primary artifact.
        </p>
        <Link
          href={`/spc-player/new?sourceSessionId=${sessionId}`}
          className="mt-2 inline-block font-mono text-[11px] font-bold text-primary underline hover:opacity-80"
          data-testid="spc-player-advisory-link"
        >
          OPEN SPC PLAYER →
        </Link>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss advisory prompt"
        data-testid="spc-player-advisory-dismiss"
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}