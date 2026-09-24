export type ArtifactFilenameInput = {
  type: string;
  title: string;
  id: string;
  extension: string;
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

function typeToken(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "ARTIFACT"
  );
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

function extensionToken(value: string): string {
  const token = value.replace(/^\.+/, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  return token || "bin";
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Produce a filesystem-safe filename for any generated platform artifact.
 *
 * Format: TYPE.TITLE.ID.MM.DD.YY.H-MM-SSAM.ext
 * Timestamp uses the local time of the downloading client/server.
 */
export function buildArtifactFilename(
  artifact: ArtifactFilenameInput,
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

  return `${typeToken(artifact.type)}.${titleToken(artifact.title)}.${idToken(artifact.id)}.${timestamp}.${extensionToken(artifact.extension)}`;
}