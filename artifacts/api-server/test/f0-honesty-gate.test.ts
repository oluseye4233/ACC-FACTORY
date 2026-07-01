import express, { type Express, type RequestHandler } from "express";
import { describe, test, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  commandCentreSubscribersTable,
  harnessSessionsTable,
  harnessArtifactsTable,
  f0EngagementsTable,
  f0ReportsTable,
  f0ReportCodesTable,
  type Subscriber,
  type User,
} from "@workspace/db";

// The Honesty Gate is enforced by the F0 ReportSchema that callLlmJson validates
// every ensemble report against: a report with no SOLVA bear-case, or without
// all three (bear/base/bull) financial scenarios, must fail schema validation
// and never be persisted. This suite drives the real report handler end-to-end
// with a swapped-in Anthropic client that returns a controllable canned body —
// no network, fully deterministic — so we can assert the gate rejects dishonest
// reports and that valid reports anchor their code to the artifact SKU.
const llm = vi.hoisted(() => ({ responseText: "" }));

// The report handler kicks off the LLM promise, then streams ~1.5s of SSE step
// events before awaiting it. If the mock resolves-then-rejects synchronously
// (schema-invalid body), the rejection lands before the await attaches its
// handler and Node flags a spurious unhandled rejection. A small delay > the
// step-loop duration keeps the promise pending until the handler awaits it, so
// the gate's rejection is caught exactly as it is in production.
const LLM_DELAY_MS = 2000;

vi.mock("@workspace/integrations-anthropic-ai", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@workspace/integrations-anthropic-ai")>();
  return {
    ...actual,
    getAnthropic: () => ({
      messages: {
        create: async () => {
          await new Promise((r) => setTimeout(r, LLM_DELAY_MS));
          return {
            content: [{ type: "text", text: llm.responseText }],
            usage: { input_tokens: 50, output_tokens: 40 },
          };
        },
      },
    }),
  };
});

const { handleF0GenerateReportStream } = await import("../src/engines/f0");

// A fully honest, schema-valid report body: 3 findings, a SOLVA bear-case with
// 3 arguments, all three (bear/base/bull) financial scenarios, the Honesty Gate
// disclosure, and 2 recommendations.
function validReport(): Record<string, unknown> {
  const scenario = (tag: string) => ({
    assumptions: [`${tag} assumption`],
    lineItems: [{ label: "Revenue", value: `${tag} value` }],
  });
  return {
    executivePosition: "Proceed with disciplined caution.",
    findings: [
      { title: "Finding A", detail: "Detail A", evidenceBasis: "Basis A" },
      { title: "Finding B", detail: "Detail B", evidenceBasis: "Basis B" },
      { title: "Finding C", detail: "Detail C", evidenceBasis: "Basis C" },
    ],
    solvaBearCase: {
      thesis: "The idea could fail if demand never materialises.",
      arguments: ["Weak differentiation", "Long sales cycle", "High CAC"],
    },
    financials: {
      currency: "USD",
      scenarios: { bear: scenario("bear"), base: scenario("base"), bull: scenario("bull") },
    },
    honestyGate: {
      modelledVsSourced: "70% modelled, 30% sourced from the transcript.",
      confidence: "MEDIUM",
      biggestReasonToDistrust: "No primary market data was supplied.",
    },
    recommendations: [
      { action: "Run 10 customer interviews", rationale: "De-risk demand" },
      { action: "Ship a paid pilot", rationale: "Prove willingness to pay" },
    ],
  };
}

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
  app.post("/api/f0/engagements/:id/reports", handleF0GenerateReportStream);
  return app;
}

interface Fixtures {
  user: User;
  subscriber: Subscriber;
  sessionId: string;
  artifactId: string;
  engagementId: string;
  sku: string;
}

const ARTIFACT_SKU = "ARK-SPC-GEN-abc123-0001-V1";

// A completed SOCRATES discovery: 7 questions + at least one recorded answer.
function completedTranscript(): Record<string, unknown> {
  return {
    intro: "Discovery intro",
    questions: Array.from({ length: 7 }, (_, i) => ({
      id: `q${i + 1}`,
      prompt: `Question ${i + 1}?`,
      why: `Because ${i + 1}`,
    })),
    answers: [{ id: "q1", answer: "An answer" }],
  };
}

// `undefined` = seed with the default completed transcript; `null` = no
// discovery transcript at all; any object = an explicit (possibly incomplete)
// transcript.
async function seed(
  transcriptOverride?: Record<string, unknown> | null,
): Promise<Fixtures> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [user] = await db
    .insert(usersTable)
    .values({
      clerkUserId: `test_clerk_f0_gate_${stamp}`,
      email: `f0-gate-${stamp}@example.test`,
      displayName: "F0 Gate Test",
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
      sessionName: `f0-gate ${stamp}`,
      preferredModelProvider: "claude",
    })
    .returning();
  if (!session) throw new Error("seed: session insert failed");

  const [artifact] = await db
    .insert(harnessArtifactsTable)
    .values({
      sessionId: session.id,
      userId: user.id,
      featureId: 5,
      artifactType: "SPC",
      artifactContent: { title: "The SPC this engagement advises on" },
      sku: ARTIFACT_SKU,
    })
    .returning();
  if (!artifact) throw new Error("seed: artifact insert failed");

  // By default seed a completed SOCRATES discovery (7 questions + at least one
  // recorded answer) so the DISCOVERY_REQUIRED precondition passes and we reach
  // the gate. Callers can pass `null` for no transcript, or an explicit
  // (possibly incomplete) transcript to exercise the precondition itself.
  const transcript =
    transcriptOverride === undefined ? completedTranscript() : transcriptOverride;

  const [engagement] = await db
    .insert(f0EngagementsTable)
    .values({
      userId: user.id,
      title: "Gate engagement",
      status: "DISCOVERY",
      sessionId: session.id,
      artifactId: artifact.id,
      discoveryTranscript: transcript,
    })
    .returning();
  if (!engagement) throw new Error("seed: engagement insert failed");

  return {
    user,
    subscriber,
    sessionId: session.id,
    artifactId: artifact.id,
    engagementId: engagement.id,
    sku: ARTIFACT_SKU,
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

interface SseEvent {
  event: string;
  data: Record<string, unknown>;
}

async function postReport(
  url: string,
  engagementId: string,
  body: Record<string, unknown>,
): Promise<{ status: number; events: SseEvent[] }> {
  const res = await fetch(`${url}/api/f0/engagements/${engagementId}/reports`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const events: SseEvent[] = [];
  for (const chunk of text.split("\n\n")) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const eventLine = trimmed.split("\n").find((l) => l.startsWith("event: "));
    const dataLine = trimmed.split("\n").find((l) => l.startsWith("data: "));
    if (!eventLine || !dataLine) continue;
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(dataLine.slice("data: ".length)) as Record<string, unknown>;
    } catch {
      // ignore non-JSON data lines
    }
    events.push({ event: eventLine.slice("event: ".length), data });
  }
  return { status: res.status, events };
}

describe("F0 Honesty Gate — non-suppressible on every report", () => {
  beforeEach(() => {
    llm.responseText = "";
  });

  test("a report missing the SOLVA bear-case is rejected and never persisted", async () => {
    const report = validReport();
    delete report.solvaBearCase;
    llm.responseText = JSON.stringify(report);

    const fx = await seed();
    const srv = await startServer(buildApp(fx.user, fx.subscriber));
    try {
      const res = await postReport(srv.url, fx.engagementId, {
        service: "PRODUCT_VIABILITY",
        provider: "claude",
      });

      // The stream opens 200 (SSE) but must terminate with an error event, not
      // a complete event — the gate fired inside callLlmJson.
      expect(res.status).toBe(200);
      const complete = res.events.find((e) => e.event === "complete");
      const error = res.events.find((e) => e.event === "error");
      expect(complete).toBeUndefined();
      expect(error, JSON.stringify(res.events)).toBeDefined();
      expect(error!.data.code).toBe("ENGINE_CALL_FAILED");

      // Nothing dishonest reached the database.
      const reports = await db
        .select()
        .from(f0ReportsTable)
        .where(eq(f0ReportsTable.userId, fx.user.id));
      expect(reports.length).toBe(0);
      const codes = await db
        .select()
        .from(f0ReportCodesTable)
        .where(eq(f0ReportCodesTable.userId, fx.user.id));
      expect(codes.length).toBe(0);
    } finally {
      await srv.close();
      await cleanup(fx.user.id);
    }
  });

  test("a report missing the bull scenario fails the bear/base/bull range gate", async () => {
    const report = validReport();
    const financials = report.financials as { scenarios: Record<string, unknown> };
    delete financials.scenarios.bull;
    llm.responseText = JSON.stringify(report);

    const fx = await seed();
    const srv = await startServer(buildApp(fx.user, fx.subscriber));
    try {
      const res = await postReport(srv.url, fx.engagementId, {
        service: "PRODUCT_VIABILITY",
        provider: "claude",
      });
      const complete = res.events.find((e) => e.event === "complete");
      const error = res.events.find((e) => e.event === "error");
      expect(complete).toBeUndefined();
      expect(error, JSON.stringify(res.events)).toBeDefined();
      expect(error!.data.code).toBe("ENGINE_CALL_FAILED");

      const reports = await db
        .select()
        .from(f0ReportsTable)
        .where(eq(f0ReportsTable.userId, fx.user.id));
      expect(reports.length).toBe(0);
    } finally {
      await srv.close();
      await cleanup(fx.user.id);
    }
  });

  test("a report with too few SOLVA arguments (2 < 3) fails the gate", async () => {
    const report = validReport();
    (report.solvaBearCase as { arguments: string[] }).arguments = ["only", "two"];
    llm.responseText = JSON.stringify(report);

    const fx = await seed();
    const srv = await startServer(buildApp(fx.user, fx.subscriber));
    try {
      const res = await postReport(srv.url, fx.engagementId, {
        service: "PRODUCT_VIABILITY",
        provider: "claude",
      });
      expect(res.events.find((e) => e.event === "complete")).toBeUndefined();
      expect(res.events.find((e) => e.event === "error")).toBeDefined();

      const reports = await db
        .select()
        .from(f0ReportsTable)
        .where(eq(f0ReportsTable.userId, fx.user.id));
      expect(reports.length).toBe(0);
    } finally {
      await srv.close();
      await cleanup(fx.user.id);
    }
  });

  test("an honest report passes the gate, persists, and anchors its code to the artifact SKU", async () => {
    llm.responseText = JSON.stringify(validReport());

    const fx = await seed();
    const srv = await startServer(buildApp(fx.user, fx.subscriber));
    try {
      const res = await postReport(srv.url, fx.engagementId, {
        service: "PRODUCT_VIABILITY",
        provider: "claude",
      });
      const complete = res.events.find((e) => e.event === "complete");
      expect(res.events.find((e) => e.event === "error")).toBeUndefined();
      expect(complete, JSON.stringify(res.events).slice(0, 400)).toBeDefined();

      // The persisted report anchors to the SPC artifact's SKU, not a freshly
      // minted advisory SKU.
      const reports = await db
        .select()
        .from(f0ReportsTable)
        .where(eq(f0ReportsTable.userId, fx.user.id));
      expect(reports.length).toBe(1);
      const row = reports[0]!;
      expect(row.sku).toBe(fx.sku);
      expect(row.service).toBe("PRODUCT_VIABILITY");
      expect(row.reportCode).toBe(`F0-PV-${fx.sku}-${row.reportCode.split("-").pop()}`);
      expect(row.reportCode).toMatch(new RegExp(`^F0-PV-${fx.sku}-\\d{14}$`));

      // The report-code registry row is anchored to the same SKU + artifact.
      const codes = await db
        .select()
        .from(f0ReportCodesTable)
        .where(eq(f0ReportCodesTable.userId, fx.user.id));
      expect(codes.length).toBe(1);
      const code = codes[0]!;
      expect(code.code).toBe("F0-PV");
      expect(code.sku).toBe(fx.sku);
      expect(code.artifactId).toBe(fx.artifactId);
      expect(code.reportCode).toBe(row.reportCode);
    } finally {
      await srv.close();
      await cleanup(fx.user.id);
    }
  });
});

describe("F0 discovery precondition — no report before SOCRATES is complete", () => {
  beforeEach(() => {
    // A valid report body: proves any rejection is the discovery precondition
    // firing before the LLM, not a downstream Honesty-Gate schema failure.
    llm.responseText = JSON.stringify(validReport());
  });

  // Posts a report request and returns the HTTP status plus the parsed JSON
  // body. Used for the precondition path, which rejects with a plain 409 JSON
  // body before any SSE stream opens.
  async function postReportJson(
    url: string,
    engagementId: string,
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    const res = await fetch(`${url}/api/f0/engagements/${engagementId}/reports`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ service: "PRODUCT_VIABILITY", provider: "claude" }),
    });
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // non-JSON (e.g. SSE) — leave body empty so callers can assert on it
    }
    return { status: res.status, body };
  }

  // Drives the handler and asserts it rejected with 409 DISCOVERY_REQUIRED and
  // wrote nothing to f0_reports / f0_report_codes.
  async function expectDiscoveryRejected(fx: Fixtures): Promise<void> {
    const srv = await startServer(buildApp(fx.user, fx.subscriber));
    try {
      const res = await postReportJson(srv.url, fx.engagementId);
      expect(res.status).toBe(409);
      expect(res.body.error).toBe("DISCOVERY_REQUIRED");

      const reports = await db
        .select()
        .from(f0ReportsTable)
        .where(eq(f0ReportsTable.userId, fx.user.id));
      expect(reports.length).toBe(0);
      const codes = await db
        .select()
        .from(f0ReportCodesTable)
        .where(eq(f0ReportCodesTable.userId, fx.user.id));
      expect(codes.length).toBe(0);
    } finally {
      await srv.close();
    }
  }

  test("rejects with 409 DISCOVERY_REQUIRED when there is no discovery transcript", async () => {
    const fx = await seed(null);
    try {
      await expectDiscoveryRejected(fx);
    } finally {
      await cleanup(fx.user.id);
    }
  });

  test("rejects when questions are missing", async () => {
    const fx = await seed({ intro: "Discovery intro", answers: [{ id: "q1", answer: "An answer" }] });
    try {
      await expectDiscoveryRejected(fx);
    } finally {
      await cleanup(fx.user.id);
    }
  });

  test("rejects when questions are incomplete (fewer than 7)", async () => {
    const partial = completedTranscript();
    (partial.questions as unknown[]).length = 6;
    const fx = await seed(partial);
    try {
      await expectDiscoveryRejected(fx);
    } finally {
      await cleanup(fx.user.id);
    }
  });

  test("rejects when there are zero answers even though all 7 questions exist", async () => {
    const noAnswers = completedTranscript();
    noAnswers.answers = [];
    const fx = await seed(noAnswers);
    try {
      await expectDiscoveryRejected(fx);
    } finally {
      await cleanup(fx.user.id);
    }
  });
});
