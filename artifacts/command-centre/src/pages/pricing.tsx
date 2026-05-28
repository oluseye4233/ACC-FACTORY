import { Link, useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { TierBadge } from "@/components/shared/TierBadge";
import {
  useGetPricing,
  useBillingCheckout,
  useBillingIngestionCheckout,
  useBillingCartridgeCheckout,
  PricingTier,
  SubscriberTier,
  CheckoutInputInterval,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Check, ShieldCheck, Lock, FileUp, Users } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { BILLING_ENABLED, ACCESS_REQUEST_EMAIL } from "@/lib/billing-flag";

// Fallback data if API returns 404
const FALLBACK_PRICING = {
  tiers: [
    {
      id: "EXPLORER",
      name: "EXPLORER",
      tagline: "For individuals learning the methodology",
      priceMonthly: 0,
      priceYearly: 0,
      priceLabel: "Free forever",
      ctaLabel: "START FREE",
      featured: false,
      features: ["5 sessions per day", "Basic JCSE scoring", "Standard support"]
    },
    {
      id: "PRACTITIONER",
      name: "PRACTITIONER",
      tagline: "For professional prompt engineers",
      priceMonthly: 49,
      priceYearly: 470,
      priceLabel: "per month",
      ctaLabel: "START 30-DAY TRIAL",
      featured: true,
      features: ["20 sessions per day", "Advanced diagnostics", "SPARTAN compression", "Priority support"]
    },
    {
      id: "ARCHITECT",
      name: "ARCHITECT",
      tagline: "For teams and product architects",
      priceMonthly: 199,
      priceYearly: 1910,
      priceLabel: "per month",
      ctaLabel: "UPGRADE NOW",
      featured: false,
      features: ["100 sessions per day", "Full MA Birth Packages", "Custom templates", "Dedicated account manager"]
    },
    {
      id: "INSTITUTION",
      name: "INSTITUTION",
      tagline: "For enterprise scale deployments",
      priceMonthly: null,
      priceYearly: null,
      priceLabel: "Custom pricing",
      ctaLabel: "CONTACT SALES",
      featured: false,
      features: ["Unlimited sessions", "On-premise deployment", "Custom integration", "SLA guarantees"]
    }
  ] as PricingTier[],
  faqs: [
    { q: "What happens after the 30-day trial?", a: "You will be automatically charged based on the plan you selected. You can cancel anytime before the trial ends." },
    { q: "Can I upgrade or downgrade my plan later?", a: "Yes, you can manage your subscription from the Billing section in the Command Centre." }
  ],
  trust: [
    { label: "SOC2 Compliant" },
    { label: "End-to-end Encryption" }
  ]
};

export default function Pricing() {
  const { data, isLoading, isError } = useGetPricing();
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const checkout = useBillingCheckout();
  const ingestionCheckout = useBillingIngestionCheckout();
  const cartridgeCheckout = useBillingCartridgeCheckout();

  const handleBuyCartridgeCredit = () => {
    if (!BILLING_ENABLED) {
      window.location.href = `mailto:${ACCESS_REQUEST_EMAIL}?subject=${encodeURIComponent(
        "Early access — Advanced Cartridge project credit",
      )}&body=${encodeURIComponent(
        "Hello,\n\nI'd like to purchase an ATANDA Advanced Cartridge project credit during the private preview.\n\nName:\nOrganisation:\nProject:\n\nThank you.",
      )}`;
      return;
    }
    cartridgeCheckout.mutate(
      { data: {} },
      {
        onSuccess: (res) => {
          if (res.url) window.location.href = res.url;
        },
      },
    );
  };
  const { toast } = useToast();
  const { isSignedIn } = useAuth();
  const [, setLocation] = useLocation();

  const handleBuyIngestionCredit = () => {
    if (!BILLING_ENABLED) {
      window.location.href = `mailto:${ACCESS_REQUEST_EMAIL}?subject=${encodeURIComponent(
        "Early access — Ingestion project credit",
      )}&body=${encodeURIComponent(
        "Hello,\n\nI'd like to purchase an ATANDA Ingestion project credit during the private preview.\n\nName:\nOrganisation:\nDocument I want to ingest:\n\nThank you.",
      )}`;
      return;
    }
    if (!isSignedIn) {
      setLocation("/sign-in");
      return;
    }
    ingestionCheckout.mutate(
      { data: {} },
      {
        onSuccess: (res) => {
          if (res.url) window.location.href = res.url;
        },
        onError: (err) => {
          const msg =
            (err as { data?: { error?: string } })?.data?.error ??
            "Could not start checkout.";
          toast({ title: "Checkout unavailable", description: msg, variant: "destructive" });
        },
      },
    );
  };

  const handleSubscribe = (priceId: string) => {
    if (priceId === SubscriberTier.EXPLORER) {
      setLocation("/sign-up");
      return;
    }

    if (priceId === SubscriberTier.INSTITUTION) {
      window.location.href = `mailto:${ACCESS_REQUEST_EMAIL}?subject=Institution%20tier%20enquiry`;
      return;
    }

    // Private-preview mode: paid checkout is disabled. Route the user to the
    // access-request mailbox instead of attempting a Stripe checkout session.
    if (!BILLING_ENABLED) {
      window.location.href = `mailto:${ACCESS_REQUEST_EMAIL}?subject=${encodeURIComponent(
        `Early access — ${priceId} tier`,
      )}&body=${encodeURIComponent(
        `Hello,\n\nI'd like early access to the ATANDA Command Centre at the ${priceId} tier.\n\nName:\nOrganisation:\nUse case:\n\nThank you.`,
      )}`;
      return;
    }

    if (!isSignedIn) {
      setLocation("/sign-in");
      return;
    }

    const tierEnum = (SubscriberTier as Record<string, SubscriberTier>)[priceId];
    if (!tierEnum) {
      toast({
        title: "Invalid plan",
        description: `Unknown tier: ${priceId}`,
        variant: "destructive",
      });
      return;
    }
    const intervalEnum: CheckoutInputInterval =
      interval === "yearly" ? CheckoutInputInterval.year : CheckoutInputInterval.month;

    checkout.mutate(
      { data: { tier: tierEnum, interval: intervalEnum } },
      {
        onSuccess: (res) => {
          if (res.url) {
            window.location.href = res.url;
          }
        },
        onError: (err) => {
          const msg =
            err && typeof err === "object" && "data" in err
              ? (err as { data?: { error?: string } }).data?.error
              : undefined;
          toast({
            title: "Checkout failed",
            description: msg || "An unexpected error occurred.",
            variant: "destructive",
          });
        }
      }
    );
  };

  const pricingData = !isLoading && !isError && data ? data : FALLBACK_PRICING;

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <main className="flex-1 bg-background">
        <section className="py-20">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center text-center space-y-4 mb-16">
              {!BILLING_ENABLED && (
                <div
                  className="mb-2 inline-flex items-center gap-2 rounded-full border border-secondary/30 bg-secondary/10 px-4 py-1.5 text-xs font-mono uppercase tracking-wider text-secondary"
                  data-testid="banner-private-preview"
                >
                  <Lock className="h-3 w-3" />
                  Private preview — public billing opens at General Availability
                </div>
              )}
              <h1 className="font-display text-4xl md:text-6xl tracking-wide text-primary">ACCESS TIERS</h1>
              <p className="text-muted-foreground font-serif text-lg max-w-2xl">
                {BILLING_ENABLED
                  ? "Choose the operational capacity that matches your mission requirements."
                  : "Pricing shown is the planned launch structure. Paid tiers are invite-only during the private preview — use Request Access to be considered."}
              </p>
              
              <Tabs value={interval} onValueChange={(v) => setInterval(v as "monthly" | "yearly")} className="mt-8">
                <TabsList className="bg-card border">
                  <TabsTrigger value="monthly" className="font-mono">MONTHLY</TabsTrigger>
                  <TabsTrigger value="yearly" className="font-mono">
                    YEARLY <span className="ml-2 text-[10px] bg-secondary/20 text-secondary px-1.5 py-0.5 rounded">-20%</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-[500px] rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
                {pricingData.tiers.map((tier) => (
                  <div 
                    key={tier.id} 
                    className={`flex flex-col p-8 rounded-lg border bg-card relative ${
                      tier.featured ? 'ring-2 ring-primary border-transparent' : ''
                    }`}
                  >
                    {tier.featured && (
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground font-mono text-xs font-bold px-3 py-1 rounded-full border border-background">
                        RECOMMENDED
                      </div>
                    )}
                    
                    <div className="mb-6">
                      <TierBadge tier={tier.id} className="mb-4" />
                      <div className="flex items-baseline gap-2 mb-2">
                        {tier.priceMonthly !== null ? (
                          <>
                            <span className="text-4xl font-display tracking-wider">
                              ${interval === "monthly" ? tier.priceMonthly : tier.priceYearly}
                            </span>
                            <span className="text-muted-foreground font-mono text-sm">/{interval === "monthly" ? "mo" : "yr"}</span>
                          </>
                        ) : (
                          <span className="text-3xl font-display tracking-wider text-muted-foreground">CUSTOM</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground min-h-[40px]">{tier.tagline}</p>
                    </div>
                    
                    <div className="flex-1 mb-8">
                      <ul className="space-y-4">
                        {tier.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm">
                            <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="mt-auto pt-6 border-t">
                      {BILLING_ENABLED && (tier.id === "PRACTITIONER" || tier.id === "ARCHITECT") && (
                        <div className="mb-3 text-center">
                          <span className="text-xs font-mono font-bold text-secondary bg-secondary/10 px-2 py-1 rounded">30-DAY FREE TRIAL</span>
                        </div>
                      )}
                      {(() => {
                        const isPaidTier =
                          tier.id === "PRACTITIONER" || tier.id === "ARCHITECT";
                        const previewLabel =
                          !BILLING_ENABLED && isPaidTier
                            ? "REQUEST ACCESS"
                            : tier.ctaLabel;
                        return (
                          <Button
                            onClick={() => handleSubscribe(tier.id)}
                            disabled={checkout.isPending}
                            variant={tier.featured ? "default" : "outline"}
                            className={`w-full font-display tracking-wider text-lg ${
                              tier.featured ? "" : "border-primary/20 hover:bg-primary/10"
                            }`}
                          >
                            {checkout.isPending && checkout.variables?.data.tier === tier.id
                              ? "PROCESSING..."
                              : previewLabel}
                          </Button>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Team / seat-based subscriptions — two flavours side by side */}
        <section className="pb-10">
          <div className="container px-4 md:px-6 max-w-5xl">
            <div className="grid md:grid-cols-2 gap-4">
              {/* TEAM LITE */}
              <div className="rounded-lg border bg-card overflow-hidden p-6 md:p-7 flex flex-col">
                <div className="inline-flex items-center gap-2 rounded-full border border-secondary/40 bg-secondary/10 px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-secondary mb-3 self-start">
                  <Users className="h-3 w-3" />
                  TEAM LITE · ELEVATES TO ARCHITECT
                </div>
                <h3 className="font-display text-xl md:text-2xl tracking-wider mb-1">
                  TEAM LITE <span className="text-secondary">— PER SEAT</span>
                </h3>
                <p className="font-mono text-xs text-muted-foreground mb-3">
                  From <span className="text-foreground font-bold">$99/seat/month</span>
                </p>
                <p className="font-serif text-sm text-muted-foreground leading-relaxed mb-4">
                  Each active member is elevated to the <strong>ARCHITECT</strong> tier —
                  unlimited F1–F7 and 2 F8 Code DJ runs per day. Best for small teams who
                  want collaboration without uncapped F8 scaffolding.
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground mb-5 flex-1">
                  <li className="flex items-start gap-2"><Check className="h-4 w-4 text-secondary shrink-0 mt-0.5" /> Active members → ARCHITECT tier</li>
                  <li className="flex items-start gap-2"><Check className="h-4 w-4 text-secondary shrink-0 mt-0.5" /> Unlimited F1–F7, 2 F8/day per member</li>
                  <li className="flex items-start gap-2"><Check className="h-4 w-4 text-secondary shrink-0 mt-0.5" /> Per-org Activity audit log + CSV export</li>
                  <li className="flex items-start gap-2"><Check className="h-4 w-4 text-secondary shrink-0 mt-0.5" /> Share sessions across the team</li>
                </ul>
                <Button
                  onClick={() => {
                    if (!BILLING_ENABLED) {
                      window.location.href = `mailto:${ACCESS_REQUEST_EMAIL}?subject=${encodeURIComponent(
                        "Early access — Team Lite subscription",
                      )}`;
                      return;
                    }
                    if (!isSignedIn) {
                      setLocation("/sign-in");
                      return;
                    }
                    setLocation("/orgs?plan=team_lite");
                  }}
                  variant="outline"
                  className="font-display tracking-wider w-full"
                  data-testid="button-team-lite-checkout"
                >
                  {BILLING_ENABLED ? "PICK A TEAM" : "REQUEST ACCESS"}
                </Button>
              </div>

              {/* TEAM */}
              <div className="rounded-lg border-2 border-primary/60 bg-card overflow-hidden p-6 md:p-7 flex flex-col">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-primary mb-3 self-start">
                  <Users className="h-3 w-3" />
                  TEAM · ELEVATES TO INSTITUTION
                </div>
                <h3 className="font-display text-xl md:text-2xl tracking-wider mb-1">
                  TEAM <span className="text-primary">— PER SEAT</span>
                </h3>
                <p className="font-mono text-xs text-muted-foreground mb-3">
                  From <span className="text-foreground font-bold">$149/seat/month</span>
                </p>
                <p className="font-serif text-sm text-muted-foreground leading-relaxed mb-4">
                  Each active member is elevated to the <strong>INSTITUTION</strong> tier —
                  unlimited engine runs across every engine, including F8 Code DJ. Best for
                  teams shipping codebases at volume.
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground mb-5 flex-1">
                  <li className="flex items-start gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Active members → INSTITUTION tier</li>
                  <li className="flex items-start gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Unlimited everything, including F8 Code DJ</li>
                  <li className="flex items-start gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Per-org Activity audit log + CSV export</li>
                  <li className="flex items-start gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Share sessions across the team</li>
                </ul>
                <Button
                  onClick={() => {
                    if (!BILLING_ENABLED) {
                      window.location.href = `mailto:${ACCESS_REQUEST_EMAIL}?subject=${encodeURIComponent(
                        "Early access — Team subscription",
                      )}`;
                      return;
                    }
                    if (!isSignedIn) {
                      setLocation("/sign-in");
                      return;
                    }
                    setLocation("/orgs?plan=team");
                  }}
                  variant="default"
                  className="font-display tracking-wider w-full"
                  data-testid="button-team-checkout"
                >
                  {BILLING_ENABLED ? "PICK A TEAM" : "REQUEST ACCESS"}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Standalone per-project add-on */}
        <section className="pb-20">
          <div className="container px-4 md:px-6 max-w-5xl">
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="grid md:grid-cols-[1fr_auto] gap-6 p-6 md:p-8 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-secondary/40 bg-secondary/10 px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-secondary mb-3">
                    <FileUp className="h-3 w-3" />
                    STANDALONE · NO SUBSCRIPTION REQUIRED
                  </div>
                  <h3 className="font-display text-2xl md:text-3xl tracking-wider mb-2">
                    INGESTION ENGINE <span className="text-primary">— PER PROJECT</span>
                  </h3>
                  <p className="font-serif text-muted-foreground leading-relaxed mb-4 max-w-2xl">
                    Already have an Ingestion Product Design Document (IPDD), SDD, concept
                    note, or spec sheet? Buy a single project credit and turn it into a HARNESS-certified
                    <span className="text-foreground"> PromptWare Design Document (PWDD)</span>.
                    No monthly commitment. Failed runs are refunded automatically.
                  </p>
                  <ul className="grid sm:grid-cols-2 gap-2 text-sm">
                    {[
                      "One credit = one document → one PWDD session",
                      "Runs F1 → F7 end-to-end",
                      "Works on any account tier (Explorer included)",
                      "Credits never expire",
                    ].map((feat, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="md:text-right">
                  <div className="flex md:flex-col items-baseline md:items-end gap-2 mb-4">
                    <span className="text-5xl font-display tracking-wider">$199.99</span>
                    <span className="text-muted-foreground font-mono text-sm">
                      / project
                    </span>
                  </div>
                  <Button
                    onClick={handleBuyIngestionCredit}
                    disabled={ingestionCheckout.isPending}
                    className="w-full md:w-auto font-display tracking-wider"
                    data-testid="button-buy-ingestion-credit"
                  >
                    {ingestionCheckout.isPending
                      ? "OPENING CHECKOUT…"
                      : !BILLING_ENABLED
                        ? "REQUEST ACCESS"
                        : "BUY A PROJECT CREDIT"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Advanced Cartridge per-project add-on */}
        <section className="pb-20">
          <div className="container px-4 md:px-6 max-w-5xl">
            <div className="rounded-lg border border-primary/30 bg-card overflow-hidden">
              <div className="grid md:grid-cols-[1fr_auto] gap-6 p-6 md:p-8 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-primary mb-3">
                    <FileUp className="h-3 w-3" />
                    STANDALONE · PREMIUM PER-PROJECT
                  </div>
                  <h3 className="font-display text-2xl md:text-3xl tracking-wider mb-2">
                    ADVANCED CARTRIDGE <span className="text-primary">— PER PROJECT</span>
                  </h3>
                  <p className="font-serif text-muted-foreground leading-relaxed mb-4 max-w-2xl">
                    For real projects that arrive with{" "}
                    <span className="text-foreground">multiple documents</span>,{" "}
                    <span className="text-foreground">prior SPCs</span>, and a
                    live <span className="text-foreground">codebase or database</span>.
                    You define the project scope; the HARNESS protects that
                    scope across F1 → F7 and ships a certified PWDD + MVP-PDD
                    ready for F8 Code DJ hand-off.
                  </p>
                  <ul className="grid sm:grid-cols-2 gap-2 text-sm">
                    {[
                      "Required scope statement — pinned in every prompt",
                      "Up to 5 supporting docs + 10 SPCs",
                      "Optional git / database link descriptors",
                      "Works on any account tier (Explorer included)",
                      "Failed builds are refunded automatically",
                      "Credit never expires",
                    ].map((feat, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="md:text-right">
                  <div className="flex md:flex-col items-baseline md:items-end gap-2 mb-4">
                    <span className="text-5xl font-display tracking-wider">$499.99</span>
                    <span className="text-muted-foreground font-mono text-sm">
                      / project
                    </span>
                  </div>
                  <Button
                    onClick={handleBuyCartridgeCredit}
                    disabled={cartridgeCheckout.isPending}
                    className="w-full md:w-auto font-display tracking-wider"
                    data-testid="button-buy-cartridge-credit"
                  >
                    {cartridgeCheckout.isPending
                      ? "OPENING CHECKOUT…"
                      : !BILLING_ENABLED
                        ? "REQUEST ACCESS"
                        : "BUY A CARTRIDGE CREDIT"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Strip */}
        {!isLoading && pricingData.trust && pricingData.trust.length > 0 && (
          <section className="py-12 border-y bg-card/50">
            <div className="container px-4">
              <div className="flex flex-wrap justify-center gap-8 md:gap-16">
                {pricingData.trust.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-muted-foreground">
                    <ShieldCheck className="h-5 w-5 opacity-50" />
                    <span className="font-mono text-sm uppercase tracking-wider">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* FAQs */}
        {!isLoading && pricingData.faqs && pricingData.faqs.length > 0 && (
          <section className="py-20">
            <div className="container px-4 md:px-6 max-w-3xl">
              <h2 className="font-display text-3xl text-center tracking-wide mb-10">FREQUENTLY ASKED QUESTIONS</h2>
              <Accordion type="single" collapsible className="w-full">
                {pricingData.faqs.map((faq, i) => (
                  <AccordionItem key={i} value={`faq-${i}`} className="border-border">
                    <AccordionTrigger className="text-left font-medium hover:text-primary transition-colors">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
