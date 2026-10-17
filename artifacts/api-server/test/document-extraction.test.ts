import PDFDocument from "pdfkit";
import { describe, expect, test } from "vitest";
import {
  DocumentExtractionError,
  prepareUploadedDocument,
} from "../src/lib/document-extraction";

async function makePdf(text?: string): Promise<Buffer> {
  const doc = new PDFDocument({ compress: true });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  if (text) doc.text(text);
  doc.end();
  return done;
}

const options = { minChars: 50, maxChars: 10_000 };
const documentText =
  "PDF ingestion regression: accept a real document and extract its requirements before starting the review.";

describe("real document extraction (no PDF parser mocks)", () => {
  test.each(["application/pdf", "application/octet-stream"])(
    "extracts a valid PDF uploaded as %s",
    async (mimetype) => {
      const result = await prepareUploadedDocument({
        buffer: await makePdf(documentText),
        originalname: "requirements.PDF",
        mimetype,
      }, options);
      expect(result.mimeType).toBe("application/pdf");
      expect(result.text.replace(/\s+/g, " ")).toBe(documentText);
    },
  );

  test("can parse consecutive uploads and applies the text bound", async () => {
    const buffer = await makePdf(documentText);
    for (let i = 0; i < 2; i++) {
      const result = await prepareUploadedDocument({
        buffer, originalname: "requirements.pdf", mimetype: "application/pdf",
      }, { minChars: 10, maxChars: 30 });
      expect(result.text).toBe(documentText.slice(0, 30));
    }
  });

  test("rejects a corrupt PDF with the structured extraction error", async () => {
    await expect(prepareUploadedDocument({
      buffer: Buffer.from("%PDF-1.7\nbroken document"),
      originalname: "broken.pdf", mimetype: "application/pdf",
    }, options)).rejects.toMatchObject({
      name: "DocumentExtractionError", code: "FILE_EXTRACTION_FAILED",
    });
  });

  test("does not treat blank-PDF page decorations as extractable content", async () => {
    await expect(prepareUploadedDocument({
      buffer: await makePdf(),
      originalname: "blank.pdf", mimetype: "application/pdf",
    }, { minChars: 1, maxChars: 10_000 })).rejects.toMatchObject({
      code: "FILE_TOO_SHORT",
    });
  });

  test("retains format validation instead of accepting text disguised as PDF", async () => {
    try {
      await prepareUploadedDocument({
        buffer: Buffer.from(documentText),
        originalname: "fake.pdf", mimetype: "application/pdf",
      }, options);
      expect.fail("Expected a format mismatch");
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentExtractionError);
      expect(error).toMatchObject({ code: "FILE_FORMAT_MISMATCH" });
    }
  });
});
