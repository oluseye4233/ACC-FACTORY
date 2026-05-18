import Stripe from "stripe";

async function getStripe(): Promise<Stripe> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const tok = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;
  if (!hostname || !tok) throw new Error("Replit connector env missing");
  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "stripe");
  url.searchParams.set("environment", "development");
  const r = await fetch(url.toString(), {
    headers: { Accept: "application/json", "X-Replit-Token": tok },
  });
  const d = (await r.json()) as { items?: Array<{ settings?: { secret?: string } }> };
  const secret = d.items?.[0]?.settings?.secret;
  if (!secret) throw new Error("No Stripe secret in connection");
  return new Stripe(secret);
}

async function ensureProductWithPrices(
  stripe: Stripe,
  name: string,
  description: string,
  monthly: number,
  yearly: number,
): Promise<{ monthly: string; yearly: string }> {
  let product: Stripe.Product | undefined;
  try {
    const list = await stripe.products.search({ query: `name:"${name}"` });
    product = list.data[0];
  } catch {
    /* search not enabled on every account; fall through */
  }
  if (!product) {
    const all = await stripe.products.list({ limit: 100, active: true });
    product = all.data.find((p) => p.name === name);
  }
  if (!product) {
    product = await stripe.products.create({ name, description });
  }
  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
  async function ensurePrice(amount: number, interval: "month" | "year"): Promise<string> {
    const existing = prices.data.find(
      (p) =>
        p.unit_amount === amount * 100 &&
        p.recurring?.interval === interval &&
        p.currency === "usd",
    );
    if (existing) return existing.id;
    const created = await stripe.prices.create({
      product: product!.id,
      unit_amount: amount * 100,
      currency: "usd",
      recurring: { interval },
    });
    return created.id;
  }
  return {
    monthly: await ensurePrice(monthly, "month"),
    yearly: await ensurePrice(yearly, "year"),
  };
}

async function main(): Promise<void> {
  const stripe = await getStripe();
  const p = await ensureProductWithPrices(
    stripe,
    "ATANDA Command Centre — Practitioner",
    "Higher daily limits across F1–F4, plus F5/F6/F7 unlocks. 30-day free trial.",
    49,
    470,
  );
  const a = await ensureProductWithPrices(
    stripe,
    "ATANDA Command Centre — Architect",
    "Unlimited HARNESS engines, priority queue, public verification, export bundles.",
    199,
    1910,
  );
  console.log(
    JSON.stringify(
      {
        STRIPE_PRICE_PRACTITIONER_MONTHLY: p.monthly,
        STRIPE_PRICE_PRACTITIONER_YEARLY: p.yearly,
        STRIPE_PRICE_ARCHITECT_MONTHLY: a.monthly,
        STRIPE_PRICE_ARCHITECT_YEARLY: a.yearly,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
