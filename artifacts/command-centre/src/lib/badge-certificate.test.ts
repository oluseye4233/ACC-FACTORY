import { describe, expect, it } from "vitest";
import { buildBadgeCertificateFilename } from "./badge-certificate";

describe("badge certificate download naming", () => {
  const downloadedAt = new Date(2026, 8, 24, 18, 39, 7);

  it("names a standard certificate with its badge title, certificate ID, local time, and SVG extension", () => {
    expect(
      buildBadgeCertificateFilename(
        {
          badgeId: "AISA",
          badgeFullName: "ATOMIC INTELLIGENT SYSTEMS ARCHITECT",
          recipientName: "A. Tanda",
          unlockedAt: "2026-09-20",
        },
        "svg",
        downloadedAt,
      ),
    ).toBe("CERTIFICATE.ATOMIC.INTELLIGENT.SYSTEMS.ARCHITECT.5DA79622.09.24.26.6-39-07PM.svg");
  });

  it("names senior certificates with the same stable certificate ID used in the image", () => {
    const filename = buildBadgeCertificateFilename(
      {
        badgeId: "AISE_BUILD",
        badgeFullName: "Advanced Atomic Intelligent Systems Engineer",
        recipientName: "Senior / Operator",
        unlockedAt: "2026-09-20",
      },
      "jpg",
      downloadedAt,
    );

    expect(filename).toMatch(
      /^CERTIFICATE\.ADVANCED.ATOMIC.INTELLIGENT.SYSTEMS.ENGINEER\.[A-F0-9]{8}\.09\.24\.26\.6-39-07PM\.jpg$/,
    );
  });

  it("keeps the actual raster format extension", () => {
    const input = {
      badgeId: "AISE_BUILD" as const,
      badgeFullName: "Advanced Atomic Intelligent Systems Engineer",
      recipientName: "Operator",
      unlockedAt: "2026-09-20",
    };

    expect(buildBadgeCertificateFilename(input, "png", downloadedAt)).toMatch(/\.png$/);
    expect(buildBadgeCertificateFilename(input, "jpg", downloadedAt)).toMatch(/\.jpg$/);
  });
});