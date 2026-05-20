import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { z } from "zod/v4";
import {
  db,
  ingestionDocumentsTable,
  harnessSessionsTable,
  harnessFeatureStateTable,
  SOURCE_DOC_KINDS,
  type SourceDocKind,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  claimIngestionCredit,
  getIngestionCreditsSummary,
  linkCreditToDocument,
  releaseIngestionCredit,
} from "../lib/ingestion-credits";
import { callClaudeJson } from "../engines/shared";
import { serializeSession } from "./sessions";

const MAX_UPLOAD_BYTES = 1 * 1024 * 1024; // 1 MB
const MAX_EXTRACTED_CHARS = 200_000;
const MIN_EXTRACTED_CHARS = 50;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

const router: IRouter = Router();

const NormalizationSchema = z.object({
  detectedTitle: z.string().min(1).max(500),
  sourceDocKind: z.enum(SOURCE_DOC_KINDS),
  summary: z.string().min(20),
  seedPrompt: z.string().min(40),
});
type Normalization = z.infer<typeof NormalizationSchema>;

const NORMALIZATION_SYSTEM_PROMPT = `You are the ATANDA INGESTION ENGINE — a pre-session normaliser that converts a
human-authored document (a Product Design Document, Software Design Document,
concept note, or spec sheet) into a clean SEED PROMPT suitable for the
FORGE.BONSAI HARNESS F1 (Prompt Diagnostic) engine.

CRITICAL TERMINOLOGY
- The INPUT is a "Product Design Document" (PDD) or one of its siblings (SDD,
  concept note, spec sheet). This is a HUMAN-AUTHORED pre-ingestion artefact.
- The eventual OUTPUT of the HARNESS will be a "PromptWare Design Document"
  (PWDD) — a HARNESS-PRODUCED post-ingestion artefact. You do NOT produce the
  PWDD. You produce the SEED PROMPT that will be fed into F1.

YOUR TASKS
1. Detect the document's title (use the first heading, the filename, or
   synthesise a concise one from the opening lines).
2. Classify the source document kind. Valid values:
   product_design_document | software_design_document | concept_note |
   spec_sheet | other
3. Produce a tight SUMMARY (≤ 600 chars) of what the document describes.
4. Produce a SEED PROMPT (≤ 1500 chars) — a single, surgical paragraph rewritten
   in the operator's voice ("I want to build…") that captures the essential
   intent, audience, success criterion, and constraints from the source doc.
   The seed prompt is what F1 will diagnose, so it must read like a raw human
   prompt — not a structured spec.

OUTPUT FORMAT
Return ONLY a JSON object, no prose, no fences:
{
  "detectedTitle": "...",
  "sourceDocKind": "product_design_document",
  "summary": "...",
  "seedPrompt": "..."
}`;

interface ExtractResult {
  text: string;
  mimeType: string;
}

async function extractText(
  buffer: Buffer,
  filename: string,
  declaredMime: string | undefined,
): Promise<ExtractResult> {
  const lower = filename.toLowerCase();
  const mime = declaredMime ?? "application/octet-stream";

  // Plain text / markdown
  if (
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".markdown") ||
    mime.startsWith("text/")
  ) {
    return { text: buffer.toString("utf8"), mimeType: mime };
  }

  // PDF — pdf-parse is externalized in build.mjs so Node loads it via CJS at
  // runtime; the package's debug self-test only runs when `!module.parent`,
  // which is false when required from our bundle.
  if (lower.endsWith(".pdf") || mime === "application/pdf") {
    const pdfParseMod = (await import("pdf-parse")) as unknown as
      | ((data: Buffer) => Promise<{ text: string }>)
      | { default: (data: Buffer) => Promise<{ text: string }> };
    const pdfParse =
      typeof pdfParseMod === "function" ? pdfParseMod : pdfParseMod.default;
    const parsed = await pdfParse(buffer);
    return { text: parsed.text, mimeType: "application/pdf" };
  }

  // DOCX
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
    "Unsupported file type. Accepted: .txt, .md, .pdf, .docx (or paste text directly).",
  );
}

function serializeIngestion(row: typeof ingestionDocumentsTable.$inferSelect) {
  return {
    id: row.id,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    fileSizeBytes: row.fileSizeBytes,
    sourceDocKind: row.sourceDocKind,
    detectedTitle: row.detectedTitle,
    extractedTextChars: row.extractedTextChars,
    summary: row.summary,
    seedPrompt: row.seedPrompt,
    createdAt: row.createdAt.toISOString(),
  };
}

router.get(
  "/ingestion-credits",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const summary = await getIngestionCreditsSummary(req.localUser!.id);
    res.json(summary);
  },
);

router.post(
  "/ingest",
  requireAuth,
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.localUser!.id;

    // Per-project billing: claim one available ingestion credit BEFORE we
    // spend any LLM tokens. On any downstream failure we release the credit
    // back to `available` so a fluke doesn't burn the user's purchase.
    const creditId = await claimIngestionCredit(userId);
    if (!creditId) {
      res.status(402).json({
        error:
          "No ingestion credits available. Purchase a project credit to ingest a document.",
        code: "INGESTION_CREDIT_REQUIRED",
      });
      return;
    }

    let success = false;
    try {
      const file = req.file;
      const pastedText =
        typeof req.body?.pastedText === "string" ? req.body.pastedText : null;
      const declaredKindRaw =
        typeof req.body?.sourceDocKind === "string"
          ? req.body.sourceDocKind
          : null;
      const declaredKind =
        declaredKindRaw &&
        (SOURCE_DOC_KINDS as readonly string[]).includes(declaredKindRaw)
          ? (declaredKindRaw as SourceDocKind)
          : null;

      let extractedText: string;
      let filename: string;
      let mimeType: string;
      let fileSizeBytes: number;

      if (file) {
        const result = await extractText(file.buffer, file.originalname, file.mimetype);
        extractedText = result.text;
        filename = file.originalname;
        mimeType = result.mimeType;
        fileSizeBytes = file.size;
      } else if (pastedText && pastedText.trim().length >= MIN_EXTRACTED_CHARS) {
        extractedText = pastedText;
        filename = "pasted-text.txt";
        mimeType = "text/plain";
        fileSizeBytes = Buffer.byteLength(pastedText, "utf8");
      } else {
        res.status(400).json({
          error:
            "Provide a file (.txt, .md, .pdf, .docx) or paste at least 50 characters of text.",
        });
        return;
      }

      const cleaned = extractedText.replace(/\u0000/g, "").trim();
      if (cleaned.length < MIN_EXTRACTED_CHARS) {
        res.status(400).json({
          error: `Extracted document is too short (${cleaned.length} chars). Need at least ${MIN_EXTRACTED_CHARS}.`,
        });
        return;
      }
      const truncated =
        cleaned.length > MAX_EXTRACTED_CHARS
          ? cleaned.slice(0, MAX_EXTRACTED_CHARS)
          : cleaned;

      const hash = createHash("sha256").update(truncated).digest("hex");

      const userMsg = [
        `FILENAME: ${filename}`,
        declaredKind ? `OPERATOR-DECLARED KIND: ${declaredKind}` : null,
        "",
        "--- DOCUMENT TEXT ---",
        truncated,
      ]
        .filter((line): line is string => line !== null)
        .join("\n");

      let normalized: Normalization;
      try {
        normalized = await callClaudeJson(
          NORMALIZATION_SYSTEM_PROMPT,
          userMsg,
          NormalizationSchema,
        );
      } catch (err) {
        req.log.error({ err }, "Ingestion normalisation failed");
        res
          .status(502)
          .json({ error: "Failed to normalise document. Try again or paste a cleaner version." });
        return;
      }

      const finalKind: SourceDocKind = declaredKind ?? normalized.sourceDocKind;

      const [row] = await db
        .insert(ingestionDocumentsTable)
        .values({
          userId,
          originalFilename: filename,
          mimeType,
          fileSizeBytes,
          sourceDocKind: finalKind,
          detectedTitle: normalized.detectedTitle.slice(0, 500),
          extractedTextSha256: hash,
          extractedTextChars: truncated.length,
          summary: normalized.summary,
          seedPrompt: normalized.seedPrompt,
        })
        .returning();

      // Permanently bind the claimed credit to the document it paid for.
      // Best-effort: a failure here doesn't roll back the ingestion (the
      // credit is already marked consumed, just unlinked).
      try {
        await linkCreditToDocument(creditId, row!.id);
      } catch (linkErr) {
        req.log.warn({ err: linkErr, creditId, documentId: row!.id }, "Failed to link ingestion credit to document");
      }

      success = true;
      res.status(201).json(serializeIngestion(row!));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ingestion failed";
      req.log.error({ err }, "Ingestion request failed");
      res.status(400).json({ error: msg });
    } finally {
      // Release the claimed credit on ANY non-success path — both thrown
      // exceptions AND early `res.status(4xx/5xx).json(...); return;` branches
      // inside the try block (invalid input, too-short text, normalisation
      // failure, etc.). The user is only charged when an ingestion_document
      // row is persisted.
      if (!success) {
        try {
          await releaseIngestionCredit(creditId);
        } catch (releaseErr) {
          req.log.error({ err: releaseErr, creditId }, "Failed to release ingestion credit after error");
        }
      }
    }
  },
);

router.get(
  "/ingest/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    const rows = await db
      .select()
      .from(ingestionDocumentsTable)
      .where(
        and(
          eq(ingestionDocumentsTable.id, id),
          eq(ingestionDocumentsTable.userId, req.localUser!.id),
        ),
      )
      .limit(1);
    if (rows.length === 0) {
      res.status(404).json({ error: "Ingestion not found" });
      return;
    }
    res.json(serializeIngestion(rows[0]!));
  },
);

router.post(
  "/ingest/:id/start-session",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    const userId = req.localUser!.id;
    const rows = await db
      .select()
      .from(ingestionDocumentsTable)
      .where(
        and(
          eq(ingestionDocumentsTable.id, id),
          eq(ingestionDocumentsTable.userId, userId),
        ),
      )
      .limit(1);
    const ingestion = rows[0];
    if (!ingestion) {
      res.status(404).json({ error: "Ingestion not found" });
      return;
    }
    const requestedName =
      typeof req.body?.sessionName === "string" && req.body.sessionName.trim()
        ? req.body.sessionName.trim().slice(0, 255)
        : `Ingested: ${ingestion.detectedTitle ?? ingestion.originalFilename}`.slice(0, 255);

    // Allow the operator to commit edits to the seed prompt / title made in the
    // ingestion review UI before initiating the session. Downstream HARNESS
    // engines read from the persisted ingestion record, so updates must land
    // here, not just in client state.
    const editedSeed =
      typeof req.body?.seedPrompt === "string" ? req.body.seedPrompt.trim() : null;
    const editedTitle =
      typeof req.body?.detectedTitle === "string"
        ? req.body.detectedTitle.trim().slice(0, 500)
        : null;
    if (
      (editedSeed && editedSeed.length >= 20 && editedSeed !== ingestion.seedPrompt) ||
      (editedTitle && editedTitle !== ingestion.detectedTitle)
    ) {
      await db
        .update(ingestionDocumentsTable)
        .set({
          ...(editedSeed && editedSeed.length >= 20
            ? { seedPrompt: editedSeed.slice(0, 4000) }
            : {}),
          ...(editedTitle ? { detectedTitle: editedTitle } : {}),
        })
        .where(eq(ingestionDocumentsTable.id, ingestion.id));
    }

    const [created] = await db
      .insert(harnessSessionsTable)
      .values({
        userId,
        sessionName: requestedName,
        origin: "ingested",
        ingestionId: ingestion.id,
      })
      .returning();
    await db.insert(harnessFeatureStateTable).values(
      [1, 2, 3, 4, 5, 6, 7].map((featureId) => ({
        sessionId: created!.id,
        featureId,
        status: featureId === 1 ? ("AVAILABLE" as const) : ("LOCKED" as const),
        unlockedAt: featureId === 1 ? new Date() : null,
      })),
    );
    res.status(201).json(serializeSession(created!));
  },
);

router.get(
  "/sessions/:id/ingestion",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const sessionId = String(req.params.id);
    const sessions = await db
      .select()
      .from(harnessSessionsTable)
      .where(
        and(
          eq(harnessSessionsTable.id, sessionId),
          eq(harnessSessionsTable.userId, req.localUser!.id),
        ),
      )
      .limit(1);
    const session = sessions[0];
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    if (!session.ingestionId) {
      res.status(404).json({ error: "Session has no ingestion record" });
      return;
    }
    // Defence-in-depth: scope by owner even though the session already is.
    const rows = await db
      .select()
      .from(ingestionDocumentsTable)
      .where(
        and(
          eq(ingestionDocumentsTable.id, session.ingestionId),
          eq(ingestionDocumentsTable.userId, req.localUser!.id),
        ),
      )
      .limit(1);
    if (rows.length === 0) {
      res.status(404).json({ error: "Ingestion not found" });
      return;
    }
    res.json(serializeIngestion(rows[0]!));
  },
);

export default router;
