import JSZip from "jszip";
import { saveAs } from "file-saver";

export async function downloadZip(
  filename: string,
  files: Record<string, string>,
): Promise<void> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, filename);
}
