import { buildArtifactFilename } from "@workspace/artifact-naming";

export type ExemplarDownloadInput = {
  id: string;
  kind: "SPC" | "PDD" | "MA" | "MPDD";
  title: string;
};

export type ExemplarDownloadFormat = {
  extension: "json" | "md";
  mimeType: "application/json;charset=utf-8" | "text/markdown;charset=utf-8";
};

export function buildExemplarDownloadFilename(
  item: ExemplarDownloadInput,
  extension: ExemplarDownloadFormat["extension"],
  downloadedAt = new Date(),
): string {
  return buildArtifactFilename(
    {
      type: item.kind,
      title: item.title,
      id: item.id,
      extension,
    },
    downloadedAt,
  );
}

export function getExemplarDownloadFormat(body: string): ExemplarDownloadFormat {
  try {
    const value: unknown = JSON.parse(body);
    if (value !== null && typeof value === "object") {
      return {
        extension: "json",
        mimeType: "application/json;charset=utf-8",
      };
    }
  } catch {
    // Library documents that are not JSON are downloaded as Markdown text.
  }

  return {
    extension: "md",
    mimeType: "text/markdown;charset=utf-8",
  };
}