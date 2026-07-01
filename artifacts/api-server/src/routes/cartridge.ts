import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { and, asc, eq } from "drizzle-orm";
import {
  db,
  cartridgePackagesTable,
  cartridgeDocumentsTable,
  cartridgeSpcsTable,
  cartridgeLinksTable,
  harnessSessionsTable,
  harnessFeatureStateTable,
  CARTRIDGE_LINK_KINDS,
  type CartridgeLinkKind,
  type CartridgePackage,
  type CartridgeDocument,
  type CartridgeSpc,
  type CartridgeLink,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { requireCostBudget } from "../lib/cost-budget";
import { subscriptionsEnabled } from "../lib/feature-flags";
import {
  claimCartridgeCredit,
  releaseCartridgeCredit,
  linkCreditToCartridge,
  getCartridgeCreditsSummary,
} from "../lib/cartridge-credits";
import { serializeSession } from "./sessions";
import { invalidateCartridgeContext } from "../lib/cartridge-context";
import { callLlmJson, isLlmProvider, resolveProvider, sendProviderTierError } from "../engines/shared";
import type { LlmProvider } from "@workspace/db";
import { z } from "zod/v4";

const MAX_FILES = 5;
const MAX_FILE_BYTES = 1 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 60_000;
const MIN_SCOPE_CHARS = 80;
const MIN_OUTCOME_CHARS = 12;
const MAX_SPC_BODY_CHARS = 12_000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
});

const router: IRouter = Router();

interface ParsedSpcInput {
  label: string;
  body: string;
}
interface ParsedLinkInput {
  kind: CartridgeLinkKind;
  descriptor: string;
  note?: string | null;
}

function parseSpcs(raw: unknown): ParsedSpcInput[] {
  if (!raw) return [];
  let arr: unknown;
  try {
    arr = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const out: ParsedSpcInput[] = [];
  for (const item of arr) {
    if (typeof item !== "object" || item === null) continue;
    const obj = item as { label?: unknown; body?: unknown };
    if (typeof obj.label !== "string" || typeof obj.body !== "string") continue;
    const body = obj.body.trim().slice(0, MAX_SPC_BODY_CHARS);
    if (body.length < 20) continue;
    out.push({ label: obj.label.trim().slice(0, 255), body });
  }
  return out.slice(0, 10);
}

function parseLinks(raw: unknown): ParsedLinkInput[] {
  if (!raw) return [];
  let arr: unknown;
  try {
    arr = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const out: ParsedLinkInput[] = [];
  for (const item of arr) {
    if (typeof item !== "object" || item === null) continue;
    const obj = item as { kind?: unknown; descriptor?: unknown; note?: unknown };
    if (
      typeof obj.kind !== "string" ||
      !(CARTRIDGE_LINK_KINDS as readonly string[]).includes(obj.kind) ||
      typeof obj.descriptor !== "string" ||
      obj.descriptor.trim().length === 0
    ) {
      continue;
    }
    out.push({
      kind: obj.kind as CartridgeLinkKind,
      descriptor: obj.descriptor.trim().slice(0, 2000),
      note: typeof obj.note === "string" ? obj.note.slice(0, 500) : null,
    });
  }
  return out.slice(0, 10);
}

async function extractText(
  buffer: Buffer,
  filename: string,
  declaredMime: string | undefined,
): Promise<{ text: string; mimeType: string }> {
  const lower = filename.toLowerCase();
  const mime = declaredMime ?? "application/octet-stream";
  if (
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".markdown") ||
    mime.startsWith("text/")
  ) {
    return { text: buffer.toString("utf8"), mimeType: mime };
  }
  if (lower.endsWith(".pdf") || mime === "application/pdf") {
    const pdfParseMod = (await import("pdf-parse")) as unknown as
      | ((data: Buffer) => Promise<{ text: string }>)
      | { default: (data: Buffer) => Promise<{ text: string }> };
    const pdfParse =
      typeof pdfParseMod === "function" ? pdfParseMod : pdfParseMod.default;
    const parsed = await pdfParse(buffer);
    return { text: parsed.text, mimeType: "application/pdf" };
  }
  if (
    lower.endsWith(".docx") ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammothMod = await import("mammoth");
    const mammoth = (mammothMod.default ?? mammothMod) as {
      extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
    };
    const result = await mammoth.extractRawText({ buffer });
    return {
      text: result.value,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }
  throw new Error(
    "Unsupported file type. Accepted: .txt, .md, .pdf, .docx (one file may be skipped).",
  );
}

const DocSummarySchema = z.object({
  summary: z.string().min(20).max(800),
});
const SUMMARY_SYSTEM = `You produce concise one-paragraph summaries (≤ 600 chars) of supporting
documents that will accompany a software project cartridge. Capture only the
intent / scope-relevant content. Return STRICT JSON: {"summary":"..."}.`;

function serializeCartridge(
  pkg: CartridgePackage,
  docs: CartridgeDocument[],
  spcs: CartridgeSpc[],
  links: CartridgeLink[],
) {
  return {
    id: pkg.id,
    projectName: pkg.projectName,
    outcomeOneLiner: pkg.outcomeOneLiner,
    scopeStatement: pkg.scopeStatement,
    targetPlatformHint: pkg.targetPlatformHint,
    seedPrompt: pkg.seedPrompt,
    summary: pkg.summary,
    createdAt: pkg.createdAt.toISOString(),
    documents: docs.map((d) => ({
      id: d.id,
      originalFilename: d.originalFilename,
      mimeType: d.mimeType,
      fileSizeBytes: d.fileSizeBytes,
      extractedTextChars: d.extractedTextChars,
      summary: d.summary,
    })),
    spcs: spcs.map((s) => ({
      id: s.id,
      label: s.label,
      summary: s.summary,
      body: s.body,
    })),
    links: links.map((l) => ({
      id: l.id,
      kind: l.kind,
      descriptor: l.descriptor,
      note: l.note,
    })),
  };
}

router.get(
  "/cartridge-credits",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const summary = await getCartridgeCreditsSummary(req.localUser!.id);
    res.json(summary);
  },
);

router.get(
  "/cartridge/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    const userId = req.localUser!.id;
    const rows = await db
      .select()
      .from(cartridgePackagesTable)
      .where(
        and(
          eq(cartridgePackagesTable.id, id),
          eq(cartridgePackagesTable.userId, userId),
        ),
      )
      .limit(1);
    const pkg = rows[0];
    if (!pkg) {
      res.status(404).json({ error: "Cartridge not found" });
      return;
    }
    const [docs, spcs, links] = await Promise.all([
      db
        .select()
        .from(cartridgeDocumentsTable)
        .where(eq(cartridgeDocumentsTable.cartridgeId, id))
        .orderBy(asc(cartridgeDocumentsTable.createdAt)),
      db
        .select()
        .from(cartridgeSpcsTable)
        .where(eq(cartridgeSpcsTable.cartridgeId, id))
        .orderBy(asc(cartridgeSpcsTable.createdAt)),
      db
        .select()
        .from(cartridgeLinksTable)
        .where(eq(cartridgeLinksTable.cartridgeId, id))
        .orderBy(asc(cartridgeLinksTable.createdAt)),
    ]);
    res.json(serializeCartridge(pkg, docs, spcs, links));
  },
);

router.post(
  "/cartridge",
  requireAuth,
  requireCostBudget,
  upload.array("files", MAX_FILES),
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.localUser!.id;

    // ── Step 1: hard-validate operator-defined SCOPE FIRST (before any spend) ──
    const projectName =
      typeof req.body?.projectName === "string"
        ? req.body.projectName.trim().slice(0, 255)
        : "";
    const outcomeOneLiner =
      typeof req.body?.outcomeOneLiner === "string"
        ? req.body.outcomeOneLiner.trim().slice(0, 1000)
        : "";
    const scopeStatement =
      typeof req.body?.scopeStatement === "string"
        ? req.body.scopeStatement.trim().slice(0, 8000)
        : "";
    const targetPlatformHint =
      typeof req.body?.targetPlatformHint === "string"
        ? req.body.targetPlatformHint.trim().slice(0, 500)
        : null;

    if (projectName.length === 0) {
      res.status(400).json({
        error: "Project name is required",
        code: "SCOPE_REQUIRED",
        field: "projectName",
      });
      return;
    }
    if (outcomeOneLiner.length < MIN_OUTCOME_CHARS) {
      res.status(400).json({
        error: `Outcome one-liner must be at least ${MIN_OUTCOME_CHARS} characters`,
        code: "SCOPE_REQUIRED",
        field: "outcomeOneLiner",
      });
      return;
    }
    if (scopeStatement.length < MIN_SCOPE_CHARS) {
      res.status(400).json({
        error: `Scope statement must be at least ${MIN_SCOPE_CHARS} characters — Define Project Scope cannot be skipped`,
        code: "SCOPE_REQUIRED",
        field: "scopeStatement",
      });
      return;
    }

    const spcInputs = parseSpcs(req.body?.spcs);
    const linkInputs = parseLinks(req.body?.links);
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];

    // ── Step 2: claim credit atomically (dormant in internal-staff mode) ──
    // When subscriptions are disabled the credit machinery is bypassed entirely
    // — staff build cartridges freely, but the LLM spend is still bounded by the
    // company-wide monthly cost cap (`requireCostBudget` above).
    let creditId: string | null = null;
    if (subscriptionsEnabled()) {
      creditId = await claimCartridgeCredit(userId);
      if (!creditId) {
        res.status(402).json({
          error:
            "No cartridge credits available. Purchase an Advanced Cartridge to continue.",
          code: "CARTRIDGE_CREDIT_REQUIRED",
        });
        return;
      }
    }

    let success = false;
    let cartridgeId: string | null = null;
    try {
      // Provider for the (small) doc-summary calls.
      const bodyProvider = isLlmProvider(req.body?.provider)
        ? (req.body.provider as LlmProvider)
        : undefined;
      let provider: LlmProvider;
      try {
        provider = resolveProvider(req, bodyProvider, "claude");
      } catch (err) {
        if (sendProviderTierError(res, err)) return;
        throw err;
      }

      // ── Step 3: extract + summarise documents ──
      interface DocPlan {
        filename: string;
        mimeType: string;
        size: number;
        chars: number;
        summary: string;
      }
      const docPlans: DocPlan[] = [];
      for (const f of files) {
        let extracted: { text: string; mimeType: string };
        try {
          extracted = await extractText(f.buffer, f.originalname, f.mimetype);
        } catch (err) {
          req.log.warn({ err, filename: f.originalname }, "Cartridge doc extraction failed");
          continue;
        }
        const cleaned = extracted.text.replace(/\u0000/g, "").trim();
        if (cleaned.length < 50) continue;
        const truncated =
          cleaned.length > MAX_EXTRACTED_CHARS
            ? cleaned.slice(0, MAX_EXTRACTED_CHARS)
            : cleaned;
        let summary = truncated.slice(0, 400);
        try {
          const out = await callLlmJson(
            provider,
            SUMMARY_SYSTEM,
            `FILENAME: ${f.originalname}\n\n--- DOCUMENT TEXT ---\n${truncated}`,
            DocSummarySchema,
            // Session-less run (cartridge is built before any harness session).
            // engineId 21 = cartridge doc-summary. Passing a ctx records the
            // spend so it counts toward the company-wide monthly cost cap.
            { sessionId: null, userId, engineId: 21 },
          );
          summary = out.summary;
        } catch (err) {
          req.log.warn({ err, filename: f.originalname }, "Cartridge doc summary failed; using head");
        }
        docPlans.push({
          filename: f.originalname,
          mimeType: extracted.mimeType,
          size: f.size,
          chars: truncated.length,
          summary,
        });
      }

      // ── Step 4: derive seed prompt from scope (deterministic, no LLM dependency) ──
      const seedPrompt = [
        `I want to build "${projectName}".`,
        outcomeOneLiner,
        "",
        "SCOPE:",
        scopeStatement,
        targetPlatformHint ? `\nTARGET PLATFORM HINT: ${targetPlatformHint}` : "",
      ]
        .filter(Boolean)
        .join("\n")
        .slice(0, 4000);

      // ── Step 5: persist package + children in a single transaction ──
      const cartridgeOverview = [
        `Project: ${projectName}`,
        `Outcome: ${outcomeOneLiner}`,
        `Documents: ${docPlans.length}`,
        `SPCs: ${spcInputs.length}`,
        `Linked artefacts: ${linkInputs.length}`,
      ].join(" · ");

      const persisted = await db.transaction(async (tx) => {
        const [pkg] = await tx
          .insert(cartridgePackagesTable)
          .values({
            userId,
            projectName,
            outcomeOneLiner,
            scopeStatement,
            targetPlatformHint,
            seedPrompt,
            summary: cartridgeOverview,
          })
          .returning();
        const id = pkg!.id;
        if (docPlans.length > 0) {
          await tx.insert(cartridgeDocumentsTable).values(
            docPlans.map((d) => ({
              cartridgeId: id,
              originalFilename: d.filename,
              mimeType: d.mimeType,
              fileSizeBytes: d.size,
              extractedTextChars: d.chars,
              summary: d.summary,
            })),
          );
        }
        if (spcInputs.length > 0) {
          await tx.insert(cartridgeSpcsTable).values(
            spcInputs.map((s) => ({
              cartridgeId: id,
              label: s.label,
              body: s.body,
              summary: s.body.slice(0, 600),
            })),
          );
        }
        if (linkInputs.length > 0) {
          await tx.insert(cartridgeLinksTable).values(
            linkInputs.map((l) => ({
              cartridgeId: id,
              kind: l.kind,
              descriptor: l.descriptor,
              note: l.note ?? null,
            })),
          );
        }
        return pkg!;
      });
      cartridgeId = persisted.id;

      if (creditId) {
        try {
          await linkCreditToCartridge(creditId, persisted.id);
        } catch (err) {
          req.log.warn({ err, creditId, cartridgeId: persisted.id }, "Failed to link cartridge credit");
        }
      }

      const [docs, spcs, links] = await Promise.all([
        db
          .select()
          .from(cartridgeDocumentsTable)
          .where(eq(cartridgeDocumentsTable.cartridgeId, persisted.id))
          .orderBy(asc(cartridgeDocumentsTable.createdAt)),
        db
          .select()
          .from(cartridgeSpcsTable)
          .where(eq(cartridgeSpcsTable.cartridgeId, persisted.id))
          .orderBy(asc(cartridgeSpcsTable.createdAt)),
        db
          .select()
          .from(cartridgeLinksTable)
          .where(eq(cartridgeLinksTable.cartridgeId, persisted.id))
          .orderBy(asc(cartridgeLinksTable.createdAt)),
      ]);

      success = true;
      res.status(201).json(serializeCartridge(persisted, docs, spcs, links));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Cartridge creation failed";
      req.log.error({ err }, "Cartridge create failed");
      if (!res.headersSent) res.status(400).json({ error: msg });
    } finally {
      if (!success && creditId) {
        try {
          await releaseCartridgeCredit(creditId);
        } catch (releaseErr) {
          req.log.error({ err: releaseErr, creditId }, "Failed to release cartridge credit");
        }
      } else if (success && cartridgeId) {
        invalidateCartridgeContext(cartridgeId);
      }
    }
  },
);

router.post(
  "/cartridge/:id/start-session",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    const userId = req.localUser!.id;
    const rows = await db
      .select()
      .from(cartridgePackagesTable)
      .where(
        and(
          eq(cartridgePackagesTable.id, id),
          eq(cartridgePackagesTable.userId, userId),
        ),
      )
      .limit(1);
    const pkg = rows[0];
    if (!pkg) {
      res.status(404).json({ error: "Cartridge not found" });
      return;
    }

    const requestedName =
      typeof req.body?.sessionName === "string" && req.body.sessionName.trim()
        ? req.body.sessionName.trim().slice(0, 255)
        : `Cartridge: ${pkg.projectName}`.slice(0, 255);

    const [created] = await db
      .insert(harnessSessionsTable)
      .values({
        userId,
        sessionName: requestedName,
        origin: "cartridge",
        cartridgeId: pkg.id,
      })
      .returning();

    // Unlock F1..F7 all at once. The auto-run kicks F1 in the background; the
    // operator can still pause / step manually from the workspace UI.
    const now = new Date();
    await db.insert(harnessFeatureStateTable).values(
      [1, 2, 3, 4, 5, 6, 7].map((featureId) => ({
        sessionId: created!.id,
        featureId,
        status: "AVAILABLE" as const,
        unlockedAt: now,
      })),
    );

    res.status(201).json(serializeSession(created!));
  },
);

router.get(
  "/sessions/:id/cartridge",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const sessionId = String(req.params.id);
    const userId = req.localUser!.id;
    const sessRows = await db
      .select()
      .from(harnessSessionsTable)
      .where(
        and(
          eq(harnessSessionsTable.id, sessionId),
          eq(harnessSessionsTable.userId, userId),
        ),
      )
      .limit(1);
    const session = sessRows[0];
    if (!session || !session.cartridgeId) {
      res.status(404).json({ error: "Session has no cartridge" });
      return;
    }
    const rows = await db
      .select()
      .from(cartridgePackagesTable)
      .where(
        and(
          eq(cartridgePackagesTable.id, session.cartridgeId),
          eq(cartridgePackagesTable.userId, userId),
        ),
      )
      .limit(1);
    const pkg = rows[0];
    if (!pkg) {
      res.status(404).json({ error: "Cartridge not found" });
      return;
    }
    const [docs, spcs, links] = await Promise.all([
      db
        .select()
        .from(cartridgeDocumentsTable)
        .where(eq(cartridgeDocumentsTable.cartridgeId, pkg.id))
        .orderBy(asc(cartridgeDocumentsTable.createdAt)),
      db
        .select()
        .from(cartridgeSpcsTable)
        .where(eq(cartridgeSpcsTable.cartridgeId, pkg.id))
        .orderBy(asc(cartridgeSpcsTable.createdAt)),
      db
        .select()
        .from(cartridgeLinksTable)
        .where(eq(cartridgeLinksTable.cartridgeId, pkg.id))
        .orderBy(asc(cartridgeLinksTable.createdAt)),
    ]);
    res.json(serializeCartridge(pkg, docs, spcs, links));
  },
);

export default router;
