import { createServer } from "node:http";
import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Keep this route test independent of a live database/Stripe account. The two
// rejection paths under test must fail before either dependency is touched.
vi.mock("@workspace/db", () => ({
  arkXAccountLinksTable: {},
  arkXRedemptionsTable: {},
  commandCentreSubscribersTable: {},
  db: {},
}));
vi.mock("../src/lib/auth", () => ({
  requireCustomerAuth: (_req: unknown, res: { status: (status: number) => { json: (body: unknown) => void } }) => {
    res.status(503).json({
      error: "Customer billing authentication is not configured on this deployment",
      code: "CUSTOMER_AUTH_NOT_CONFIGURED",
    });
  },
}));
vi.mock("../src/lib/feature-flags", () => ({
  requireSubscriptionsEnabled: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../src/lib/stripe", () => ({
  getUncachableStripeClient: vi.fn(),
}));

import billingRouter from "../src/routes/billing";

const app = express();
app.use(express.json());
app.use(billingRouter);
const server = createServer(app);
let baseUrl = "";

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server did not bind");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

describe("POST /billing/checkout ARK-X eligibility", () => {
  it("fails closed rather than using the staff-code identity for a non-Architect assertion", async () => {
    const response = await fetch(`${baseUrl}/billing/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tier: "PRACTITIONER",
        interval: "month",
        arkXEligibilityAssertion: "not-used",
      }),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Customer billing authentication is not configured on this deployment",
      code: "CUSTOMER_AUTH_NOT_CONFIGURED",
    });
  });

  it("fails closed before accepting an Architect ARK-X assertion", async () => {
    const response = await fetch(`${baseUrl}/billing/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tier: "ARCHITECT",
        interval: "month",
        arkXEligibilityAssertion: "not.a.jwt",
      }),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Customer billing authentication is not configured on this deployment",
      code: "CUSTOMER_AUTH_NOT_CONFIGURED",
    });
  });
});