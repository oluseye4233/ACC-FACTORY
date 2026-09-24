export type ExemplarDownloadInput = {
  id: string;
  kind: "SPC" | "PDD" | "MA" | "MPDD";
  title: string;
};

export type ExemplarDownloadFormat = {
  extension: "json" | "md";
  mimeType: "application/json;charset=utf-8" | "text/markdown;charset=utf-8";
};

function titleToken(value: string): string {
  const token = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 64)
    .replace(/\.+$/g, "");
  return token || "UNTITLED";
}

function idToken(value: string): string {
  const token = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return token || "NO-ID";
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function buildExemplarDownloadFilename(
  item: ExemplarDownloadInput,
  extension: ExemplarDownloadFormat["extension"],
  downloadedAt = new Date(),
): string {
  const month = pad2(downloadedAt.getMonth() + 1);
  const day = pad2(downloadedAt.getDate());
  const year = pad2(downloadedAt.getFullYear() % 100);
  const hour = downloadedAt.getHours() % 12 || 12;
  const minute = pad2(downloadedAt.getMinutes());
  const second = pad2(downloadedAt.getSeconds());
  const meridiem = downloadedAt.getHours() >= 12 ? "PM" : "AM";
  const timestamp = `${month}.${day}.${year}.${hour}-${minute}-${second}${meridiem}`;

  return `${item.kind}.${titleToken(item.title)}.${idToken(item.id)}.${timestamp}.${extension}`;
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