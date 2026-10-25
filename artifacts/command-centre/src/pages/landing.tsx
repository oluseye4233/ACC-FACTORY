import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { useMarketingMeta } from "@/components/marketing/use-marketing-meta";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { FAQS } from "@/components/marketing/pricing-data";

const ENTRY = [
  { k: "01", t: "New Session", d: "Start from a brief and move through the staged engines one gate at a time." },
  { k: "02", t: "Ingestion", d: "Bring an existing design document and convert it into a structured session." },
  { k: "03", t: "Cartridge + Exemplar", d: "Scope a larger project; Exemplar references are retained and pinned across stages." },
];

const STAGES = ["F1 Diagnose", "F2-F4 Build", "F5 SPC", "F6 PDD", "F7 SPARTAN", "F8 Code"];

const STATUS: { t: string; s: "Available" | "Conditional" | "Private" | "Not fully active" | "Closed" }[] = [
  { t: "Boomerang / SPC Player remediation", s: "Available" },
  { t: "Cohort, convener and Quest", s: "Available" },
  { t: "IMPRIMA Internal / SHORT SPRINT Internal", s: "Private" },
  { t: "F10 / F11 target-specific subscription handoffs", s: "Conditional" },
  { t: "F12 and independent XVL / VTE", s: "Not fully active" },
  { t: "Sphinx", s: "Closed" },
];

export default function Landing() {
  useMarketingMeta("ATANDA Command Centre | ARK Harness", "Staged, gated prompt engineering with retained references and Boomerang remediation. Private preview with controlled access.");
  useEffect(() => {
    // A native fragment may resolve while the lazy page is still loading.
    // Restore the intended section once its actual DOM has mounted.
    const section = window.location.hash.slice(1);
    if (section === "how" || section === "workflow") {
      document.getElementById(section)?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, []);
  return (
    <MarketingShell>
      <section className="relative overflow-hidden border-b">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(hsl(var(--foreground))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--foreground))_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="relative mx-auto max-w-7xl px-4 md:px-6 py-20 md:py-28">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">ATANDA / ARK Harness / private preview</p>
          <h1 className="mt-6 max-w-6xl font-display text-[clamp(2.25rem,6.5vw,5.75rem)] leading-[1.02] [overflow-wrap:anywhere]" data-testid="text-landing-headline">
            WELCOME TO OUR GOVERNED SPECIFICATION DRIVEN AI DESIGN LIFE CYCLE FACTORY{" "}
            <span className="text-primary">(GS AI DLC)</span>
          </h1>
          <p className="mt-8 max-w-xl text-lg text-muted-foreground">The Command Centre walks a brief through staged, gated engines, keeps your references in scope, and sends weak work back for remediation instead of waving it through.</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/command" className="inline-flex h-12 items-center gap-2 bg-primary px-6 font-display text-xl tracking-wider text-primary-foreground hover:opacity-90" data-testid="link-hero-command">Open Command Centre <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            <Link href="/pricing" className="inline-flex h-12 items-center border border-foreground/30 px-6 font-display text-xl tracking-wider hover:bg-foreground/5" data-testid="link-hero-pricing">See access tiers</Link>
          </div>
          <p className="mt-4 font-mono text-xs text-muted-foreground">Access is controlled by the ATANDA team. Signed-in users go straight in.</p>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-7xl px-4 md:px-6 py-20 scroll-mt-20">
        <h2 className="font-display text-5xl md:text-6xl">Three ways in</h2>
        <div className="mt-10 grid gap-px bg-border border md:grid-cols-[1.3fr_1fr_1fr]">
          {ENTRY.map((e) => (
            <div key={e.k} className="bg-card p-7" data-testid={`card-entry-${e.k}`}>
              <span className="font-mono text-xs text-secondary">{e.k}</span>
              <h3 className="mt-3 font-display text-3xl">{e.t}</h3>
              <p className="mt-2 text-muted-foreground">{e.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="workflow" className="border-y bg-card scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-20">
          <h2 className="font-display text-5xl md:text-6xl">The ARK staged workflow</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">Stage-specific gates control progression. When work falls short, Boomerang and SPC Player can support remediation before a fresh evaluation; rework is not automatic approval.</p>
          <ol className="mt-10 grid grid-cols-2 md:grid-cols-6 gap-px bg-border border">
            {STAGES.map((s, i) => (
              <li key={s} className="bg-background p-5">
                <span className="font-mono text-[11px] text-muted-foreground">Gate {i + 1}</span>
                <p className="mt-1 font-display text-2xl">{s}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 md:px-6 py-20 grid gap-12 md:grid-cols-2">
        <div>
          <h2 className="font-display text-5xl">What is live, and what is not</h2>
          <p className="mt-3 text-muted-foreground">We label capability status plainly. Private assessments support your own review; they are not independent certification.</p>
        </div>
        <ul className="divide-y border-y">
          {STATUS.map((x, i) => (
            <li key={x.t} className="flex items-center justify-between gap-4 py-4" data-testid={`row-status-${i}`}>
              <span>{x.t}</span>
              <span className={`shrink-0 font-mono text-[11px] uppercase tracking-wider ${x.s === "Available" ? "text-primary" : "text-secondary"}`}>{x.s}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-7xl px-4 md:px-6 pb-20">
        <div className="grid gap-6 border-2 border-secondary p-7 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-secondary">Free / invite-only</p>
            <h2 className="mt-2 font-display text-4xl">FORGE Field Engineer</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">A free, convener-led learning programme with free-for-life Practitioner access for invited trainees. Verify your invited email and accept your invitation to activate it—no card or course-completion requirement. Standard usage limits apply. Contact your convener for an invitation.</p>
          </div>
          <Link href="/learn-register" className="inline-flex h-11 items-center justify-center border border-secondary px-6 font-display text-lg tracking-wider hover:bg-secondary/10" data-testid="link-landing-forge">Register with invite</Link>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 md:px-6 pb-24">
        <h2 className="font-display text-4xl mb-6">Plain answers</h2>
        <dl className="divide-y border-y">
          {FAQS.slice(0, 5).map((f) => (
            <div key={f.q} className="py-5"><dt className="font-medium">{f.q}</dt><dd className="mt-1 text-muted-foreground">{f.a}</dd></div>
          ))}
        </dl>
      </section>
    </MarketingShell>
  );
}
