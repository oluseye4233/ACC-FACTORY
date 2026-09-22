import { randomUUID } from "node:crypto";
import cookieParser from "cookie-parser";
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { db, usersTable } from "@workspace/db";
import { STAFF_CLERK_PREFIX } from "../src/lib/staff-auth";

process.env.SUBSCRIPTIONS_ENABLED = "false";

const mocks = vi.hoisted(() => ({
  callLlmJson: vi.fn(),
}));

vi.mock("../src/lib/ingestion-credits", () => ({
  claimIngestionCredit: vi.fn(),
  getIngestionCreditsSummary: vi.fn(),
  IngestionCreditReservationLostError: class extends Error {},
  linkCreditToDocument: vi.fn(),
  releaseIngestionCredit: vi.fn(),
}));

vi.mock("../src/engines/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/engines/shared")>();
  return { ...actual, callLlmJson: mocks.callLlmJson };
});

function requestLogger(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const noop = (): void => {};
  (req as Request & { log: Record<string, unknown> }).log = {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    trace: noop,
    fatal: noop,
    child: () => (req as Request & { log: unknown }).log,
  };
  next();
}

async function startApp(
  sessionSecret: string,
): Promise<{ url: string; close: () => Promise<void> }> {
  const [staffAuthRouter, ingestRouter] = await Promise.all([
    import("../src/routes/staff-auth").then((module) => module.default),
    import("../src/routes/ingest").then((module) => module.default),
  ]);
  const app: Express = express();
  app.use(express.json());
  app.use(cookieParser(sessionSecret));
  app.use(requestLogger);
  app.use("/api", staffAuthRouter);
  app.use("/api", ingestRouter);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("No test server address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function ingestionForm(): FormData {
  const form = new FormData();
  form.set(
    "file",
    new Blob(["Real staff cookie upload source ".repeat(8)], {
      type: "text/plain",
    }),
    "staff-cookie-upload.txt",
  );
  return form;
}

describe("real staff cookie multipart authentication", () => {
  const originalAccessCode = process.env.STAFF_ACCESS_CODE;
  const originalSessionSecret = process.env.SESSION_SECRET;
  const accessCode = randomUUID();
  const sessionSecret = `${randomUUID()}${randomUUID()}`;
  const staffName = `Cookie Upload ${randomUUID()}`;
  let staffHandle: string;
  let server: Awaited<ReturnType<typeof startApp>>;

  beforeAll(async () => {
    process.env.STAFF_ACCESS_CODE = accessCode;
    process.env.SESSION_SECRET = sessionSecret;
    server = await startApp(sessionSecret);
  });

  afterAll(async () => {
    await server?.close();
    if (staffHandle) {
      await db
        .delete(usersTable)
        .where(eq(usersTable.clerkUserId, `${STAFF_CLERK_PREFIX}${staffHandle}`));
    }
    if (originalAccessCode === undefined) delete process.env.STAFF_ACCESS_CODE;
    else process.env.STAFF_ACCESS_CODE = originalAccessCode;
    if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSessionSecret;
  });

  test("missing, invalid, and login-issued cookies produce 401, 401, and 201", async () => {
    const missing = await fetch(`${server.url}/api/ingest`, {
      method: "POST",
      body: ingestionForm(),
    });
    expect(missing.status).toBe(401);

    const invalid = await fetch(`${server.url}/api/ingest`, {
      method: "POST",
      headers: { cookie: "atanda_staff=s%3Ainvalid.invalid-signature" },
      body: ingestionForm(),
    });
    expect(invalid.status).toBe(401);

    const login = await fetch(`${server.url}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: accessCode, name: staffName }),
    });
    const loginBody = (await login.json()) as { handle?: string };
    expect(login.status).toBe(200);
    expect(loginBody.handle).toBeTruthy();
    staffHandle = loginBody.handle!;

    const setCookie = login.headers.get("set-cookie");
    expect(setCookie).toContain("atanda_staff=");
    expect(setCookie).toContain("HttpOnly");
    const cookie = setCookie!.split(";", 1)[0]!;

    mocks.callLlmJson.mockResolvedValueOnce({
      detectedTitle: "Authenticated staff upload",
      sourceDocKind: "product_design_document",
      summary:
        "A document uploaded through a login-issued signed staff session cookie.",
      seedPrompt:
        "Build a reliable authenticated multipart upload flow using signed staff sessions.",
    });

    const valid = await fetch(`${server.url}/api/ingest`, {
      method: "POST",
      headers: { cookie },
      body: ingestionForm(),
    });
    const validBody = (await valid.json()) as Record<string, unknown>;
    expect(valid.status, JSON.stringify(validBody)).toBe(201);
    expect(validBody.originalFilename).toBe("staff-cookie-upload.txt");
  });
});