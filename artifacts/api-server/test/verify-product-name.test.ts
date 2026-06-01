import { describe, expect, it } from "vitest";
import { extractProductName } from "../src/routes/verify";

describe("extractProductName (MVP product identity on SPARTAN certificate)", () => {
  it("pulls the product name from the card_identity_metadata section", () => {
    const content = {
      donut: { a: 0.6, b: 0.27, c: 0.13 },
      sections: [
        {
          key: "card_identity_metadata",
          title: "Card Identity & Metadata",
          body: "**Product:** RED PEN AI\n**Owner:** Jason Stride — STRIDE INC\n**Version:** 1",
        },
        { key: "executive_summary", title: "Executive Summary", body: "..." },
      ],
    };
    expect(extractProductName(content)).toBe("RED PEN AI");
  });

  it("handles the bulleted '**Product Name:**' label variant", () => {
    const content = {
      sections: [
        {
          key: "card_identity_metadata",
          body: "- **Product Name:** RED PEN AI\n- **Owner:** Jason Stride (STRIDE INC)\n- **Version:** 1",
        },
      ],
    };
    expect(extractProductName(content)).toBe("RED PEN AI");
  });

  it("is case-insensitive on the Product label and trims the value", () => {
    const content = {
      sections: [{ key: "card_identity_metadata", body: "**product:**   Acme Widget  \n**Owner:** X" }],
    };
    expect(extractProductName(content)).toBe("Acme Widget");
  });

  it("returns null when the card section is missing", () => {
    const content = {
      sections: [{ key: "executive_summary", body: "**Product:** should be ignored" }],
    };
    expect(extractProductName(content)).toBeNull();
  });

  it("returns null when the card body has no Product line", () => {
    const content = {
      sections: [{ key: "card_identity_metadata", body: "**Owner:** Someone\n**Version:** 1" }],
    };
    expect(extractProductName(content)).toBeNull();
  });

  it("returns null when the Product value is blank", () => {
    const content = {
      sections: [{ key: "card_identity_metadata", body: "**Product:**   \n**Owner:** X" }],
    };
    expect(extractProductName(content)).toBeNull();
  });

  it("strips CRLF line endings from the value", () => {
    const content = {
      sections: [{ key: "card_identity_metadata", body: "**Product:** RED PEN AI\r\n**Owner:** X" }],
    };
    expect(extractProductName(content)).toBe("RED PEN AI");
  });

  it("uses the first Product occurrence when several appear", () => {
    const content = {
      sections: [
        { key: "card_identity_metadata", body: "**Product:** Primary Name\n**Product:** Secondary" },
      ],
    };
    expect(extractProductName(content)).toBe("Primary Name");
  });

  it("handles malformed content shapes safely", () => {
    expect(extractProductName(null)).toBeNull();
    expect(extractProductName(undefined)).toBeNull();
    expect(extractProductName("string")).toBeNull();
    expect(extractProductName({})).toBeNull();
    expect(extractProductName({ sections: "not-an-array" })).toBeNull();
    expect(extractProductName({ sections: [null, 42, { key: "x" }] })).toBeNull();
  });
});
