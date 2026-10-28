import PDFDocument from "pdfkit";
import { zipSync, strToU8 } from "fflate";
import { documentPdfFont } from "./artifact-operations/pdf-font";
import { CreatorError } from "./agent-creator";

export type PublicationDocument = {
  id: string; title: string; author: string; subscriberStamp: string;
  createdAt: Date; sourceHash: string; sourceType: string; content: unknown;
  native?: { filename: string; bytes: Buffer };
  artifactKind?: string;
};
const label = (key: string) => key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ");
function sections(value: unknown, heading = "", depth = 0): { heading: string; text: string }[] {
  if (depth > 8) return [{ heading, text: JSON.stringify(value) }];
  if (typeof value === "string") return [{ heading, text: value }];
  if (value === null || typeof value !== "object") return [{ heading, text: String(value) }];
  if (Array.isArray(value)) return value.flatMap((item, i) => sections(item, `${heading} ${i + 1}`, depth + 1));
  return Object.entries(value).flatMap(([key, item]) => sections(item, label(key), depth + 1));
}
export async function renderPortalPdf(input: PublicationDocument): Promise<Buffer> {
  const font = await documentPdfFont();
  const blocks = sections(input.content);
  if (JSON.stringify(input.content).length > 2_000_000 || blocks.length > 5000) throw new CreatorError(413, "Publication source exceeds the document size limit.");
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 54, bufferPages: true,
      info: { Title: input.title, Author: input.author, Creator: "ATANDA.IMPRIMA", Producer: "ATANDA",
        CreationDate: input.createdAt, Subject: `Publication ${input.id}; source ${input.sourceHash}` } });
    const chunks: Buffer[] = [];
    let bytes = 0;
    doc.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 12_000_000) doc.destroy(new Error("Publication exceeds storage limit."));
      else chunks.push(chunk);
    });
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    try {
      doc.font(font).fontSize(10).fillColor("#236246").text("ATANDA  /  IMPRIMA PORTAL");
      doc.moveDown().fontSize(24).fillColor("#142038").text(input.title);
      doc.moveDown().fontSize(10).text(`Author: ${input.author}\nPublisher: ATANDA\nSubscriber stamp: ${input.subscriberStamp}\nPublication: ${input.id}\nPublished: ${input.createdAt.toISOString()}`);
      doc.moveDown().fontSize(8).fillColor("#4A5568").text(`© ${input.createdAt.getUTCFullYear()} ${input.author}. Authorship and rights are declared by the subscriber. This publication is not copyright registration, an ownership determination, independent certification or deployment approval.\nSource SHA-256: ${input.sourceHash}`);
      doc.moveDown();
      for (const block of blocks) {
        if (doc.bufferedPageRange().count > 250) throw new CreatorError(413, "Publication exceeds 250 pages.");
        if (doc.y > doc.page.height - 130) doc.addPage();
        doc.fontSize(11).fillColor("#236246").text(block.heading || "Artifact", { continued: false });
        doc.moveDown(.3).fontSize(9).fillColor("#142038").text(block.text, { lineGap: 3 });
        doc.moveDown(.7);
      }
      const range = doc.bufferedPageRange();
      if (range.count > 250) throw new CreatorError(413, "Publication exceeds the 250-page limit.");
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        const oldBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.fontSize(7).fillColor("#4A5568").text(`${i + 1} / ${range.count}`, 54, doc.page.height - 34, { lineBreak: false });
        doc.text(`ATANDA.IMPRIMA · ${input.createdAt.toISOString()}`, 150, doc.page.height - 34,
          { width: doc.page.width - 204, align: "right", lineBreak: false });
        doc.page.margins.bottom = oldBottom;
      }
      doc.end();
    } catch (err) { doc.destroy(err instanceof Error ? err : new Error("Publication render failed.")); }
  });
}
export function publicationZip(input: PublicationDocument, pdf: Buffer): Buffer {
  const entries: Record<string, Uint8Array> = {
    "ATANDA.IMPRIMA-publication.pdf": pdf,
    "artifact.json": strToU8(JSON.stringify(input.content, null, 2)),
    "publication.json": strToU8(JSON.stringify({ id: input.id, title: input.title, author: input.author,
      publisher: "ATANDA", sourceHash: input.sourceHash, publishedAt: input.createdAt.toISOString(),
      declaration: "Publication is not copyright registration, independent verification or deployment approval." }, null, 2)),
  };
  if (input.native) {
    const name = input.native.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
    entries[`original/file-${name || "source.bin"}`] = input.native.bytes;
  }
  const content = input.content as { files?: { path?: unknown; content?: unknown }[] } | null;
  const files = content && Array.isArray(content.files) ? content.files : [];
  for (const file of files) {
    if (typeof file.path !== "string" || typeof file.content !== "string" ||
        file.path.startsWith("/") || file.path.includes("\\") || /[:\x00-\x1F]/.test(file.path) || file.path.split("/").some(part => !part || part === ".." || part === ".")) {
      throw new CreatorError(409, "Unsafe code path in artifact; publication was stopped.");
    }
    const key = `editable-code/${file.path}`;
    if (entries[key]) throw new CreatorError(409, "Duplicate code file in artifact.");
    entries[key] = strToU8(file.content);
  }
  return Buffer.from(zipSync(entries));
}
