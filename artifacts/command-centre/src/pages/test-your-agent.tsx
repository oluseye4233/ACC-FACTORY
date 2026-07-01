import { useState } from "react";
import { useLocation } from "wouter";
import { useMagnetTestKit, useMagnetConversion } from "@workspace/api-client-react";
import type { MagnetTestKitResult } from "@workspace/api-client-react";
import { ApiError } from "@/lib/api";
import { MagnetLayout, ConversionCta } from "@/components/MagnetLayout";

const BAND_COPY: Record<
  MagnetTestKitResult["band"],
  { label: string; blurb: string; className: string }
> = {
  "LITE-PASS": {
    label: "LITE-PASS",
    blurb: "Solid foundation — your instruction is clear and well-structured.",
    className: "border-[#1A6B3A]/50 bg-[#1A6B3A]/10 text-[#7ED9A0]",
  },
  "LITE-REVIEW": {
    label: "LITE-REVIEW",
    blurb: "Workable, but there are real gaps worth tightening before you ship.",
    className: "border-[#C8A200]/50 bg-[#C8A200]/10 text-[#E9CE5A]",
  },
  "LITE-FAIL": {
    label: "LITE-FAIL",
    blurb: "Needs work — key pieces are missing that will hurt reliability.",
    className: "border-[#DF1A12]/50 bg-[#DF1A12]/10 text-[#F08A85]",
  },
};

export default function TestYourAgent() {
  const [, setLocation] = useLocation();
  const [prompt, setPrompt] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<MagnetTestKitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const testKit = useMagnetTestKit();
  const conversion = useMagnetConversion();

  const run = () => {
    setError(null);
    setResult(null);
    testKit.mutate(
      { data: { prompt: prompt.trim(), email: email.trim() || null } },
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

  const band = result ? BAND_COPY[result.band] : null;

  return (
    <MagnetLayout
      eyebrow="Free · No sign-up"
      title="Test Your Agent"
      subtitle="Paste any AI prompt or agent instruction and get an instant quality read. A free lite preview of the ATANDA Prompt Diagnostic — no numbers, just a clear verdict and the highest-leverage fixes."
    >
      <div className="rounded-xl border border-[#262626] bg-[#121212] p-6">
        <label
          htmlFor="magnet-prompt"
          className="block text-xs font-mono font-bold uppercase text-[#f2f2f2]"
        >
          Your prompt or agent instruction
        </label>
        <textarea
          id="magnet-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={8}
          maxLength={20000}
          placeholder="Paste the full prompt you want to test…"
          className="mt-2 w-full resize-y rounded border border-[#262626] bg-[#0D0D0D] px-3 py-2 font-mono text-sm text-[#f2f2f2] outline-none focus:border-[#1A6B3A]"
          data-testid="input-magnet-prompt"
        />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex-1">
            <label
              htmlFor="magnet-email"
              className="block text-xs font-mono uppercase text-[#999999]"
            >
              Email (optional)
            </label>
            <input
              id="magnet-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="mt-1 w-full rounded border border-[#262626] bg-[#0D0D0D] px-3 py-2 font-mono text-sm text-[#f2f2f2] outline-none focus:border-[#1A6B3A]"
              data-testid="input-magnet-email"
            />
          </div>
          <button
            type="button"
            onClick={run}
            disabled={testKit.isPending || prompt.trim().length < 10}
            className="inline-flex h-11 items-center justify-center rounded bg-[#1A6B3A] px-6 font-display tracking-wider text-white transition-colors hover:bg-[#1A6B3A]/90 disabled:opacity-60"
            data-testid="button-magnet-run"
          >
            {testKit.isPending ? "TESTING…" : "TEST MY AGENT"}
          </button>
        </div>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-[#666666]">
          5 free checks per hour · your text is analysed, never stored
        </p>
      </div>

      {error ? (
        <p
          className="mt-6 rounded border border-[#DF1A12]/30 bg-[#DF1A12]/10 px-4 py-3 font-mono text-sm text-[#F08A85]"
          data-testid="text-magnet-error"
        >
          {error}
        </p>
      ) : null}

      {result && band ? (
        <div className="mt-8" data-testid="result-magnet-testkit">
          <div className={`rounded-xl border p-6 ${band.className}`}>
            <p className="font-mono text-xs uppercase tracking-[0.3em] opacity-80">Verdict</p>
            <p className="mt-1 font-display text-4xl tracking-wider" data-testid="text-magnet-band">
              {band.label}
            </p>
            <p className="mt-2 font-mono text-sm">{band.blurb}</p>
            <p className="mt-4 font-mono text-sm text-[#f2f2f2]">{result.headline}</p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {result.dimensions.map((d) => (
              <div key={d.name} className="rounded-lg border border-[#262626] bg-[#121212] p-4">
                <p className="font-mono text-xs uppercase tracking-wider text-[#1A6B3A]">{d.name}</p>
                <p className="mt-2 font-mono text-xs text-[#cccccc]">{d.note}</p>
              </div>
            ))}
          </div>

          {result.strengths.length > 0 ? (
            <div className="mt-6">
              <p className="font-mono text-xs uppercase tracking-wider text-[#999999]">Strengths</p>
              <ul className="mt-2 space-y-1">
                {result.strengths.map((s, i) => (
                  <li key={i} className="font-mono text-sm text-[#cccccc]">
                    <span className="text-[#1A6B3A]">+ </span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.fixes.length > 0 ? (
            <div className="mt-6">
              <p className="font-mono text-xs uppercase tracking-wider text-[#999999]">
                Highest-leverage fixes
              </p>
              <ul className="mt-2 space-y-1">
                {result.fixes.map((f, i) => (
                  <li key={i} className="font-mono text-sm text-[#cccccc]">
                    <span className="text-[#C8A200]">→ </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <ConversionCta onConvert={convert} pending={conversion.isPending} />
        </div>
      ) : null}
    </MagnetLayout>
  );
}
