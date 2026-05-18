import Stripe from "stripe";

interface ConnectionSettings {
  settings: {
    publishable?: string;
    secret?: string;
    webhook_secret?: string;
  };
}

async function getCredentials(): Promise<{
  publishableKey: string;
  secretKey: string;
  webhookSecret: string | null;
}> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;
  if (!hostname || !xReplitToken) {
    throw new Error("Replit connector environment not available");
  }
  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const targetEnvironment = isProduction ? "production" : "development";
  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "stripe");
  url.searchParams.set("environment", targetEnvironment);
  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json", "X-Replit-Token": xReplitToken },
  });
  const data = (await response.json()) as { items?: ConnectionSettings[] };
  const conn = data.items?.[0];
  if (!conn || !conn.settings.publishable || !conn.settings.secret) {
    throw new Error(`Stripe ${targetEnvironment} connection not found`);
  }
  return {
    publishableKey: conn.settings.publishable,
    secretKey: conn.settings.secret,
    webhookSecret: conn.settings.webhook_secret ?? null,
  };
}

// Always re-fetch — never cache the client.
export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey);
}

export async function getStripeWebhookSecret(): Promise<string | null> {
  try {
    const { webhookSecret } = await getCredentials();
    return webhookSecret ?? process.env.STRIPE_WEBHOOK_SECRET ?? null;
  } catch {
    return process.env.STRIPE_WEBHOOK_SECRET ?? null;
  }
}

export async function isStripeConfigured(): Promise<boolean> {
  try {
    await getCredentials();
    return true;
  } catch {
    return false;
  }
}
