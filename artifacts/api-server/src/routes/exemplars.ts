import {
  Router,
  type IRouter,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import multer from "multer";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  exemplarLibraryItemsTable,
  harnessArtifactsTable,
  type ExemplarKind,
} from "@workspace/db";
import { getExemplar, listExemplars } from "../data/exemplars";
import { requireAuth } from "../lib/auth";
import {
  DocumentExtractionError,
  documentExtractionErrorResponse,
  prepareUploadedDocument,
} from "../lib/document-extraction";
import {
  buildPublishedSpcMetadata,
  readSpcPlayerPublication,
} from "../lib/spc-player";

const router: IRouter = Router();
const MAX_FILES = 50;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: MAX_FILES, fileSize: MAX_FILE_BYTES },
});

function uploadLibraryFiles(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  upload.array("files", MAX_FILES)(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      res.status(400).json({
        error:
          err.code === "LIMIT_FILE_SIZE"
            ? "Each SPC file must be 2 MB or smaller."
            : `Upload no more than ${MAX_FILES} SPC files at once.`,
        code:
          err.code === "LIMIT_FILE_SIZE"
            ? "FILE_TOO_LARGE"
            : "UPLOAD_LIMIT_EXCEEDED",
      });
      return;
    }
    next(err);
  });
}

function itemSummary(row: typeof exemplarLibraryItemsTable.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    tagline: row.tagline,
    jcse: null,
    certClass: null,
    source: "generated" as const,
    kind: row.kind,
    sku: `OPEN-${row.kind}-${row.id.slice(0, 8).toUpperCase()}`,
    disc: null,
    marketplace: "open" as const,
    createdAt: row.createdAt.toISOString(),
    spcPlayer:
      row.kind === "SPC"
        ? readSpcPlayerPublication(row.artifactSnapshot)
        : null,
  };
}

router.get("/exemplars", async (_req, res): Promise<void> => {
  const contributed = await db
    .select()
    .from(exemplarLibraryItemsTable)
    .orderBy(desc(exemplarLibraryItemsTable.createdAt));
  res.json([
    ...listExemplars().map((item) => ({ ...item, marketplace: "curated" })),
    ...contributed.map(itemSummary),
  ]);
});

router.get("/exemplars/:id", async (req, res): Promise<void> => {
  const exemplar = getExemplar(req.params.id);
  if (exemplar) {
    res.json({ ...exemplar, marketplace: "curated" });
    return;
  }
  const [row] = await db
    .select()
    .from(exemplarLibraryItemsTable)
    .where(eq(exemplarLibraryItemsTable.id, String(req.params.id)))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Exemplar not found" });
    return;
  }
  res.json({ ...itemSummary(row), body: row.body });
});

router.post(
  "/exemplars/upload",
  requireAuth,
  uploadLibraryFiles,
  async (req, res): Promise<void> => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      res.status(400).json({ error: "Choose at least one SPC file or folder." });
      return;
    }
    const allowedKinds: ExemplarKind[] = ["SPC", "MA", "MPDD", "PDD"];
    const kind: ExemplarKind = allowedKinds.includes(req.body?.kind)
      ? req.body.kind
      : "SPC";
    try {
      const prepared = await Promise.all(
        files.map(async (file) => {
          const document = await prepareUploadedDocument(file, {
            minChars: 50,
            maxChars: 250_000,
          });
          const base = file.originalname
            .replace(/\.[^.]+$/, "")
            .replace(/[_-]+/g, " ")
            .trim();
          return {
            ownerUserId: req.localUser!.id,
            kind,
            title: base.slice(0, 255) || `${kind} Exemplar`,
            tagline: `Open Marketplace ${kind} contributed by a backend user`,
            body: document.text,
            originalFilename: file.originalname,
          };
        }),
      );
      const rows = await db.transaction((tx) =>
        tx.insert(exemplarLibraryItemsTable).values(prepared).returning(),
      );
      res.status(201).json({ items: rows.map(itemSummary), count: rows.length });
    } catch (error) {
      if (error instanceof DocumentExtractionError) {
        res.status(400).json(documentExtractionErrorResponse(error));
        return;
      }
      throw error;
    }
  },
);

router.post(
  "/exemplars/from-artifact",
  requireAuth,
  async (req, res): Promise<void> => {
    const artifactId =
      typeof req.body?.artifactId === "string" ? req.body.artifactId : "";
    const [artifact] = await db
      .select()
      .from(harnessArtifactsTable)
      .where(
        and(
          eq(harnessArtifactsTable.id, artifactId),
          eq(harnessArtifactsTable.userId, req.localUser!.id),
        ),
      )
      .limit(1);
    if (!artifact) {
      res.status(404).json({ error: "Artifact not found" });
      return;
    }
    const kind: ExemplarKind | null =
      artifact.artifactType === "SPC"
        ? "SPC"
        : artifact.artifactType === "MA_BIRTH_PACKAGE"
          ? "MA"
          : artifact.artifactType === "MICRO_PDD"
            ? "MPDD"
            : ["ATLAS_PDD", "ATLAS_PDD_JSON", "MVP_PDD"].includes(
                  artifact.artifactType,
                )
              ? "PDD"
              : null;
    if (!kind) {
      res.status(400).json({ error: "Only completed SPC and MA artifacts can be added." });
      return;
    }
    const artifactSnapshot = artifact.artifactContent as Record<string, unknown>;
    const snapshot =
      kind === "SPC"
        ? {
            ...artifactSnapshot,
            spcPlayer: buildPublishedSpcMetadata(
              artifactSnapshot,
              artifact.name || `${kind} Exemplar`,
              new Date(),
            ),
          }
        : artifactSnapshot;
    const body = JSON.stringify(snapshot, null, 2);
    const [row] = await db
      .insert(exemplarLibraryItemsTable)
      .values({
        ownerUserId: req.localUser!.id,
        sourceArtifactId: artifact.id,
        kind,
        title: (artifact.name || `${kind} Exemplar`).slice(0, 255),
        tagline: `Open Marketplace ${kind} created in the ATANDA HARNESS`,
        body,
        artifactSnapshot: snapshot,
      })
      .onConflictDoNothing({
        target: exemplarLibraryItemsTable.sourceArtifactId,
      })
      .returning();
    if (!row) {
      res.status(409).json({ error: "This artifact is already in the Exemplar Library." });
      return;
    }
    res.status(201).json(itemSummary(row));
  },
);

export default router;
