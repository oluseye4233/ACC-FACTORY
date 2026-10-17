import { Link } from "wouter";

const FEATURES = [
  {
    name: "Platform baseline",
    status: "LIVE · OBSERVED",
    detail: "Public health checks report the database available and an AI provider configured. These checks do not prove every engine, migration, or authenticated workflow works.",
    href: "/status", action: "Check current readiness",
  },
  {
    name: "HARNESS, advisory & workspaces",
    status: "DEPLOYED · ACCESS-GATED",
    detail: "Sessions, F0 advisory, ingestion, cartridges, prompts, activity and cost views are implemented. Sign-in, tier, source eligibility and spend limits still apply; deployment is not an end-to-end acceptance test.",
    href: "/command", action: "Open Command Deck",
  },
  {
    name: "IMPRIMA",
    status: "LIMITED · PRIVATE PREPARATION",
    detail: "The separate private preparation lane creates DRAFT HTML, DOCX, PDF and ZIP files from eligible saved sources you own. Full governed publishing and FINAL approval remain blocked until database protections and verification gates pass.",
    href: "/operations", action: "Open Artifact Operations",
  },
  {
    name: "SHORT SPRINTS",
    status: "LIMITED · PRIVATE PREPARATION",
    detail: "SC_ONE and SC_TWO private proposal packages are implemented. They do not certify a sprint, skip stages, deploy code or authorize release. Full operation requires database protections, eligible evidence and verifier/governance gates.",
    href: "/operations", action: "Open sprint preparation",
  },
  {
    name: "Independent XVL / VTE & full F12",
    status: "INCOMPLETE · NOT ACTIVE",
    detail: "Advisory Track E JSON contract checks and VTE failure intake are available. Independent verification and full F12 operation are not activated; advisory results are not independent clearance.",
    href: "/operations", action: "Review operation gates",
  },
  {
    name: "Exemplar → Sphinx supply",
    status: "LIBRARY AVAILABLE · PUBLIC MARKET CLOSED",
    detail: "Exemplar is the shared catalog for SPC, MA, MPDD and PDD assets. Only eligible owner-controlled artifacts meeting internal standards can opt into Sphinx supply. Public launch remains closed; opting in is not a public listing, sale or checkout.",
    href: "/exemplars", action: "Open Exemplar library",
  },
  {
    name: "SPC Player & ATLAS 360",
    status: "IMPLEMENTED · ADVISORY",
    detail: "SPC Player produces sequential, plan-only packages. ATLAS 360 PLAN / SCAN are Practitioner-gated views of F6/F7 documents, not new stages or independent certifications.",
    href: "/spc-player", action: "Open SPC Player",
  },
  {
    name: "F8–F10 delivery",
    status: "IMPLEMENTED · EVIDENCE-GATED",
    detail: "F8 provides code and IDE exports; GitHub handoff uses F10. Firmware uses the F9 machine-floor path and OSIRIS custody. Signed release and provider lanes require their own evidence and authorization. A delivery receipt does not prove deployment or execution.",
    href: "/f10", action: "Open release gateway",
  },
  {
    name: "Azure Key Vault",
    status: "DEFERRED · CLASS B",
    detail: "Azure Key Vault migration and rotation are deferred. The limited launch uses existing secret controls; Azure is not a prerequisite for private preparation or baseline access.",
    href: "/status", action: "View deferred requirements",
  },
] as const;

export function PlatformStatus() {
  return (
    <section id="platform-status" className="py-12 md:py-16 bg-muted/20 scroll-mt-24" aria-labelledby="platform-status-title">
      <div className="container px-4 md:px-6 max-w-6xl">
        <h2 id="platform-status-title" className="font-display text-3xl md:text-4xl tracking-wide text-primary mb-4">
          CURRENT PLATFORM STATUS
        </h2>
        <p className="text-muted-foreground mb-3">
          Reviewed 17 October 2026. This is a dated operating guide, not a live monitor or certification.
          Public health and Sphinx catalog checks were observed; authenticated save, download and release
          outcomes are not asserted by those checks.
        </p>
        <p className="text-sm mb-6">
          <strong>Available does not mean unrestricted.</strong> Private drafts and proposals are separate
          from protected approval, certification and release. The Operations workspace evaluates current
          gates; unavailable protections never grant fallback approval.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          {FEATURES.map((feature) => (
            <article key={feature.name} className="rounded-lg border bg-card p-5" data-testid="guide-platform-status">
              <p className="text-xs font-mono font-semibold text-primary mb-2">{feature.status}</p>
              <h3 className="font-semibold text-lg mb-2">{feature.name}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">{feature.detail}</p>
              <Link href={feature.href} className="text-sm text-primary underline underline-offset-4">{feature.action}</Link>
            </article>
          ))}
        </div>
        <p className="text-sm text-muted-foreground mt-5">
          For fresh baseline checks, open <Link href="/status" className="text-primary underline">Platform Status</Link>.
          Light and dark appearance are available from the theme control in the navigation.
        </p>
      </div>
    </section>
  );
}
