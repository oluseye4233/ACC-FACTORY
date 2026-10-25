import { ACCESS_REQUEST_EMAIL } from "@/lib/billing-flag";

export type PlanId = "EXPLORER" | "PRACTITIONER" | "ARCHITECT" | "INSTITUTION";

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  monthly: number | null;
  yearly: number | null;
  featured?: boolean;
  features: string[];
}

/** Original launch amounts from api-server pricing.ts; feature copy limited to bounded, current capabilities. */
export const PLANS: Plan[] = [
  {
    id: "EXPLORER",
    name: "Explorer",
    tagline: "Learn the method on controlled staff access.",
    monthly: 0,
    yearly: 0,
    features: [
      "F1 ATLAS diagnostic and early engines, within daily limits",
      "New Session workspace in the Command Centre",
      "Access is granted by the ATANDA team, not by instant sign-up",
    ],
  },
  {
    id: "PRACTITIONER",
    name: "Practitioner",
    tagline: "Build real artifacts through the staged workflow.",
    monthly: 49,
    yearly: 470,
    featured: true,
    features: [
      "Higher daily limits across the staged ARK workflow",
      "SPC, PDD and SPARTAN stages where enabled for your account",
      "Ingestion sessions from an existing document",
      "Boomerang / SPC Player remediation on returned work",
      "Email support during the private preview",
    ],
  },
  {
    id: "ARCHITECT",
    name: "Architect",
    tagline: "Larger projects with retained references.",
    monthly: 199,
    yearly: 1910,
    features: [
      "Higher daily allowances than Practitioner, subject to fair-use limits",
      "Cartridge projects with Exemplar retained references",
      "Session export bundles",
      "Target-specific F10 / F11 handoffs where configured",
    ],
  },
  {
    id: "INSTITUTION",
    name: "Institution",
    tagline: "Scoped rollout for cohorts and organisations.",
    monthly: null,
    yearly: null,
    features: [
      "Cohort and convener tooling for structured programmes",
      "Scope, seats and limits agreed in writing",
      "Onboarding support from the ATANDA team",
    ],
  },
];

export const FAQS: { q: string; a: string }[] = [
  { q: "Can I buy a plan today?", a: "Not yet. Public billing is switched off during the private preview. Paid plans are offered by request; we reply by email and set up access manually." },
  { q: "Is Explorer free and open to anyone?", a: "Explorer carries no charge, but access is controlled. Accounts are enabled by the ATANDA team; there is no instant, unrestricted free membership." },
  { q: "Are private or internal outputs a certification?", a: "No. Scores, IMPRIMA Internal and SHORT SPRINT Internal assessments and other private outputs support your own review. They are not independent certification and should not be presented as such." },
  { q: "How do I get Practitioner free for life through FORGE?", a: "Receive a FORGE FIELD ENGINEER trainee invitation, sign in with the invited verified email and accept the free terms. This activates a $0 lifetime Practitioner entitlement immediately, with no course-completion requirement. Previously accepted trainee invitations qualify too. The benefit survives course expiry or completion. Standard Practitioner usage/spend limits apply; higher-tier features, credentials and unlimited inference are not included. Course funding is separate. Existing paid subscriptions are not automatically cancelled or refunded." },
  { q: "Are F10, F11 and F12 available?", a: "F10 and F11 subscription handoffs are target-specific and conditional on configuration. F12 and independent XVL / VTE verification are not fully active." },
  { q: "Is Sphinx open?", a: "No. Sphinx remains closed until an explicit public launch, and there is no checkout or marketplace for it." },
  { q: "What do yearly prices mean?", a: "Yearly amounts are the planned annual price for each tier: $470 for Practitioner and $1910 for Architect. They apply once billing opens." },
];

export function requestAccessHref(subject: string, body?: string): string {
  const b = body ?? `Hello,\n\nI would like to request access: ${subject}.\n\nName:\nOrganisation:\nUse case:\n`;
  return `mailto:${ACCESS_REQUEST_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(b)}`;
}
