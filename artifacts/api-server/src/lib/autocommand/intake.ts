import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod/v4";
import {
  db, autoCommandDraftsTable as drafts, autoCommandUploadsTable as uploads,
} from "@workspace/db";
import { AUTO_COMMAND_TARGETS, packageFor } from "./catalog";
import { governanceHash } from "../artifact-governance";
import { savePrivate, fileHash } from "../artifact-operations/private-storage";
import { prepareUploadedDocument } from "../document-extraction";

export class AutoCommandError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const shortName = z.string().trim().min(2).max(160);
export const AutoCommandIntakeSchema = z.object({
  requestKey: z.uuid(),
  projectName: shortName,
  packageType: z.enum(["BASIC_AGENT", "ADVANCED_AGENT", "WEB_APPLICATION"]),
  intakeMode: z.enum(["PROMPT", "INTAKE", "CARTRIDGE"]),
  documentType: z.enum(["BUSINESS_ANALYSIS", "BUSINESS_PLAN", "BUSINESS_CASE", "FEASIBILITY_STUDY", "PRODUCT_BRIEF"]),
  specification: z.string().trim().min(40).max(40000),
  targetEmail: z.email().max(320).transform(value => value.trim().toLowerCase()),
  contactName: shortName,
  phone: z.string().trim().min(5).max(40).regex(/^[+()\d .-]+$/, "Use a telephone number."),
  ownerName: shortName,
  creatorName: shortName,
  companyName: z.string().trim().max(160).optional(),
  logoUploadId: z.uuid().optional(),
  documentUploadId: z.uuid().optional(),
  cartridgeContext: z.string().trim().max(20000).optional(),
  targets: z.array(z.enum(AUTO_COMMAND_TARGETS)).min(1).max(8)
    .refine(values => new Set(values).size === values.length, "Choose each implementation target once."),
  rightsConfirmed: z.literal(true, { error: "Confirm your authority to use the supplied material." }),
}).strict().superRefine((value, context) => {
  if (value.intakeMode === "INTAKE" && !value.documentUploadId) {
    context.addIssue({ code: "custom", path: ["documentUploadId"], message: "Use IMPRIMA Portal to upload your input document." });
  }
  if (value.intakeMode === "CARTRIDGE" && (value.cartridgeContext?.length ?? 0) < 20) {
    context.addIssue({ code: "custom", path: ["cartridgeContext"], message: "Provide at least 20 characters of existing SPC or cartridge context." });
  }
  if (value.logoUploadId && !value.companyName) {
    context.addIssue({ code: "custom", path: ["companyName"], message: "Add a company name for a corporate logo." });
  }
  if (value.companyName && value.ownerName !== value.companyName) {
    context.addIssue({ code: "custom", path: ["ownerName"], message: "For a corporate package, use the company name as owner and the member's name as creator." });
  }
});
export type AutoCommandInput = z.infer<typeof AutoCommandIntakeSchema>;
type Draft = typeof drafts.$inferSelect;

export function draftView(row: Draft, files: (typeof uploads.$inferSelect)[] = []) {
  const input = row.input as AutoCommandInput;
  return {
    id: row.id, state: "DRAFT" as const, verifiedEmail: row.verifiedEmail,
    projectName: row.projectName, packageType: row.packageType,
    standardPriceCents: packageFor(row.packageType).priceCents,
    promotionStatus: "CHECK_AT_CHECKOUT" as const,
    input,
    uploads: files.filter(file => file.id === input.documentUploadId || file.id === input.logoUploadId)
      .map(file => ({ id: file.id, filename: file.filename, purpose: file.purpose as "DOCUMENT" | "LOGO",
        extractedCharacters: file.extractedText?.length ?? 0 })),
    createdAt: row.createdAt.toISOString(),
  };
}
export async function autoCommandWorkspace(userId: string, verifiedEmail: string) {
  const rows = await db.select().from(drafts).where(eq(drafts.userId, userId))
    .orderBy(desc(drafts.createdAt)).limit(50);
  const ids = rows.flatMap(row => [row.input.documentUploadId, row.input.logoUploadId]).filter((id): id is string => typeof id === "string");
  const files = ids.length ? await db.select().from(uploads).where(and(eq(uploads.userId, userId),
    eq(uploads.state, "STORED"), inArray(uploads.id, ids))) : [];
  return { authenticated: true, verifiedEmail, drafts: rows.map(row => draftView(row, files)) };
}
export async function saveAutoCommandDraft(userId: string, verifiedEmail: string, input: AutoCommandInput) {
  packageFor(input.packageType);
  // Identity supplied by the verified server-side provider, never request input.
  const email = verifiedEmail.trim().toLowerCase();
  if (!email || !z.email().safeParse(email).success) throw new AutoCommandError(401, "A verified email is required.");
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`autocommand-draft:${userId}`}, 0))`);
    const [existing] = await tx.select().from(drafts)
      .where(and(eq(drafts.userId, userId), eq(drafts.requestKey, input.requestKey))).limit(1);
    if (existing) {
      if (governanceHash(existing.input) !== governanceHash(input)) {
        throw new AutoCommandError(409, "This request key belongs to a different intake. Save your changes as a new draft.");
      }
      const ids = [input.documentUploadId, input.logoUploadId].filter((id): id is string => Boolean(id));
      const files = ids.length ? await tx.select().from(uploads).where(and(eq(uploads.userId, userId),
        eq(uploads.state, "STORED"), inArray(uploads.id, ids))) : [];
      return draftView(existing, files);
    }
    const recent = await tx.select({ id: drafts.id }).from(drafts)
      .where(and(eq(drafts.userId, userId), gt(drafts.createdAt, new Date(Date.now() - 15 * 60_000)))).limit(10);
    if (recent.length >= 10) throw new AutoCommandError(429, "You have saved ten drafts recently. Please wait before saving more.");
    const expected = [
      ...(input.documentUploadId ? [{ id: input.documentUploadId, purpose: "DOCUMENT" }] : []),
      ...(input.logoUploadId ? [{ id: input.logoUploadId, purpose: "LOGO" }] : []),
    ];
    let files: (typeof uploads.$inferSelect)[] = [];
    if (expected.length) {
      files = await tx.select().from(uploads).where(and(eq(uploads.userId, userId),
        eq(uploads.state, "STORED"), inArray(uploads.id, expected.map(item => item.id))));
      if (expected.some(item => !files.some(row => row.id === item.id && row.purpose === item.purpose))) {
        throw new AutoCommandError(404, "An IMPRIMA intake file is not available to your verified account.");
      }
    }
    const [saved] = await tx.insert(drafts).values({
      userId, verifiedEmail: email, requestKey: input.requestKey, projectName: input.projectName,
      packageType: input.packageType, input,
    }).returning();
    return draftView(saved!, files);
  });
}

/** Reject active SVG/HTML and misleading file extensions; only raster logos. */
export function validateAutoCommandLogo(bytes: Buffer, filename: string) {
  const png = bytes.length > 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    && bytes.subarray(12, 16).toString("ascii") === "IHDR";
  const jpeg = bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
  if (bytes.length > 2_000_000) throw new AutoCommandError(413, "Corporate logos must be 2 MB or smaller.");
  if (png && /\.png$/i.test(filename)) {
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
    if (!width || !height || width > 8192 || height > 8192) throw new AutoCommandError(400, "Use a logo with dimensions up to 8192 pixels.");
    return "image/png";
  }
  if (jpeg && /\.jpe?g$/i.test(filename)) return "image/jpeg";
  throw new AutoCommandError(400, "Use a genuine PNG or JPEG logo. SVG and renamed files are not supported.");
}
export async function uploadAutoCommandFile(
  userId: string, purpose: "DOCUMENT" | "LOGO", file: Pick<Express.Multer.File, "buffer" | "originalname" | "mimetype">,
) {
  if (!file.buffer.length || file.buffer.length > 5_000_000) throw new AutoCommandError(413, "Choose a non-empty file up to 5 MB.");
  // Never retain a client path or allow control characters in a displayed filename.
  const filename = file.originalname.split(/[\\/]/).at(-1)!.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 180);
  let mime: string;
  let extractedText: string | null = null;
  if (purpose === "LOGO") mime = validateAutoCommandLogo(file.buffer, filename);
  else {
    const prepared = await prepareUploadedDocument({ ...file, originalname: filename }, { minChars: 40, maxChars: 40001 });
    if (prepared.text.length > 40000) throw new AutoCommandError(413, "This document exceeds the 40,000-character intake limit. Supply a shorter specification.");
    mime = prepared.mimeType;
    extractedText = prepared.text;
  }
  const id = randomUUID(), storageKey = `autocommand-intake/${userId}/${id}`;
  // Record upload intent before writing immutable bytes; failed intents remain auditable.
  await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`autocommand-upload:${userId}`}, 0))`);
    const recent = await tx.select({ id: uploads.id }).from(uploads)
      .where(and(eq(uploads.userId, userId), gt(uploads.createdAt, new Date(Date.now() - 15 * 60_000)))).limit(10);
    if (recent.length >= 10) throw new AutoCommandError(429, "Wait before uploading more intake files.");
    await tx.insert(uploads).values({
      id, userId, purpose, filename, mime, storageKey, contentHash: fileHash(file.buffer), extractedText,
    });
  });
  try {
    await savePrivate(storageKey, file.buffer, mime);
    await db.update(uploads).set({ state: "STORED" }).where(and(eq(uploads.id, id), eq(uploads.userId, userId)));
  } catch (error) {
    await db.update(uploads).set({ state: "FAILED" }).where(and(eq(uploads.id, id), eq(uploads.userId, userId)));
    throw error;
  }
  return { id, filename, purpose, extractedCharacters: extractedText?.length ?? 0 };
}
