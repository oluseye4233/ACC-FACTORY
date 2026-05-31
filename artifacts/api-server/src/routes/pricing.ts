import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, pricingContentTable } from "@workspace/db";
import { PutPricingBody } from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../lib/auth";

const router: IRouter = Router();
const KEY = "pricing.default";

const DEFAULT_PRICING = {
  tiers: [
    {
      id: "EXPLORER",
      name: "Explorer",
      tagline: "Try the engines",
      priceMonthly: 0,
      priceYearly: 0,
      priceLabel: "Free",
      ctaLabel: "Get started",
      featured: false,
      features: [
        "F1 ATLAS Diagnostic (5/day)",
        "F2 Atomic Prompt Builder (3/day)",
        "F3 CELL MA Builder (1/day)",
        "F4 Micro PDD (1/day)",
        "Community support",
      ],
    },
    {
      id: "PRACTITIONER",
      name: "Practitioner",
      tagline: "Build real artifacts",
      priceMonthly: 49,
      priceYearly: 470,
      priceLabel: null,
      ctaLabel: "Subscribe",
      featured: true,
      features: [
        "Higher daily limits across F1–F4",
        "Unlock F5 SPC Builder",
        "Unlock F6 PDD Drafter + VIBE ORACLE",
        "Unlock F7 SPARTAN Compressor",
        "SPARTAN certificate issuance",
        "Email support",
      ],
    },
    {
      id: "ARCHITECT",
      name: "Architect",
      tagline: "Unlimited HARNESS",
      priceMonthly: 199,
      priceYearly: 1910,
      priceLabel: null,
      ctaLabel: "Subscribe",
      featured: false,
      features: [
        "Unlimited F1–F7 runs",
        "Priority engine queue",
        "Public certificate verification",
        "Session export bundles",
        "Priority support",
      ],
    },
    {
      id: "INSTITUTION",
      name: "Institution",
      tagline: "Custom rollout",
      priceMonthly: null,
      priceYearly: null,
      priceLabel: "Custom",
      ctaLabel: "Contact sales",
      featured: false,
      features: [
        "Team seats + roles",
        "SSO / SAML",
        "Custom SPC libraries",
        "Dedicated support engineer",
        "SLA + DPA",
      ],
    },
  ],
  faqs: [
    { q: "Can I switch plans later?", a: "Yes — upgrade or downgrade from the billing portal at any time." },
    { q: "What's a JCSE score?", a: "Junglenomics Composite Score Estimate — the composite AI agent quality score (0–50) computed from the 7 Context Craft pillars, feeding HIVE cert tiers BRONZE→PLATINUM." },
    { q: "Are F5–F7 metered?", a: "Practitioner is metered daily; Architect is unlimited." },
    { q: "How is escalation handled?", a: "F3 may escalate to F5 SPC mode automatically — escalation bypasses tier gates for that session." },
    { q: "Do you store my prompts?", a: "Yes, in your own session. Delete a session to delete its artifacts." },
    { q: "Can I export artifacts?", a: "Yes — JSON, Markdown and packaged bundles are supported." },
    { q: "Which model powers HARNESS?", a: "Claude Sonnet 4 via Anthropic API." },
    { q: "Is there a free trial of paid tiers?", a: "Explorer is free forever — paid tiers bill monthly with cancel-anytime." },
  ],
  trust: [
    { label: "Stripe-secured payments", icon: null },
    { label: "EU data residency on request", icon: null },
    { label: "Audit-logged certificates", icon: null },
  ],
  updatedAt: null,
};

router.get("/pricing", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(pricingContentTable)
    .where(eq(pricingContentTable.key, KEY))
    .limit(1);
  if (rows.length === 0) {
    res.json(DEFAULT_PRICING);
    return;
  }
  const row = rows[0]!;
  res.json({
    ...(row.content as Record<string, unknown>),
    updatedAt: row.updatedAt.toISOString(),
  });
});

router.put(
  "/admin/pricing",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = PutPricingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { updatedAt: _ignored, ...content } = parsed.data;
    const existing = await db
      .select()
      .from(pricingContentTable)
      .where(eq(pricingContentTable.key, KEY))
      .limit(1);
    let row;
    if (existing.length === 0) {
      [row] = await db
        .insert(pricingContentTable)
        .values({ key: KEY, content })
        .returning();
    } else {
      [row] = await db
        .update(pricingContentTable)
        .set({ content })
        .where(eq(pricingContentTable.key, KEY))
        .returning();
    }
    res.json({
      ...(row!.content as Record<string, unknown>),
      updatedAt: row!.updatedAt.toISOString(),
    });
  },
);

export default router;
