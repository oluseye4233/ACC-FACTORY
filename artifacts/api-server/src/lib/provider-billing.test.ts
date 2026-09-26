import { describe, expect, it } from "vitest";
import {
  isMaterialProviderDifference,
  parseProviderBillingCsv,
} from "./provider-billing";

describe("parseProviderBillingCsv", () => {
  it("supports quoted commas and maps provider names to the ledger key", () => {
    const rows = parseProviderBillingCsv(
      [
        "model,amount_usd,provider,region",
        '"claude-sonnet, latest","$1.25",anthropic,us-east-1',
      ].join("\n"),
    );
    expect(rows).toEqual([
      {
        provider: "claude",
        modelId: "claude-sonnet, latest",
        amountUsd: "1.250000",
      },
    ]);
  });

  it("preserves six-decimal adjustments and normalizes provider keys", () => {
    const rows = parseProviderBillingCsv(
      [
        "provider,model,amount_usd",
        "OpenAI,gpt-5.4,1.250001",
        "openai,gpt-5.4,-0.000001",
        'openai,"gpt, other","$1,234.50"',
      ].join("\r\n"),
    );
    expect(rows).toEqual([
      { provider: "openai", modelId: "gpt-5.4", amountUsd: "1.250000" },
      { provider: "openai", modelId: "gpt, other", amountUsd: "1234.500000" },
    ]);
  });

  it("rejects missing columns, malformed amounts, and broken quoting", () => {
    expect(() => parseProviderBillingCsv("provider,model\nopenai,gpt")).toThrow(
      /must include provider, model, and amount_usd/,
    );
    expect(() =>
      parseProviderBillingCsv("provider,model,amount_usd\nopenai,gpt,1.2.3"),
    ).toThrow(/invalid amount_usd/);
    expect(() =>
      parseProviderBillingCsv('provider,model,amount_usd\nopenai,"gpt,1'),
    ).toThrow(/unterminated quoted field/);
  });
});

describe("isMaterialProviderDifference", () => {
  it("flags gaps of at least $1 and 5%, but ignores small rounding differences", () => {
    expect(isMaterialProviderDifference(100, 106)).toBe(true);
    expect(isMaterialProviderDifference(100, 104)).toBe(false);
    expect(isMaterialProviderDifference(100, 0)).toBe(true);
    expect(isMaterialProviderDifference(10, 10.5)).toBe(false);
    expect(isMaterialProviderDifference(10, 10)).toBe(false);
  });
});