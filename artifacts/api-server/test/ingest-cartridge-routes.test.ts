import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import {
  cartridgePackagesTable,
  commandCentreSubscribersTable,
  db,
  harnessFeatureStateTable,
  harnessSessionsTable,
  ingestionCreditsTable,
  ingestionDocumentsTable,
  usersTable,
  type Subscriber,
  type User,
} from "@workspace/db";

process.env.SUBSCRIPTIONS_ENABLED = "false";

const mocks = vi.hoisted(() => ({
  claimIngestionCredit: vi.fn(),
  linkCreditToDocument: vi.fn(),
  releaseIngestionCredit: vi.fn(),
  claimCartridgeCredit: vi.fn(),
  linkCreditToCartridge: vi.fn(),
  releaseCartridgeCredit: vi.fn(),
  callLlmJson: vi.fn(),
}));

vi.mock("../src/lib/auth", () => ({
  requireAuth: (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    if (req.headers["x-test-auth"] !== "staff") {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  },
}));

vi.mock("../src/lib/ingestion-credits", () => ({
  claimIngestionCredit: mocks.claimIngestionCredit,
  getIngestionCreditsSummary: vi.fn(),
  IngestionCreditReservationLostError: class extends Error {},
  linkCreditToDocument: mocks.linkCreditToDocument,
  releaseIngestionCredit: mocks.releaseIngestionCredit,
}));

vi.mock("../src/lib/cartridge-credits", () => ({
  claimCartridgeCredit: mocks.claimCartridgeCredit,
  getCartridgeCreditsSummary: vi.fn(),
  linkCreditToCartridge: mocks.linkCreditToCartridge,
  releaseCartridgeCredit: mocks.releaseCartridgeCredit,
}));

vi.mock("../src/engines/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/engines/shared")>();
  return { ...actual, callLlmJson: mocks.callLlmJson };
});

function injectContext(user: User, subscriber: Subscriber) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.localUser = user;
    req.subscriber = subscriber;
    req.effectiveTier =
      req.headers["x-test-effective-tier"] === "EXPLORER"
        ? "EXPLORER"
        : "INSTITUTION";
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

async function startApp(
  user: User,
  subscriber: Subscriber,
): Promise<{ url: string; close: () => Promise<void> }> {
  const [sessionsRouter, ingestRouter, cartridgeRouter] = await Promise.all([
    import("../src/routes/sessions").then((m) => m.default),
    import("../src/routes/ingest").then((m) => m.default),
    import("../src/routes/cartridge").then((m) => m.default),
  ]);
  const app: Express = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(injectContext(user, subscriber));
  app.use("/api", sessionsRouter);
  app.use("/api", ingestRouter);
  app.use("/api", cartridgeRouter);
  app.use(
    (
      err: unknown,
      _req: Request,
      res: Response,
      _next: NextFunction,
    ): void => {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal server error",
      });
    },
  );
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

function cartridgeForm(): FormData {
  const form = new FormData();
  form.set("projectName", "Staff cartridge route test");
  form.set("outcomeOneLiner", "Prove staff can create cartridges without credits.");
  form.set(
    "scopeStatement",
    "Build a focused authenticated route harness that validates multipart uploads, visible extraction failures, and atomic session creation.",
  );
  return form;
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

let user: User;
let subscriber: Subscriber;
let server: Awaited<ReturnType<typeof startApp>>;

beforeAll(async () => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  [user] = await db
    .insert(usersTable)
    .values({
      clerkUserId: `upload_route_${stamp}`,
      email: `upload-route-${stamp}@example.test`,
      displayName: "Upload Route Test",
      role: "ADMIN",
    })
    .returning();
  [subscriber] = await db
    .insert(commandCentreSubscribersTable)
    .values({
      userId: user!.id,
      tier: "INSTITUTION",
      status: "active",
    })
    .returning();
  server = await startApp(user!, subscriber!);
});

afterAll(async () => {
  await server?.close();
  if (user) await db.delete(usersTable).where(eq(usersTable.id, user.id));
});

describe("authenticated Ingestion and Cartridge multipart routes", () => {
  test("staff-mode Ingestion succeeds without claiming an ingestion credit", async () => {
    mocks.callLlmJson.mockResolvedValueOnce({
      detectedTitle: "Staff ingestion",
      sourceDocKind: "product_design_document",
      summary:
        "A sufficiently detailed source document used to verify staff ingestion.",
      seedPrompt:
        "I want to build a reliable authenticated multipart ingestion route with clear validation and atomic downstream session creation.",
    });
    const form = new FormData();
    form.set(
      "file",
      new Blob(["Staff ingestion source ".repeat(8)], { type: "text/plain" }),
      "staff-ingestion.txt",
    );

    const response = await fetch(`${server.url}/api/ingest`, {
      method: "POST",
      headers: { "x-test-auth": "staff" },
      body: form,
    });
    const body = await json(response);

    expect(response.status, JSON.stringify(body)).toBe(201);
    expect(body.originalFilename).toBe("staff-ingestion.txt");
    expect(mocks.claimIngestionCredit).not.toHaveBeenCalled();
  });

  test("staff-mode Cartridge succeeds without claiming a cartridge credit", async () => {
    const response = await fetch(`${server.url}/api/cartridge`, {
      method: "POST",
      headers: { "x-test-auth": "staff" },
      body: cartridgeForm(),
    });
    const body = await json(response);

    expect(response.status, JSON.stringify(body)).toBe(201);
    expect(body.projectName).toBe("Staff cartridge route test");
    expect(mocks.claimCartridgeCredit).not.toHaveBeenCalled();
  });

  test("a simulated project can start from Prompt, Ingestion, and Cartridge", async () => {
    mocks.callLlmJson.mockReset();
    mocks.callLlmJson.mockResolvedValue({
      detectedTitle: "Three-entry project",
      sourceDocKind: "product_design_document",
      summary: "A project used to exercise all three F-process entry points.",
      seedPrompt:
        "Build a reliable project workflow that can begin from a prompt, an ingested document, or a cartridge.",
    });

    const promptResponse = await fetch(`${server.url}/api/sessions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-test-auth": "staff",
      },
      body: JSON.stringify({ sessionName: "Three-entry Prompt" }),
    });
    const prompt = await json(promptResponse);
    expect(promptResponse.status, JSON.stringify(prompt)).toBe(201);

    const ingestionForm = new FormData();
    ingestionForm.set(
      "file",
      new Blob(["Three-entry ingestion source ".repeat(8)], { type: "text/plain" }),
      "three-entry.txt",
    );
    const ingestionResponse = await fetch(`${server.url}/api/ingest`, {
      method: "POST",
      headers: { "x-test-auth": "staff" },
      body: ingestionForm,
    });
    const ingestion = await json(ingestionResponse);
    expect(ingestionResponse.status, JSON.stringify(ingestion)).toBe(201);

    const ingestionSessionResponse = await fetch(
      `${server.url}/api/ingest/${String(ingestion.id)}/start-session`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-test-auth": "staff",
        },
        body: JSON.stringify({ sessionName: "Three-entry Ingestion" }),
      },
    );
    const ingestionSession = await json(ingestionSessionResponse);
    expect(ingestionSessionResponse.status, JSON.stringify(ingestionSession)).toBe(201);

    const cartridgeResponse = await fetch(`${server.url}/api/cartridge`, {
      method: "POST",
      headers: { "x-test-auth": "staff" },
      body: cartridgeForm(),
    });
    const cartridge = await json(cartridgeResponse);
    expect(cartridgeResponse.status, JSON.stringify(cartridge)).toBe(201);

    const cartridgeSessionResponse = await fetch(
      `${server.url}/api/cartridge/${String(cartridge.id)}/start-session`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-test-auth": "staff",
        },
        body: JSON.stringify({ sessionName: "Three-entry Cartridge" }),
      },
    );
    const cartridgeSession = await json(cartridgeSessionResponse);
    expect(cartridgeSessionResponse.status, JSON.stringify(cartridgeSession)).toBe(201);

    const sessionCases = [
      { session: prompt, origin: "manual", expected: ["AVAILABLE", "LOCKED", "LOCKED", "LOCKED", "LOCKED", "LOCKED", "LOCKED"] },
      { session: ingestionSession, origin: "ingested", expected: ["AVAILABLE", "LOCKED", "LOCKED", "LOCKED", "LOCKED", "LOCKED", "LOCKED"] },
      { session: cartridgeSession, origin: "cartridge", expected: ["AVAILABLE", "AVAILABLE", "AVAILABLE", "AVAILABLE", "AVAILABLE", "AVAILABLE", "AVAILABLE"] },
    ] as const;

    for (const item of sessionCases) {
      const sessionId = String(item.session.id);
      expect(item.session.origin).toBe(item.origin);
      const states = await db
        .select({ featureId: harnessFeatureStateTable.featureId, status: harnessFeatureStateTable.status })
        .from(harnessFeatureStateTable)
        .where(eq(harnessFeatureStateTable.sessionId, sessionId));
      expect(states.sort((a, b) => a.featureId - b.featureId).map((state) => state.status)).toEqual(item.expected);
    }
  });

  test("oversized Ingestion returns a stable structured 400", async () => {
    const form = new FormData();
    form.set(
      "file",
      new Blob([Buffer.alloc(1024 * 1024 + 1)], {
        type: "text/plain",
      }),
      "oversized.txt",
    );
    const response = await fetch(`${server.url}/api/ingest`, {
      method: "POST",
      headers: { "x-test-auth": "staff" },
      body: form,
    });

    expect(response.status).toBe(400);
    expect(await json(response)).toEqual({
      error: '"oversized.txt" is too large. Maximum upload size is 1 MB.',
      code: "FILE_TOO_LARGE",
      filename: "oversized.txt",
    });
  });

  test("unsupported, unreadable, and too-short Ingestion files expose filename-specific errors", async () => {
    const unsupported = new FormData();
    unsupported.set(
      "file",
      new Blob(["not a supported document"], {
        type: "application/octet-stream",
      }),
      "requirements.bin",
    );
    const unsupportedResponse = await fetch(`${server.url}/api/ingest`, {
      method: "POST",
      headers: { "x-test-auth": "staff" },
      body: unsupported,
    });
    expect(unsupportedResponse.status).toBe(400);
    expect(await json(unsupportedResponse)).toEqual({
      error:
        'Could not extract text from "requirements.bin". Use a valid .txt, .md, .pdf, or .docx file.',
      code: "FILE_EXTRACTION_FAILED",
      filename: "requirements.bin",
    });

    const unreadable = new FormData();
    unreadable.set(
      "file",
      new Blob(["not actually a PDF"], { type: "application/pdf" }),
      "damaged-spec.pdf",
    );
    const unreadableResponse = await fetch(`${server.url}/api/ingest`, {
      method: "POST",
      headers: { "x-test-auth": "staff" },
      body: unreadable,
    });
    expect(unreadableResponse.status).toBe(400);
    expect(await json(unreadableResponse)).toEqual({
      error:
        '"damaged-spec.pdf" does not contain the document format indicated by its filename or content type.',
      code: "FILE_FORMAT_MISMATCH",
      filename: "damaged-spec.pdf",
    });

    const short = new FormData();
    short.set(
      "file",
      new Blob(["Too short"], { type: "text/plain" }),
      "brief.txt",
    );
    const shortResponse = await fetch(`${server.url}/api/ingest`, {
      method: "POST",
      headers: { "x-test-auth": "staff" },
      body: short,
    });
    expect(shortResponse.status).toBe(400);
    expect(await json(shortResponse)).toEqual({
      error:
        '"brief.txt" contains too little extractable text. At least 50 characters are required.',
      code: "FILE_TOO_SHORT",
      filename: "brief.txt",
    });
  });

  test("damaged DOCX Ingestion fails extraction without invoking document summarisation", async () => {
    const summarisationCalls = mocks.callLlmJson.mock.calls.length;
    const form = new FormData();
    form.set(
      "file",
      new Blob(["not actually a DOCX archive"], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
      "damaged-spec.docx",
    );

    const response = await fetch(`${server.url}/api/ingest`, {
      method: "POST",
      headers: { "x-test-auth": "staff" },
      body: form,
    });

    expect(response.status).toBe(400);
    expect(await json(response)).toEqual({
      error:
        '"damaged-spec.docx" does not contain the document format indicated by its filename or content type.',
      code: "FILE_FORMAT_MISMATCH",
      filename: "damaged-spec.docx",
    });
    expect(mocks.callLlmJson).toHaveBeenCalledTimes(summarisationCalls);
  });

  test.each([
    {
      label: "Ingestion",
      path: "/api/ingest",
      field: "file",
      makeForm: () => new FormData(),
    },
    {
      label: "Cartridge",
      path: "/api/cartridge",
      field: "files",
      makeForm: cartridgeForm,
    },
  ])(
    "mislabelled PDF, DOCX, and text uploads return the stable $label error contract",
    async ({ path, field, makeForm }) => {
      const cases = [
        {
          filename: "renamed.pdf",
          mime: "application/pdf",
          content: "This is plain text rather than a PDF file.",
        },
        {
          filename: "renamed.docx",
          mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          content: "This is plain text rather than a DOCX file.",
        },
        {
          filename: "renamed.txt",
          mime: "text/plain",
          content: Buffer.from("%PDF-1.7\nnot plain text"),
        },
      ];

      for (const item of cases) {
        const form = makeForm();
        form.append(
          field,
          new Blob([item.content], { type: item.mime }),
          item.filename,
        );
        const response = await fetch(`${server.url}${path}`, {
          method: "POST",
          headers: { "x-test-auth": "staff" },
          body: form,
        });

        expect(response.status).toBe(400);
        expect(await json(response)).toEqual({
          error: `"${item.filename}" does not contain the document format indicated by its filename or content type.`,
          code: "FILE_FORMAT_MISMATCH",
          filename: item.filename,
        });
      }
    },
  );

  test("oversized and excess-file Cartridge uploads return stable structured 400s", async () => {
    const summarisationCalls = mocks.callLlmJson.mock.calls.length;
    const packagesBefore = await db
      .select()
      .from(cartridgePackagesTable)
      .where(eq(cartridgePackagesTable.userId, user.id));
    const oversized = cartridgeForm();
    oversized.append(
      "files",
      new Blob(["A valid supporting document body ".repeat(3)], {
        type: "text/plain",
      }),
      "within-limit.txt",
    );
    oversized.append(
      "files",
      new Blob([Buffer.alloc(1024 * 1024 + 1)], {
        type: "text/plain",
      }),
      "oversized-second.txt",
    );
    const oversizedResponse = await fetch(`${server.url}/api/cartridge`, {
      method: "POST",
      headers: { "x-test-auth": "staff" },
      body: oversized,
    });
    expect(oversizedResponse.status).toBe(400);
    expect(await json(oversizedResponse)).toEqual({
      error:
        '"oversized-second.txt" is too large. Each file must be 1 MB or smaller.',
      code: "FILE_TOO_LARGE",
      filename: "oversized-second.txt",
    });
    expect(mocks.callLlmJson).toHaveBeenCalledTimes(summarisationCalls);
    const packagesAfter = await db
      .select()
      .from(cartridgePackagesTable)
      .where(eq(cartridgePackagesTable.userId, user.id));
    expect(packagesAfter).toHaveLength(packagesBefore.length);

    const excess = cartridgeForm();
    for (let i = 1; i <= 6; i += 1) {
      excess.append(
        "files",
        new Blob(["A valid supporting document body ".repeat(3)], {
          type: "text/plain",
        }),
        `support-${i}.txt`,
      );
    }
    const excessResponse = await fetch(`${server.url}/api/cartridge`, {
      method: "POST",
      headers: { "x-test-auth": "staff" },
      body: excess,
    });
    expect(excessResponse.status).toBe(400);
    expect(await json(excessResponse)).toEqual({
      error: "Upload rejected. Submit no more than 5 files.",
      code: "UPLOAD_LIMIT_EXCEEDED",
    });
  });

  test("unsupported and too-short Cartridge files expose filename-specific errors", async () => {
    const unsupported = cartridgeForm();
    unsupported.append(
      "files",
      new Blob(["not a supported document"], {
        type: "application/octet-stream",
      }),
      "requirements.bin",
    );
    const unsupportedResponse = await fetch(`${server.url}/api/cartridge`, {
      method: "POST",
      headers: { "x-test-auth": "staff" },
      body: unsupported,
    });
    expect(unsupportedResponse.status).toBe(400);
    expect(await json(unsupportedResponse)).toEqual({
      error:
        'Could not extract text from "requirements.bin". Use a valid .txt, .md, .pdf, or .docx file.',
      code: "FILE_EXTRACTION_FAILED",
      filename: "requirements.bin",
    });

    const short = cartridgeForm();
    short.append(
      "files",
      new Blob(["Too short"], { type: "text/plain" }),
      "brief.txt",
    );
    const shortResponse = await fetch(`${server.url}/api/cartridge`, {
      method: "POST",
      headers: { "x-test-auth": "staff" },
      body: short,
    });
    expect(shortResponse.status).toBe(400);
    expect(await json(shortResponse)).toEqual({
      error:
        '"brief.txt" contains too little extractable text. At least 50 characters are required.',
      code: "FILE_TOO_SHORT",
      filename: "brief.txt",
    });
  });

  test("subscription-mode Cartridge rejection releases its reserved credit without persisting", async () => {
    const creditId = "reserved-cartridge-credit";
    const packagesBefore = await db
      .select()
      .from(cartridgePackagesTable)
      .where(eq(cartridgePackagesTable.userId, user.id));
    mocks.claimCartridgeCredit.mockResolvedValueOnce(creditId);
    const form = cartridgeForm();
    form.append(
      "files",
      new Blob(["not a supported document"], {
        type: "application/octet-stream",
      }),
      "rejected-requirements.bin",
    );

    process.env.SUBSCRIPTIONS_ENABLED = "true";
    try {
      const response = await fetch(`${server.url}/api/cartridge`, {
        method: "POST",
        headers: { "x-test-auth": "staff" },
        body: form,
      });

      expect(response.status).toBe(400);
      expect(await json(response)).toEqual({
        error:
          'Could not extract text from "rejected-requirements.bin". Use a valid .txt, .md, .pdf, or .docx file.',
        code: "FILE_EXTRACTION_FAILED",
        filename: "rejected-requirements.bin",
      });
    } finally {
      process.env.SUBSCRIPTIONS_ENABLED = "false";
    }

    expect(mocks.claimCartridgeCredit).toHaveBeenCalledWith(user.id);
    expect(mocks.releaseCartridgeCredit).toHaveBeenCalledWith(creditId);
    expect(mocks.linkCreditToCartridge).not.toHaveBeenCalledWith(
      creditId,
      expect.any(String),
    );

    const packagesAfter = await db
      .select()
      .from(cartridgePackagesTable)
      .where(eq(cartridgePackagesTable.userId, user.id));
    expect(packagesAfter).toHaveLength(packagesBefore.length);
  });

  test("subscription-mode provider tier rejection returns the reserved Cartridge credit", async () => {
    const creditId = "reserved-provider-rejection-credit";
    const packagesBefore = await db
      .select()
      .from(cartridgePackagesTable)
      .where(eq(cartridgePackagesTable.userId, user.id));
    const linkCallsBefore = mocks.linkCreditToCartridge.mock.calls.length;
    mocks.claimCartridgeCredit.mockResolvedValueOnce(creditId);
    const form = cartridgeForm();
    form.set("provider", "gemini");

    process.env.SUBSCRIPTIONS_ENABLED = "true";
    try {
      const response = await fetch(`${server.url}/api/cartridge`, {
        method: "POST",
        headers: {
          "x-test-auth": "staff",
          "x-test-effective-tier": "EXPLORER",
        },
        body: form,
      });

      expect(response.status).toBe(403);
      expect(await json(response)).toEqual({
        error: "PROVIDER_REQUIRES_TIER",
        code: "PROVIDER_REQUIRES_TIER",
        detail: "Provider 'gemini' requires PRACTITIONER tier or higher.",
        provider: "gemini",
      });
    } finally {
      process.env.SUBSCRIPTIONS_ENABLED = "false";
    }

    expect(mocks.claimCartridgeCredit).toHaveBeenCalledWith(user.id);
    expect(mocks.releaseCartridgeCredit).toHaveBeenCalledWith(creditId);
    expect(mocks.linkCreditToCartridge).toHaveBeenCalledTimes(linkCallsBefore);

    const packagesAfter = await db
      .select()
      .from(cartridgePackagesTable)
      .where(eq(cartridgePackagesTable.userId, user.id));
    expect(packagesAfter).toHaveLength(packagesBefore.length);
  });

  test("subscription-mode credit link failure rolls back the Cartridge and releases its reservation", async () => {
    const creditId = "reserved-link-failure-credit";
    const packagesBefore = await db
      .select()
      .from(cartridgePackagesTable)
      .where(eq(cartridgePackagesTable.userId, user.id));
    mocks.claimCartridgeCredit.mockResolvedValueOnce(creditId);
    mocks.linkCreditToCartridge.mockRejectedValueOnce(
      new Error("forced cartridge credit link failure"),
    );

    process.env.SUBSCRIPTIONS_ENABLED = "true";
    try {
      const response = await fetch(`${server.url}/api/cartridge`, {
        method: "POST",
        headers: { "x-test-auth": "staff" },
        body: cartridgeForm(),
      });

      expect(response.status).toBe(400);
      expect(await json(response)).toEqual({
        error: "forced cartridge credit link failure",
      });
    } finally {
      process.env.SUBSCRIPTIONS_ENABLED = "false";
    }

    expect(mocks.claimCartridgeCredit).toHaveBeenCalledWith(user.id);
    expect(mocks.linkCreditToCartridge).toHaveBeenCalledWith(
      creditId,
      expect.any(String),
      expect.anything(),
    );
    expect(mocks.releaseCartridgeCredit).toHaveBeenCalledWith(creditId);

    const packagesAfter = await db
      .select()
      .from(cartridgePackagesTable)
      .where(eq(cartridgePackagesTable.userId, user.id));
    expect(packagesAfter).toHaveLength(packagesBefore.length);
  });

  test("subscription-mode credit link failure rolls back the Ingestion and releases its reservation", async () => {
    const creditId = "reserved-ingestion-link-failure-credit";
    const reservation = { id: creditId, token: crypto.randomUUID() };
    const documentsBefore = await db
      .select()
      .from(ingestionDocumentsTable)
      .where(eq(ingestionDocumentsTable.userId, user.id));
    mocks.claimIngestionCredit.mockResolvedValueOnce(reservation);
    mocks.linkCreditToDocument.mockRejectedValueOnce(
      new Error("forced ingestion credit link failure"),
    );
    mocks.callLlmJson.mockResolvedValueOnce({
      detectedTitle: "Atomic paid ingestion",
      sourceDocKind: "product_design_document",
      summary:
        "A sufficiently detailed source document used to verify atomic paid ingestion.",
      seedPrompt:
        "I want to ensure a paid document ingestion and its reserved credit link are persisted atomically.",
    });
    const form = new FormData();
    form.set(
      "file",
      new Blob(["Atomic paid ingestion source ".repeat(8)], {
        type: "text/plain",
      }),
      "atomic-paid-ingestion.txt",
    );

    process.env.SUBSCRIPTIONS_ENABLED = "true";
    try {
      const response = await fetch(`${server.url}/api/ingest`, {
        method: "POST",
        headers: { "x-test-auth": "staff" },
        body: form,
      });

      expect(response.status).toBe(400);
      expect(await json(response)).toEqual({
        error: "forced ingestion credit link failure",
      });
    } finally {
      process.env.SUBSCRIPTIONS_ENABLED = "false";
    }

    expect(mocks.claimIngestionCredit).toHaveBeenCalledWith(user.id);
    expect(mocks.linkCreditToDocument).toHaveBeenCalledWith(
      reservation,
      expect.any(String),
      expect.anything(),
    );
    expect(mocks.releaseIngestionCredit).toHaveBeenCalledWith(reservation);

    const documentsAfter = await db
      .select()
      .from(ingestionDocumentsTable)
      .where(eq(ingestionDocumentsTable.userId, user.id));
    expect(documentsAfter).toHaveLength(documentsBefore.length);
  });

  test("a transient ingestion credit release failure is retried until the reservation is restored", async () => {
    const creditId = "transient-release-failure-credit";
    const reservation = { id: creditId, token: crypto.randomUUID() };
    mocks.claimIngestionCredit.mockResolvedValueOnce(reservation);
    mocks.releaseIngestionCredit.mockReset();
    mocks.releaseIngestionCredit
      .mockRejectedValueOnce(new Error("temporary database failure"))
      .mockResolvedValueOnce(undefined);

    const form = new FormData();
    form.set(
      "file",
      new Blob(["not a supported document"], {
        type: "application/octet-stream",
      }),
      "rejected-transient-release.bin",
    );

    process.env.SUBSCRIPTIONS_ENABLED = "true";
    try {
      const response = await fetch(`${server.url}/api/ingest`, {
        method: "POST",
        headers: { "x-test-auth": "staff" },
        body: form,
      });

      expect(response.status).toBe(400);
    } finally {
      process.env.SUBSCRIPTIONS_ENABLED = "false";
    }

    await vi.waitFor(() => {
      const matchingCalls = mocks.releaseIngestionCredit.mock.calls.filter(
        ([claimed]) => claimed === reservation,
      );
      expect(matchingCalls).toHaveLength(2);
      expect(mocks.releaseIngestionCredit).toHaveBeenLastCalledWith(reservation);
    });
  });

  test("stale unlinked ingestion reservations are reconciled after the process-level retry window", async () => {
    const [staleCredit, activeCredit] = await db
      .insert(ingestionCreditsTable)
      .values([
        {
          userId: user.id,
          status: "consumed",
          consumedAt: new Date("2026-01-01T00:00:00.000Z"),
          reservationToken: crypto.randomUUID(),
        },
        {
          userId: user.id,
          status: "consumed",
          consumedAt: new Date("2026-01-01T00:05:00.001Z"),
          reservationToken: crypto.randomUUID(),
        },
      ])
      .returning();
    const actualCredits = await vi.importActual<
      typeof import("../src/lib/ingestion-credits")
    >("../src/lib/ingestion-credits");

    const released = await actualCredits.reconcileStaleIngestionCredits(
      new Date("2026-01-01T00:16:00.000Z"),
    );

    expect(released).toBeGreaterThanOrEqual(1);
    const credits = await db
      .select()
      .from(ingestionCreditsTable)
      .where(
        sql`${ingestionCreditsTable.id} IN (${staleCredit!.id}, ${activeCredit!.id})`,
      );
    const restored = credits.find((credit) => credit.id === staleCredit!.id);
    const active = credits.find((credit) => credit.id === activeCredit!.id);
    expect(restored).toMatchObject({
      status: "available",
      consumedAt: null,
      ingestionDocumentId: null,
      reservationToken: null,
    });
    expect(active).toMatchObject({
      status: "consumed",
      consumedAt: new Date("2026-01-01T00:05:00.001Z"),
      ingestionDocumentId: null,
    });
  });

  test("an expired request cannot release or link a credit after it is reclaimed", async () => {
    const oldReservation = { id: crypto.randomUUID(), token: crypto.randomUUID() };
    const newToken = crypto.randomUUID();
    const [credit] = await db
      .insert(ingestionCreditsTable)
      .values({
        id: oldReservation.id,
        userId: user.id,
        status: "consumed",
        consumedAt: new Date("2026-01-01T00:00:00.000Z"),
        reservationToken: oldReservation.token,
      })
      .returning();
    const actualCredits = await vi.importActual<
      typeof import("../src/lib/ingestion-credits")
    >("../src/lib/ingestion-credits");
    await actualCredits.reconcileStaleIngestionCredits(
      new Date("2026-01-01T00:16:00.000Z"),
    );
    await db
      .update(ingestionCreditsTable)
      .set({
        status: "consumed",
        consumedAt: new Date("2026-01-01T00:16:01.000Z"),
        reservationToken: newToken,
      })
      .where(eq(ingestionCreditsTable.id, credit!.id));

    await expect(
      actualCredits.releaseIngestionCredit(oldReservation),
    ).rejects.toBeInstanceOf(actualCredits.IngestionCreditReservationLostError);
    await expect(
      actualCredits.linkCreditToDocument(
        oldReservation,
        crypto.randomUUID(),
      ),
    ).rejects.toThrow("Reserved ingestion credit could not be linked");

    const [stillReclaimed] = await db
      .select()
      .from(ingestionCreditsTable)
      .where(eq(ingestionCreditsTable.id, credit!.id));
    expect(stillReclaimed).toMatchObject({
      status: "consumed",
      reservationToken: newToken,
      ingestionDocumentId: null,
    });
  });

  test("damaged DOCX Cartridge fails extraction without invoking document summarisation", async () => {
    const summarisationCalls = mocks.callLlmJson.mock.calls.length;
    const form = cartridgeForm();
    form.append(
      "files",
      new Blob(["not actually a DOCX archive"], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
      "damaged-support.docx",
    );

    const response = await fetch(`${server.url}/api/cartridge`, {
      method: "POST",
      headers: { "x-test-auth": "staff" },
      body: form,
    });

    expect(response.status).toBe(400);
    expect(await json(response)).toEqual({
      error:
        '"damaged-support.docx" does not contain the document format indicated by its filename or content type.',
      code: "FILE_FORMAT_MISMATCH",
      filename: "damaged-support.docx",
    });
    expect(mocks.callLlmJson).toHaveBeenCalledTimes(summarisationCalls);
  });

  test("damaged PDF Cartridge fails extraction without invoking document summarisation", async () => {
    const summarisationCalls = mocks.callLlmJson.mock.calls.length;
    const form = cartridgeForm();
    form.append(
      "files",
      new Blob(["not actually a PDF"], { type: "application/pdf" }),
      "damaged-support.pdf",
    );

    const response = await fetch(`${server.url}/api/cartridge`, {
      method: "POST",
      headers: { "x-test-auth": "staff" },
      body: form,
    });

    expect(response.status).toBe(400);
    expect(await json(response)).toEqual({
      error:
        '"damaged-support.pdf" does not contain the document format indicated by its filename or content type.',
      code: "FILE_FORMAT_MISMATCH",
      filename: "damaged-support.pdf",
    });
    expect(mocks.callLlmJson).toHaveBeenCalledTimes(summarisationCalls);
  });

  test.each([
    {
      filename: "damaged-second.pdf",
      mime: "application/pdf",
      content: "not actually a PDF",
      error:
        '"damaged-second.pdf" does not contain the document format indicated by its filename or content type.',
      code: "FILE_FORMAT_MISMATCH",
    },
    {
      filename: "damaged-second.docx",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      content: "not actually a DOCX archive",
      error:
        '"damaged-second.docx" does not contain the document format indicated by its filename or content type.',
      code: "FILE_FORMAT_MISMATCH",
    },
    {
      filename: "unsupported-second.bin",
      mime: "application/octet-stream",
      content: "not a supported document",
      error:
        'Could not extract text from "unsupported-second.bin". Use a valid .txt, .md, .pdf, or .docx file.',
      code: "FILE_EXTRACTION_FAILED",
    },
    {
      filename: "too-short-second.txt",
      mime: "text/plain",
      content: "Too short",
      error:
        '"too-short-second.txt" contains too little extractable text. At least 50 characters are required.',
      code: "FILE_TOO_SHORT",
    },
  ])(
    "mixed Cartridge upload rejects $filename before summarising or persisting",
    async ({ filename, mime, content, error, code }) => {
      const summarisationCalls = mocks.callLlmJson.mock.calls.length;
      const packagesBefore = await db
        .select()
        .from(cartridgePackagesTable)
        .where(eq(cartridgePackagesTable.userId, user.id));
      const form = cartridgeForm();
      form.append(
        "files",
        new Blob(["A valid supporting document body ".repeat(3)], {
          type: "text/plain",
        }),
        "valid-first.txt",
      );
      form.append("files", new Blob([content], { type: mime }), filename);

      const response = await fetch(`${server.url}/api/cartridge`, {
        method: "POST",
        headers: { "x-test-auth": "staff" },
        body: form,
      });

      expect(response.status).toBe(400);
      expect(await json(response)).toEqual({
        error,
        code,
        filename,
      });
      expect(mocks.callLlmJson).toHaveBeenCalledTimes(summarisationCalls);

      const packagesAfter = await db
        .select()
        .from(cartridgePackagesTable)
        .where(eq(cartridgePackagesTable.userId, user.id));
      expect(packagesAfter).toHaveLength(packagesBefore.length);
    },
  );

  test.each([
    {
      engine: "ingestion",
      path: "/api/ingest/%s/start-session",
      origin: "ingested",
      seed: async () => {
        const [row] = await db
          .insert(ingestionDocumentsTable)
          .values({
            userId: user.id,
            originalFilename: "rollback-ingestion.txt",
            mimeType: "text/plain",
            fileSizeBytes: 100,
            sourceDocKind: "other",
            detectedTitle: "Rollback ingestion",
            extractedTextSha256: "a".repeat(64),
            extractedTextChars: 100,
            summary: "Rollback fixture",
            seedPrompt: "A rollback fixture seed prompt long enough for testing.",
          })
          .returning();
        return row!.id;
      },
    },
    {
      engine: "cartridge",
      path: "/api/cartridge/%s/start-session",
      origin: "cartridge",
      seed: async () => {
        const [row] = await db
          .insert(cartridgePackagesTable)
          .values({
            userId: user.id,
            projectName: "Rollback cartridge",
            outcomeOneLiner: "Verify atomic session rollback.",
            scopeStatement:
              "A cartridge fixture used to force feature-state persistence failure.",
            seedPrompt: "I want to verify atomic session rollback.",
            summary: "Rollback fixture",
          })
          .returning();
        return row!.id;
      },
    },
  ])(
    "a forced feature-state failure leaves no orphan $engine session",
    async ({ path, origin, seed }) => {
      const sourceId = await seed();
      const transaction = db.transaction.bind(db);
      const spy = vi.spyOn(db, "transaction").mockImplementationOnce(
        (async (callback: (tx: typeof db) => Promise<unknown>) =>
          transaction(async (tx) =>
            callback(
              new Proxy(tx, {
                get(target, property, receiver) {
                  if (property !== "insert") {
                    return Reflect.get(target, property, receiver);
                  }
                  return (table: unknown) => {
                    if (table === harnessFeatureStateTable) {
                      return {
                        values: async () => {
                          throw new Error("forced feature-state insert failure");
                        },
                      };
                    }
                    return tx.insert(table as never);
                  };
                },
              }) as unknown as typeof db,
            ),
          )) as typeof db.transaction,
      );
      try {
        const response = await fetch(
          `${server.url}${path.replace("%s", sourceId)}`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-auth": "staff",
            },
            body: "{}",
          },
        );
        expect(response.status).toBe(500);
      } finally {
        spy.mockRestore();
      }

      const sessions = await db
        .select()
        .from(harnessSessionsTable)
        .where(
          and(
            eq(harnessSessionsTable.userId, user.id),
            eq(harnessSessionsTable.origin, origin as "ingested" | "cartridge"),
            origin === "ingested"
              ? eq(harnessSessionsTable.ingestionId, sourceId)
              : eq(harnessSessionsTable.cartridgeId, sourceId),
          ),
        );
      expect(sessions).toHaveLength(0);
    },
  );
});