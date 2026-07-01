import { useState } from "react";
import { useLocation } from "wouter";
import { useMagnetCalculator, useMagnetConversion } from "@workspace/api-client-react";
import type { MagnetCalculatorResult } from "@workspace/api-client-react";
import { ApiError } from "@/lib/api";
import { MagnetLayout, ConversionCta } from "@/components/MagnetLayout";

const CLASS_COPY: Record<MagnetCalculatorResult["compressionClass"], string> = {
  LOW: "Already lean — a little headroom to tighten.",
  MEDIUM: "Meaningful compression available without losing intent.",
  HIGH: "Substantial redundancy and compound logic to unpack.",
  EXTREME: "Heavily compoundable — big gains from atomising this spec.",
};

export default function CalculateYourSavings() {
  const [, setLocation] = useLocation();
  const [artifact, setArtifact] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<MagnetCalculatorResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculator = useMagnetCalculator();
  const conversion = useMagnetConversion();

  const run = () => {
    setError(null);
    setResult(null);
    calculator.mutate(
      { data: { artifact: artifact.trim(), email: email.trim() || null } },
      {
        onSuccess: (data) => setResult(data),
        onError: (err) => {
          const msg =
            err instanceof ApiError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Something went wrong. Please try again.";
          setError(msg);
        },
      },
    );
  };

  const convert = () => {
    if (!result) return;
    conversion.mutate(
      { data: { magnetSessionId: result.magnetSessionId } },
      {
        onSettled: () => setLocation("/command"),
      },
    );
  };

  return (
    <MagnetLayout
      eyebrow="Free · No sign-up"
      title="Calculate Your Savings"
      subtitle="Paste a prompt or spec and see how much shorter it could be. A free lite preview of the HARNESS compression pass — we return an honest savings range, never a fake precise number."
    >
      <div className="rounded-xl border border-[#262626] bg-[#121212] p-6">
        <label
          htmlFor="magnet-artifact"
          className="block text-xs font-mono font-bold uppercase text-[#f2f2f2]"
        >
          Your prompt or spec
        </label>
        <textarea
          id="magnet-artifact"
          value={artifact}
          onChange={(e) => setArtifact(e.target.value)}
          rows={8}
          maxLength={20000}
          placeholder="Paste the prompt or specification you want to compress…"
          className="mt-2 w-full resize-y rounded border border-[#262626] bg-[#0D0D0D] px-3 py-2 font-mono text-sm text-[#f2f2f2] outline-none focus:border-[#1A6B3A]"
          data-testid="input-magnet-artifact"
        />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex-1">
            <label
              htmlFor="magnet-calc-email"
              className="block text-xs font-mono uppercase text-[#999999]"
            >
              Email (optional)
            </label>
            <input
              id="magnet-calc-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="mt-1 w-full rounded border border-[#262626] bg-[#0D0D0D] px-3 py-2 font-mono text-sm text-[#f2f2f2] outline-none focus:border-[#1A6B3A]"
              data-testid="input-magnet-calc-email"
            />
          </div>
          <button
            type="button"
            onClick={run}
            disabled={calculator.isPending || artifact.trim().length < 10}
            className="inline-flex h-11 items-center justify-center rounded bg-[#1A6B3A] px-6 font-display tracking-wider text-white transition-colors hover:bg-[#1A6B3A]/90 disabled:opacity-60"
            data-testid="button-magnet-calc-run"
          >
            {calculator.isPending ? "CALCULATING…" : "CALCULATE SAVINGS"}
          </button>
        </div>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-[#666666]">
          5 free checks per hour · your text is analysed, never stored
        </p>
      </div>

      {error ? (
        <p
          className="mt-6 rounded border border-[#DF1A12]/30 bg-[#DF1A12]/10 px-4 py-3 font-mono text-sm text-[#F08A85]"
          data-testid="text-magnet-calc-error"
        >
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-8" data-testid="result-magnet-calculator">
          <div className="rounded-xl border border-[#1A6B3A]/50 bg-[#1A6B3A]/10 p-6 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#7ED9A0]">
              Estimated compression savings
            </p>
            <p
              className="mt-2 font-display text-5xl tracking-wider text-[#f2f2f2]"
              data-testid="text-magnet-range"
            >
              {result.savingsLowPct}–{result.savingsHighPct}%
            </p>
            <p className="mt-3 font-mono text-sm text-[#cccccc]">
              {CLASS_COPY[result.compressionClass]}
            </p>
          </div>

          <div className="mt-6 rounded-lg border border-[#262626] bg-[#121212] p-5">
            <p className="font-mono text-sm text-[#f2f2f2]">{result.headline}</p>
            <p className="mt-3 font-mono text-xs leading-relaxed text-[#999999]">
              {result.rationale}
            </p>
          </div>

          <ConversionCta onConvert={convert} pending={conversion.isPending} />
        </div>
      ) : null}
    </MagnetLayout>
  );
}
