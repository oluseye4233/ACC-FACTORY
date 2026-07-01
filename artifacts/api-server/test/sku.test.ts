import { describe, expect, it } from "vitest";
import {
  DEFAULT_SECTOR,
  PLATFORM_CREATOR_HASH,
  SKU_TYPE_BY_ARTIFACT,
  computeCreatorHash,
  formatSku,
  isSkuEligible,
} from "../src/lib/sku";

describe("Universal SKU Catalog — pure helpers (D24)", () => {
  it("formats a SKU in the canonical ARK-[TYPE]-[SECTOR]-[HASH]-[SEQ]-V[VER] shape", () => {
    const sku = formatSku({
      productType: "SPC",
      sector: "GEN",
      creatorHash: "abc123",
      seq: 7,
    });
    expect(sku).toBe("ARK-SPC-GEN-abc123-0007-V1");
    expect(sku).toMatch(/^ARK-[A-Z]{3}-[A-Z]{3}-[0-9a-f]{6}-\d{4}-V\d+$/);
  });

  it("zero-pads the sequence to four digits and honours an explicit version", () => {
    expect(
      formatSku({ productType: "PDD", sector: "GEN", creatorHash: "0f0f0f", seq: 1234, version: 3 }),
    ).toBe("ARK-PDD-GEN-0f0f0f-1234-V3");
  });

  it("computes a stable 6-hex-char creator hash from clerkId + email", () => {
    const a = computeCreatorHash("staff:alice", null);
    const b = computeCreatorHash("staff:alice", null);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{6}$/);
  });

  it("differentiates hashes by email so identity components matter", () => {
    expect(computeCreatorHash("user_1", "a@example.com")).not.toBe(
      computeCreatorHash("user_1", "b@example.com"),
    );
    // null and empty-string email are treated identically (email ?? "").
    expect(computeCreatorHash("user_1", null)).toBe(computeCreatorHash("user_1", ""));
  });

  it("only maps SPC and MVP_PDD to product-type codes; other types are not eligible", () => {
    expect(SKU_TYPE_BY_ARTIFACT.SPC).toBe("SPC");
    expect(SKU_TYPE_BY_ARTIFACT.MVP_PDD).toBe("PDD");
    expect(isSkuEligible("SPC")).toBe(true);
    expect(isSkuEligible("MVP_PDD")).toBe(true);
    expect(isSkuEligible("ATLAS_PDD")).toBe(false);
    expect(isSkuEligible("MICRO_PDD")).toBe(false);
  });

  it("exposes a stable platform creator hash for canonical library entries", () => {
    expect(PLATFORM_CREATOR_HASH).toBe(computeCreatorHash("ark:platform", null));
    expect(DEFAULT_SECTOR).toBe("GEN");
  });
});
