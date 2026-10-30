import { useEffect } from "react";
import { ForgeInviteApplication } from "@/components/marketing/ForgeInviteApplication";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { useMarketingMeta } from "@/components/marketing/use-marketing-meta";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { FAQS } from "@/components/marketing/pricing-data";

const ENTRY = [
  { k: "01", t: "New Session", d: "Your idea does not have to arrive perfectly formed. Start with a brief and work through the next decision, one stage at a time." },
  { k: "02", t: "Ingestion", d: "You have already done valuable thinking. Bring your existing design document into a structured session instead of starting again." },
  { k: "03", t: "Cartridge + Exemplar", d: "Keep useful work with you. Scope a larger project and retain selected Exemplar references as you move through its stages." },
];

const STAGES = ["F1 Clarify", "F2-F4 Specify", "F5 SPC / SCAN", "F6 Draft PDD", "F7 SPARTAN", "F8 CODE ONE +"];

const NEEDS = [
  { t: "A direction that survives the next prompt", d: "When requirements keep changing, it is hard to know whether you are making progress or simply producing more output." },
  { t: "A way to question the result", d: "A convincing answer is not the same as evidence. You need room to inspect assumptions, identify gaps and decide what deserves your trust." },
  { t: "A next step when something falls short", d: "A failed check should tell you where to focus—not leave you wondering whether to abandon the work and start again." },
];

const PROOF = [
  { t: "References and artifacts you can revisit", d: "Selected source references and saved stage artifacts make the project’s working context available for review." },
  { t: "A visible route for rework", d: "Boomerang and SPC Player support remediation and return work for review. A fresh evaluation is still required; rework is not automatic approval." },
  { t: "Limits stated alongside capabilities", d: "Internal assessments are not independent certification. Provider handoffs remain conditional, and unfinished services are identified below." },
];

const STATUS: { t: string; s: "Available" | "Conditional" | "Private" | "Not fully active" | "Closed" }[] = [
  { t: "Boomerang / SPC Player remediation", s: "Available" },
  { t: "Cohort, convener and Quest", s: "Available" },
  { t: "IMPRIMA Internal / SHORT SPRINT Internal", s: "Private" },
  { t: "F10 / F11 target-specific subscription handoffs", s: "Conditional" },
  { t: "F12 and independent XVL / VTE", s: "Not fully active" },
  { t: "Sphinx", s: "Closed" },
];

export default function Landing() {
  useMarketingMeta("ATANDA | Build with clarity through the ARK Harness", "Turn an idea you care about into structured specifications and reviewable AI-assisted work with ATANDA’s ARK Harness. Explore access tiers, guided learning and current capability limits.");
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
      <section className="relative overflow-hidden border-b" data-snap="story">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(hsl(var(--foreground))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--foreground))_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="relative mx-auto max-w-7xl px-4 md:px-6 py-20 md:py-28">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">ATANDA · ARK Harness · private preview</p>
          <p className="mt-5 max-w-3xl font-mono text-[11px] leading-relaxed tracking-wide text-muted-foreground">WELCOME TO OUR GOVERNED SPECIFICATION DRIVEN AI DESIGN LIFE CYCLE FACTORY (GS AI DLC)</p>
          <h1 className="mt-6 max-w-6xl font-display text-[clamp(2.25rem,6.5vw,5.75rem)] leading-[1.02] [overflow-wrap:anywhere]" data-testid="text-landing-headline">
            Your idea matters.{" "}
            <span className="text-primary">Build it with a clearer way forward.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg text-muted-foreground">You begin with something you believe in. Then come the disconnected prompts, the lost context and the uncertainty about what to do next. ATANDA’s ARK Harness gives your AI-assisted project a structured path—from the first brief to specifications and a code scaffold, with opportunities to review and rework along the way.</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/pricing" className="inline-flex h-12 items-center gap-2 bg-primary px-6 font-display text-xl tracking-wider text-primary-foreground hover:opacity-90" data-testid="link-hero-pricing">Find your starting point <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            <Link href="/command" className="inline-flex h-12 items-center border border-foreground/30 px-6 font-display text-xl tracking-wider hover:bg-foreground/5" data-testid="link-hero-command">Open Command Centre</Link>
          </div>
          <p className="mt-4 font-mono text-xs text-muted-foreground">Explore the current tiers before requesting access. Workspace access remains controlled by the ATANDA team.</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 md:px-6 pt-16" aria-labelledby="autocommand-promo">
        <div className="grid gap-6 border-l-4 border-secondary bg-card p-7 md:grid-cols-[1fr_auto] md:items-center md:p-10">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-secondary">New · ATANDA AutoCommand · intake open</p>
            <h2 id="autocommand-promo" className="mt-3 font-display text-4xl md:text-5xl">Fast Consulting: turn one idea into a specification package you own.</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">Choose a Basic AI Agent, Advanced AI Agent or AI-native Web Application package and save a private, verified intake today. Checkout and automatic production are not open yet; saving a brief is not an order.</p>
          </div>
          <Link href="/autocommand" className="inline-flex min-h-12 items-center gap-2 bg-secondary px-6 py-3 font-display text-xl tracking-wider text-secondary-foreground hover:opacity-90" data-testid="link-landing-autocommand">See AutoCommand <ArrowRight className="h-4 w-4" aria-hidden /></Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 md:px-6 py-20" data-snap="need">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">What you need</p>
        <h2 className="mt-4 max-w-4xl font-display text-4xl md:text-6xl">You should not have to guess whether your work is moving forward.</h2>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {NEEDS.map(need => <div key={need.t}>
            <h3 className="font-display text-2xl">{need.t}</h3>
            <p className="mt-3 leading-relaxed text-muted-foreground">{need.d}</p>
          </div>)}
        </div>
      </section>

      <section id="how" className="mx-auto max-w-7xl px-4 md:px-6 pb-20 scroll-mt-20" data-snap="answer">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">ATANDA’s answer</p>
        <h2 className="mt-4 font-display text-5xl md:text-6xl">Start where you are. Keep what matters.</h2>
        <p className="mt-4 max-w-2xl text-muted-foreground">The ARK Harness brings briefs, specifications, retained references and review stages into one working process. Choose the entry that matches the work you have today.</p>
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
          <h2 className="font-display text-5xl md:text-6xl">Know the next step. See what still needs work.</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">The ARK staged workflow makes the next task visible. Stage-specific gates control progression, and supporting remediation can return weak work for fresh evaluation. A generated artifact is a starting point for review—not permission to skip it.</p>
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

      <section className="mx-auto max-w-7xl px-4 md:px-6 pt-20" data-snap="proof">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">What you can examine</p>
        <h2 className="mt-4 max-w-4xl font-display text-5xl md:text-6xl">Your trust should have something to rest on.</h2>
        <p className="mt-4 max-w-2xl text-muted-foreground">Not a promise of perfect AI. A process with saved context, reviewable work and stated boundaries. Here is what supports that approach.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PROOF.map(proof => <div key={proof.t} className="border bg-card p-6">
            <h3 className="font-display text-2xl">{proof.t}</h3>
            <p className="mt-3 text-muted-foreground">{proof.d}</p>
          </div>)}
        </div>
        <Link href="/guide" className="mt-7 inline-flex items-center gap-2 font-medium text-primary underline underline-offset-4" data-testid="link-landing-proof">Read the operating guide and check the boundaries <ArrowRight className="h-4 w-4" aria-hidden /></Link>
      </section>

      <section className="mx-auto max-w-7xl px-4 md:px-6 py-20 grid gap-12 md:grid-cols-2">
        <div>
          <h2 className="font-display text-5xl">A clear view of what you are choosing.</h2>
          <p className="mt-3 text-muted-foreground">You deserve to see the limits before you commit. Capabilities are labelled plainly; private assessments support your review and are not independent certification.</p>
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
            <p className="mt-2 max-w-2xl text-muted-foreground">You do not have to learn the process alone. Build your understanding through our free, invite-only programme. Complete the course and receive your FORGE FIELD ENGINEER Certification to unlock Practitioner free for life—no subscription fee or card. Joining alone does not unlock it. Standard usage limits apply. Contact your convener for an invitation.</p>
          </div>
          <div className="flex flex-col gap-3">
            <Link href="/learn-register" className="inline-flex h-11 items-center justify-center border border-secondary px-6 font-display text-lg tracking-wider hover:bg-secondary/10" data-testid="link-landing-forge">Register with invite</Link>
            <ForgeInviteApplication />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 md:px-6 pb-20">
        <div className="border bg-card p-7 md:p-10">
          <h2 className="font-display text-4xl md:text-5xl">Give the idea you care about a considered next step.</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">Explore ATANDA’s current access tiers, understand the boundaries and choose the starting point that fits your work.</p>
          <Link href="/pricing" className="mt-6 inline-flex min-h-12 items-center gap-2 bg-primary px-6 py-3 font-display text-xl text-primary-foreground hover:opacity-90" data-testid="link-landing-plans">Explore access and subscriptions <ArrowRight className="h-4 w-4" aria-hidden /></Link>
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
