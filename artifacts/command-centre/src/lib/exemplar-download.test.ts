import { describe, expect, it } from "vitest";
import {
  buildExemplarDownloadFilename,
  getExemplarDownloadFormat,
} from "./exemplar-download";

describe("Exemplar Library download naming", () => {
  const downloadedAt = new Date(2026, 8, 24, 18, 39, 7);

  it("uses type, a safe title, stable library ID, and local timestamp", () => {
    expect(
      buildExemplarDownloadFilename(
        {
          id: "mitchell-exemplar-2",
          kind: "SPC",
          title: "Mitch / Field Notes",
        },
        "md",
        downloadedAt,
      ),
    ).toBe("SPC.MITCH.FIELD.NOTES.MITCHELL-EXEMPLAR-2.09.24.26.6-39-07PM.md");
  });

  it("keeps otherwise identical downloads distinct by exemplar ID", () => {
    const first = buildExemplarDownloadFilename(
      { id: "item-one", kind: "SPC", title: "Mitch" },
      "md",
      downloadedAt,
    );
    const second = buildExemplarDownloadFilename(
      { id: "item-two", kind: "SPC", title: "Mitch" },
      "md",
      downloadedAt,
    );

    expect(first).not.toBe(second);
  });

  it("uses JSON for structured artifact snapshots and Markdown for text", () => {
    expect(getExemplarDownloadFormat('{"sections":[]}')).toEqual({
      extension: "json",
      mimeType: "application/json;charset=utf-8",
    });
    expect(getExemplarDownloadFormat("# Exemplar")).toEqual({
      extension: "md",
      mimeType: "text/markdown;charset=utf-8",
    });
  });
});