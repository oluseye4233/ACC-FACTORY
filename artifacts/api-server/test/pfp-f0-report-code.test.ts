import express, { type Express, type RequestHandler } from "express";
import { describe, test, expect, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  db,
  usersTable,
  commandCentreSubscribersTable,
  harnessSessionsTable,
  harnessArtifactsTable,
  f0ReportCodesTable,
  type Subscriber,
  type User,
} from "@workspace/db";

// PFP is a report-generation event: it persists a PFP_REPORT and, per F0-021,
// mints an F0 advisory report code anchored to the source MVP PDD's SKU. This
// suite stays fixture-free by swapping the Anthropic client for one that returns
// a canned, schema-valid drift report — no network, fully deterministic.
const llm = vi.hoisted(() => {
  const report = {
    verdict: "pass" as const,
    fci: 96,
    summary: "No drift detected between the certified MVP PDD and the bundle.",
    findings: [] as Array<Record<string, unknown>>,
    counts: { critical: 0, high: 0, medium: 0, low: 0 },
  };
  return { responseText: JSON.stringify(report) };
});

vi.mock("@workspace/integrations-anthropic-ai", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@workspace/integrations-anthropic-ai")>();
  return {
    ...actual,
    getAnthropic: () => ({
      messages: {
        create: async () => ({
          content: [{ type: "text", text: llm.responseText }],
          usage: { input_tokens: 40, output_tokens: 30 },
        }),
      },
    }),
  };
});

const { handlePfp } = await import("../src/engines/pfp");

function attachContext(localUser: User, subscriber: Subscriber): RequestHandler {
  return (req, _res, next) => {
    req.localUser = localUser;
    req.subscriber = subscriber;
    const noop = (): void => {};
    (req as unknown as { log: Record<string, unknown> }).log = {
      info: noop,
      warn: noop,
      error: noop,
      debug: noop,
      trace: noop,
      fatal: noop,
      child: () => (req as unknown as { log: unknown }).log,
    };
    next();
  };
}

function buildApp(localUser: User, subscriber: Subscriber): Express {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use(attachContext(localUser, subscriber));
  app.post("/api/harness/pfp", handlePfp);
  return app;
}

interface Fixtures {
  user: User;
  subscriber: Subscriber;
  sessionId: string;
  mvpId: string;
  bundleId: string;
  sku: string;
}

async function seed(sku: string | null): Promise<Fixtures> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [user] = await db
    .insert(usersTable)
    .values({
      clerkUserId: `test_clerk_pfp_f0_${stamp}`,
      email: `pfp-f0-${stamp}@example.test`,
      displayName: "PFP F0 Test",
    })
    .returning();
  if (!user) throw new Error("seed: user insert failed");

  const [subscriber] = await db
    .insert(commandCentreSubscribersTable)
    .values({ userId: user.id, tier: "PRACTITIONER", status: "active" })
    .returning();
  if (!subscriber) throw new Error("seed: subscriber insert failed");

  const [session] = await db
    .insert(harnessSessionsTable)
    .values({
      userId: user.id,
      sessionName: `pfp-f0 ${stamp}`,
      preferredModelProvider: "claude",
    })
    .returning();
  if (!session) throw new Error("seed: session insert failed");

  const [mvp] = await db
    .insert(harnessArtifactsTable)
    .values({
      sessionId: session.id,
      userId: user.id,
      featureId: 7,
      artifactType: "MVP_PDD",
      artifactContent: { title: "Certified MVP PDD" },
      spartanCert: { verdict: "certified", verificationUrl: "https://verify.test/x" },
      sku,
    })
    .returning();
  if (!mvp) throw new Error("seed: MVP PDD insert failed");

  const [bundle] = await db
    .insert(harnessArtifactsTable)
    .values({
      sessionId: session.id,
      userId: user.id,
      featureId: 8,
      artifactType: "CODEBASE_BUNDLE",
      artifactContent: { platform: "node", files: [] },
    })
    .returning();
  if (!bundle) throw new Error("seed: codebase bundle insert failed");

  return {
    user,
    subscriber,
    sessionId: session.id,
    mvpId: mvp.id,
    bundleId: bundle.id,
    sku: sku ?? "",
  };
}

async function cleanup(userId: string): Promise<void> {
  await db.delete(usersTable).where(eq(usersTable.id, userId));
}

async function startServer(app: Express): Promise<{ url: string; close: () => Promise<void> }> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no server address");
  return {
    url: `http://127.0.0.1:${addr.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function postPfp(
  url: string,
  body: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${url}/api/harness/pfp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = { _raw: text };
  }
  return { status: res.status, json };
}

describe("PFP report generation assigns an F0 report code (F0-021)", () => {
  test("mints a [CODE]-[SKU]-[TIMESTAMP] code anchored to the MVP PDD's SKU", async () => {
    const sku = "ARK-PDD-GEN-abc123-0001-V1";
    const fx = await seed(sku);
    const srv = await startServer(buildApp(fx.user, fx.subscriber));
    try {
      const res = await postPfp(srv.url, {
        sessionId: fx.sessionId,
        mvpPddArtifactId: fx.mvpId,
        codebaseBundleArtifactId: fx.bundleId,
        provider: "claude",
      });
      expect(res.status, JSON.stringify(res.json).slice(0, 400)).toBe(200);

      const f0ReportCode = res.json.f0ReportCode as string;
      expect(f0ReportCode).toMatch(/^PFP-ARK-PDD-GEN-abc123-0001-V1-\d{14}$/);

      const rows = await db
        .select()
        .from(f0ReportCodesTable)
        .where(eq(f0ReportCodesTable.userId, fx.user.id));
      expect(rows.length).toBe(1);
      const row = rows[0]!;
      expect(row.code).toBe("PFP");
      expect(row.sku).toBe(sku);
      expect(row.reportCode).toBe(f0ReportCode);
      // The report code is anchored to the persisted PFP_REPORT artifact.
      expect(row.artifactId).toBe(res.json.artifactId);
    } finally {
      await srv.close();
      await cleanup(fx.user.id);
    }
  });

  test("skips the F0 code (null) when the source MVP PDD has no SKU", async () => {
    const fx = await seed(null);
    const srv = await startServer(buildApp(fx.user, fx.subscriber));
    try {
      const res = await postPfp(srv.url, {
        sessionId: fx.sessionId,
        mvpPddArtifactId: fx.mvpId,
        codebaseBundleArtifactId: fx.bundleId,
        provider: "claude",
      });
      expect(res.status, JSON.stringify(res.json).slice(0, 400)).toBe(200);
      expect(res.json.f0ReportCode).toBeNull();

      const rows = await db
        .select()
        .from(f0ReportCodesTable)
        .where(eq(f0ReportCodesTable.userId, fx.user.id));
      expect(rows.length).toBe(0);
    } finally {
      await srv.close();
      await cleanup(fx.user.id);
    }
  });
});
