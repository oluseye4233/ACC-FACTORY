import { useState } from "react";
import { Link } from "wouter";
import { Check, Lock } from "lucide-react";
import { useBillingCheckout, SubscriberTier, CheckoutInputInterval } from "@workspace/api-client-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { BILLING_ENABLED } from "@/lib/billing-flag";
import { useMarketingMeta } from "@/components/marketing/use-marketing-meta";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { PLANS, FAQS, requestAccessHref, type Plan } from "@/components/marketing/pricing-data";

const btn = "inline-flex w-full items-center justify-center h-11 font-display text-lg tracking-wider border transition-colors";

export default function Pricing() {
  useMarketingMeta("Access tiers | ATANDA Command Centre", "Explorer, Practitioner ($49/mo), Architect ($199/mo) and Institution plans. Private preview: paid plans by request.");
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const checkout = useBillingCheckout();
  const { toast } = useToast();

  const startCheckout = (plan: Plan) => {
    if (!BILLING_ENABLED) return; // never dispatch paid APIs while billing is off
    checkout.mutate(
      {
        data: {
          tier: plan.id === "ARCHITECT" ? SubscriberTier.ARCHITECT : SubscriberTier.PRACTITIONER,
          interval: interval === "yearly" ? CheckoutInputInterval.year : CheckoutInputInterval.month,
        },
      },
      {
        onSuccess: (res) => { if (res.url) window.location.href = res.url; },
        onError: () => toast({ title: "Checkout unavailable", description: "Open the Command Centre while signed in, then try again.", variant: "destructive" }),
      },
    );
  };

  const cta = (plan: Plan) => {
    if (plan.id === "EXPLORER")
      return <Link href="/command" className={`${btn} border-foreground/30 hover:bg-foreground/5`} data-testid="link-plan-explorer">Staff access</Link>;
    if (plan.id === "INSTITUTION")
      return <a href={requestAccessHref("Institution enquiry")} className={`${btn} border-foreground/30 hover:bg-foreground/5`} data-testid="link-request-institution">Request access</a>;
    if (!BILLING_ENABLED)
      return <a href={requestAccessHref(`${plan.name} plan (${interval})`)} className={`${btn} ${plan.featured ? "bg-primary text-primary-foreground border-primary" : "border-foreground/30 hover:bg-foreground/5"}`} data-testid={`link-request-${plan.id.toLowerCase()}`}>Request access</a>;
    return <button type="button" onClick={() => startCheckout(plan)} disabled={checkout.isPending} className={`${btn} bg-primary text-primary-foreground border-primary`} data-testid={`button-checkout-${plan.id.toLowerCase()}`}>{checkout.isPending ? "Opening checkout" : "Subscribe"}</button>;
  };

  return (
    <MarketingShell>
      <section className="mx-auto max-w-7xl px-4 md:px-6 pt-16 pb-10">
        {!BILLING_ENABLED && (
          <p className="inline-flex items-center gap-2 border border-secondary/50 bg-secondary/10 px-3 py-1 font-mono text-[11px] uppercase tracking-wider" data-testid="banner-private-preview">
            <Lock className="h-3 w-3" aria-hidden /> Private preview. Public billing is off; paid plans by request.
          </p>
        )}
        <h1 className="mt-6 font-display text-6xl md:text-8xl leading-none">Access tiers</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground text-lg">The planned launch structure for the ARK Harness. Prices are shown for reference; nothing is charged while billing is closed.</p>
        <div role="group" aria-label="Billing interval" className="mt-8 inline-flex border font-mono text-xs uppercase">
          {(["monthly", "yearly"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={interval === v} onClick={() => setInterval(v)} className={`px-4 py-2 tracking-wider ${interval === v ? "bg-foreground text-background" : "hover:bg-foreground/5"}`} data-testid={`button-interval-${v}`}>{v}</button>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 md:px-6 grid gap-px bg-border border md:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => (
          <article key={p.id} className={`flex flex-col bg-card p-7 ${p.featured ? "lg:-my-3 outline outline-2 outline-primary z-10" : ""}`} data-testid={`card-plan-${p.id.toLowerCase()}`}>
            <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.2em]">
              <span>{p.name}</span>
              {p.featured && <span className="text-primary">Recommended</span>}
            </div>
            <p className="mt-6 font-display text-6xl leading-none" data-testid={`text-price-${p.id.toLowerCase()}`}>
              {p.monthly === null ? "Custom" : p.monthly === 0 ? "$0" : `$${interval === "monthly" ? p.monthly : p.yearly}`}
              {p.monthly ? <span className="ml-1 font-mono text-sm text-muted-foreground">/{interval === "monthly" ? "month" : "year"}</span> : null}
            </p>
            <p className="mt-3 min-h-[3rem] text-sm text-muted-foreground">{p.tagline}</p>
            <ul className="mt-6 flex-1 space-y-3 text-sm">
              {p.features.map((f) => (<li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />{f}</li>))}
            </ul>
            <div className="mt-8">{cta(p)}</div>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-4 md:px-6 py-16">
        <div className="grid gap-6 border-2 border-secondary p-7 md:grid-cols-[1fr_auto] md:items-center" data-testid="card-forge">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-secondary" data-testid="status-forge">Free / invite-only programme</p>
            <h2 className="mt-2 font-display text-4xl">FORGE Field Engineer</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">Complete the FORGE FIELD ENGINEER course and receive its certification to unlock Practitioner free for life: $0 subscription fee, no expiry and no card. Invitation acceptance or course completion without certification does not unlock the benefit. Standard Practitioner usage limits apply; higher-tier features and course funding remain separate.</p>
          </div>
          <Link href="/learn-register" className="inline-flex h-11 items-center justify-center border border-secondary px-6 font-display text-lg tracking-wider hover:bg-secondary/10" data-testid="link-forge-register">Register with invite</Link>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">Already have access? <Link href="/command" className="underline underline-offset-4" data-testid="link-open-command">Open the Command Centre</Link>.</p>
      </section>

      <section className="mx-auto max-w-3xl px-4 md:px-6 pb-20">
        <h2 className="font-display text-4xl mb-6">Questions</h2>
        <Accordion type="single" collapsible>
          {FAQS.map((f, i) => (
            <AccordionItem key={f.q} value={`faq-${i}`}>
              <AccordionTrigger className="text-left" data-testid={`button-faq-${i}`}>{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </MarketingShell>
  );
}
