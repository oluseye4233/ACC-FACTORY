import { readFile } from "node:fs/promises";
import { fileHash, readPrivate } from "./private-storage";
import { OperationsError } from "./context";

export const PDF_FONT_KEY = "document-fonts/dejavu-sans";
export const PDF_FONT_HASH = "ae7b7855e115a5966d8b1b3f80f254ccc117ec86f9965e202ee2940453837280";
let cached: Promise<Buffer> | undefined;
export function documentPdfFont() {
  if (!cached) cached = (async () => {
    let bytes: Buffer;
    try { bytes = await readFile("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"); }
    catch { bytes = await readPrivate(PDF_FONT_KEY, PDF_FONT_HASH); }
    if (fileHash(bytes) !== PDF_FONT_HASH) throw new OperationsError(503, "The approved Unicode PDF font failed its integrity check.");
    return bytes;
  })().catch(error => { cached = undefined; throw error; });
  return cached;
}
