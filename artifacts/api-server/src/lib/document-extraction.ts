export const SUPPORTED_DOCUMENT_EXTENSIONS = [
  ".txt",
  ".md",
  ".pdf",
  ".docx",
] as const;

export const DOCUMENT_EXTRACTION_FAILURE_CODES = {
  extractionFailed: "FILE_EXTRACTION_FAILED",
  formatMismatch: "FILE_FORMAT_MISMATCH",
  tooShort: "FILE_TOO_SHORT",
} as const;

export type DocumentExtractionFailureCode =
  (typeof DOCUMENT_EXTRACTION_FAILURE_CODES)[keyof typeof DOCUMENT_EXTRACTION_FAILURE_CODES];

export interface ExtractedDocument {
  text: string;
  mimeType: string;
}

export interface PreparedDocument extends ExtractedDocument {
  text: string;
}

export class DocumentExtractionError extends Error {
  constructor(
    readonly code: DocumentExtractionFailureCode,
    readonly filename: string,
    options?: { cause?: unknown },
  ) {
    const accepted = `${SUPPORTED_DOCUMENT_EXTENSIONS.slice(0, -1).join(", ")}, or ${SUPPORTED_DOCUMENT_EXTENSIONS.at(-1)}`;
    const message =
      code === DOCUMENT_EXTRACTION_FAILURE_CODES.tooShort
        ? `"${filename}" contains too little extractable text.`
        : code === DOCUMENT_EXTRACTION_FAILURE_CODES.formatMismatch
          ? `"${filename}" does not contain the document format indicated by its filename or content type.`
        : `Could not extract text from "${filename}". Use a valid ${accepted} file.`;
    super(message, options);
    this.name = "DocumentExtractionError";
  }
}

type DocumentFormat = "text" | "pdf" | "docx";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function formatFromFilename(filename: string): DocumentFormat | null {
  const lower = filename.toLowerCase();
  if (
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".markdown")
  ) {
    return "text";
  }
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  return null;
}

function formatFromMime(mime: string | undefined): DocumentFormat | null {
  if (mime?.startsWith("text/")) return "text";
  if (mime === "application/pdf") return "pdf";
  if (mime === DOCX_MIME) return "docx";
  return null;
}

function detectDocumentFormat(buffer: Buffer): DocumentFormat | null {
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") return "pdf";

  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    ((buffer[2] === 0x03 && buffer[3] === 0x04) ||
      (buffer[2] === 0x05 && buffer[3] === 0x06) ||
      (buffer[2] === 0x07 && buffer[3] === 0x08))
  ) {
    const archiveMarkers = buffer.toString("latin1");
    if (
      archiveMarkers.includes("[Content_Types].xml") &&
      archiveMarkers.includes("word/")
    ) {
      return "docx";
    }
    return null;
  }

  const decoded = buffer.toString("utf8");
  if (
    !decoded.includes("\uFFFD") &&
    !decoded.includes("\u0000") &&
    !/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/.test(decoded)
  ) {
    return "text";
  }
  return null;
}

async function extractDocumentText(
  buffer: Buffer,
  filename: string,
  declaredMime: string | undefined,
): Promise<ExtractedDocument> {
  const mime = declaredMime ?? "application/octet-stream";
  const filenameFormat = formatFromFilename(filename);
  const mimeFormat = formatFromMime(declaredMime);
  const claimedFormat = filenameFormat ?? mimeFormat;
  const detectedFormat = detectDocumentFormat(buffer);

  if (!claimedFormat) {
    throw new Error("Unsupported document type");
  }

  if (
    !detectedFormat ||
    (filenameFormat && mimeFormat && filenameFormat !== mimeFormat) ||
    claimedFormat !== detectedFormat
  ) {
    throw new DocumentExtractionError(
      DOCUMENT_EXTRACTION_FAILURE_CODES.formatMismatch,
      filename,
    );
  }

  if (claimedFormat === "text") {
    return { text: buffer.toString("utf8"), mimeType: mime };
  }

  if (claimedFormat === "pdf") {
    const pdfParseMod = (await import("pdf-parse")) as unknown as
      | ((data: Buffer) => Promise<{ text: string }>)
      | { default: (data: Buffer) => Promise<{ text: string }> };
    const pdfParse =
      typeof pdfParseMod === "function" ? pdfParseMod : pdfParseMod.default;
    const parsed = await pdfParse(buffer);
    return { text: parsed.text, mimeType: "application/pdf" };
  }

  if (claimedFormat === "docx") {
    const mammothMod = await import("mammoth");
    const mammoth = (mammothMod.default ?? mammothMod) as {
      extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
    };
    const result = await mammoth.extractRawText({ buffer });
    return {
      text: result.value,
      mimeType:
        DOCX_MIME,
    };
  }

  throw new Error("Unsupported document type");
}

export async function prepareUploadedDocument(
  file: Pick<
    Express.Multer.File,
    "buffer" | "originalname" | "mimetype"
  >,
  options: { minChars: number; maxChars: number },
): Promise<PreparedDocument> {
  let extracted: ExtractedDocument;
  try {
    extracted = await extractDocumentText(
      file.buffer,
      file.originalname,
      file.mimetype,
    );
  } catch (cause) {
    if (cause instanceof DocumentExtractionError) throw cause;
    throw new DocumentExtractionError(
      DOCUMENT_EXTRACTION_FAILURE_CODES.extractionFailed,
      file.originalname,
      { cause },
    );
  }

  const cleaned = extracted.text.replace(/\u0000/g, "").trim();
  if (cleaned.length < options.minChars) {
    const error = new DocumentExtractionError(
      DOCUMENT_EXTRACTION_FAILURE_CODES.tooShort,
      file.originalname,
    );
    error.message = `"${file.originalname}" contains too little extractable text. At least ${options.minChars} characters are required.`;
    throw error;
  }

  return {
    text:
      cleaned.length > options.maxChars
        ? cleaned.slice(0, options.maxChars)
        : cleaned,
    mimeType: extracted.mimeType,
  };
}

export function documentExtractionErrorResponse(
  error: DocumentExtractionError,
): {
  error: string;
  code: DocumentExtractionFailureCode;
  filename: string;
} {
  return {
    error: error.message,
    code: error.code,
    filename: error.filename,
  };
}