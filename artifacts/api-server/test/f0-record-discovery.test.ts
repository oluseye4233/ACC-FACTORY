import express, { type Express, type RequestHandler } from "express";
import { describe, test, expect } from "vitest";
import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  commandCentreSubscribersTable,
  harnessSessionsTable,
  f0EngagementsTable,
  type Subscriber,
  type User,
} from "@workspace/db";
import { handleF0RecordDiscovery } from "../src/routes/f0";

// Directly exercises the record-answers endpoint (PUT
// /f0/engagements/:id/discovery). The report gate (engines/f0.ts) already
// refuses blank/partial discovery at report time; these tests prove the record
// step itself refuses to persist blank/whitespace answers and only advances the
// engagement to ACTIVE once every one of the 7 questions carries a substantive
// answer — so operators can't silently save incomplete discovery.

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
  app.put("/api/f0/engagements/:id/discovery", handleF0RecordDiscovery);
  return app;
}

interface Fixtures {
  user: User;
  subscriber: Subscriber;
  engagementId: string;
}

// A generated (but unanswered) SOCRATES discovery: 7 questions, no answers yet.
function generatedTranscript(): Record<string, unknown> {
  return {
    intro: "Discovery intro",
    questions: Array.from({ length: 7 }, (_, i) => ({
      id: `q${i + 1}`,
      prompt: `Question ${i + 1}?`,
      why: `Because ${i + 1}`,
    })),
    answers: [],
  };
}

function fullAnswers(): Array<{ id: string; answer: string }> {
  return Array.from({ length: 7 }, (_, i) => ({
    id: `q${i + 1}`,
    answer: `Answer ${i + 1}`,
  }));
}

async function seed(): Promise<Fixtures> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [user] = await db
    .insert(usersTable)
    .values({
      clerkUserId: `test_clerk_f0_record_${stamp}`,
      email: `f0-record-${stamp}@example.test`,
      displayName: "F0 Record Test",
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
      sessionName: `f0-record ${stamp}`,
      preferredModelProvider: "claude",
    })
    .returning();
  if (!session) throw new Error("seed: session insert failed");

  const [engagement] = await db
    .insert(f0EngagementsTable)
    .values({
      userId: user.id,
      title: "Record engagement",
      status: "DISCOVERY",
      sessionId: session.id,
      discoveryTranscript: generatedTranscript(),
    })
    .returning();
  if (!engagement) throw new Error("seed: engagement insert failed");

  return { user, subscriber, engagementId: engagement.id };
}

async function cleanup(userId: string): Promise<void> {
  await db.delete(f0EngagementsTable).where(eq(f0EngagementsTable.userId, userId));
  await db.delete(harnessSessionsTable).where(eq(harnessSessionsTable.userId, userId));
  await db
    .delete(commandCentreSubscribersTable)
    .where(eq(commandCentreSubscribersTable.userId, userId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));
}

async function putAnswers(
  url: string,
  engagementId: string,
  answers: Array<{ id: string; answer: string }>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${url}/api/f0/engagements/${engagementId}/discovery`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // leave empty
  }
  return { status: res.status, body };
}

async function startServer(app: Express): Promise<{ url: string; close: () => Promise<void> }> {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no server address");
  return {
    url: `http://127.0.0.1:${addr.port}`,
    close: () => new Promise((resolve) => server.close(() => resolve(undefined))),
  };
}

async function currentEngagement(id: string) {
  const [row] = await db.select().from(f0EngagementsTable).where(eq(f0EngagementsTable.id, id));
  return row;
}

describe("F0 record-answers — no blank answers, coverage-gated status", () => {
  test("rejects a whitespace-only answer with 400 BLANK_ANSWER and persists nothing", async () => {
    const fx = await seed();
    const srv = await startServer(buildApp(fx.user, fx.subscriber));
    try {
      const answers = fullAnswers();
      answers[2]!.answer = "   ";
      const res = await putAnswers(srv.url, fx.engagementId, answers);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("BLANK_ANSWER");

      const row = await currentEngagement(fx.engagementId);
      // Transcript untouched (still zero recorded answers) and still DISCOVERY.
      const transcript = row!.discoveryTranscript as { answers?: unknown[] };
      expect(transcript.answers).toEqual([]);
      expect(row!.status).toBe("DISCOVERY");
    } finally {
      await srv.close();
      await cleanup(fx.user.id);
    }
  });

  test("rejects an empty-string answer with 400 BLANK_ANSWER", async () => {
    const fx = await seed();
    const srv = await startServer(buildApp(fx.user, fx.subscriber));
    try {
      const answers = fullAnswers();
      answers[5]!.answer = "";
      const res = await putAnswers(srv.url, fx.engagementId, answers);
      // An empty string is rejected — either by the schema (minLength:1) or the
      // handler's non-whitespace guard. Both are 400; the handler path names it.
      expect(res.status).toBe(400);

      const row = await currentEngagement(fx.engagementId);
      const transcript = row!.discoveryTranscript as { answers?: unknown[] };
      expect(transcript.answers).toEqual([]);
    } finally {
      await srv.close();
      await cleanup(fx.user.id);
    }
  });

  test("partial coverage (6 of 7) saves the answers but keeps status DISCOVERY", async () => {
    const fx = await seed();
    const srv = await startServer(buildApp(fx.user, fx.subscriber));
    try {
      const answers = fullAnswers().slice(0, 6);
      const res = await putAnswers(srv.url, fx.engagementId, answers);
      expect(res.status).toBe(200);

      const row = await currentEngagement(fx.engagementId);
      const transcript = row!.discoveryTranscript as { answers?: unknown[] };
      expect(transcript.answers).toHaveLength(6);
      // Not fully covered → must NOT advance to ACTIVE.
      expect(row!.status).toBe("DISCOVERY");
    } finally {
      await srv.close();
      await cleanup(fx.user.id);
    }
  });

  test("full substantive coverage advances the engagement to ACTIVE", async () => {
    const fx = await seed();
    const srv = await startServer(buildApp(fx.user, fx.subscriber));
    try {
      const res = await putAnswers(srv.url, fx.engagementId, fullAnswers());
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ACTIVE");

      const row = await currentEngagement(fx.engagementId);
      const transcript = row!.discoveryTranscript as { answers?: unknown[] };
      expect(transcript.answers).toHaveLength(7);
      expect(row!.status).toBe("ACTIVE");
    } finally {
      await srv.close();
      await cleanup(fx.user.id);
    }
  });
});
