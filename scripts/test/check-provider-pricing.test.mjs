import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  compareProviderRates,
  extractProviderRates,
} from "../src/provider-pricing-extractors.mjs";

const fixturePath = new URL("./fixtures/provider-pricing/", import.meta.url);

async function fixture(name) {
  return readFile(new URL(name, fixturePath), "utf8");
}

test("extracts Anthropic model IDs, cache prices, and all base rate fields", async () => {
  const rates = extractProviderRates(
    { id: "anthropic", modelIds: ["claude-sonnet-4-6"] },
    await fixture("anthropic.html"),
  );

  assert.deepEqual(rates["claude-sonnet-4-6"], {
    currency: "USD",
    inputPerMTok: 3,
    outputPerMTok: 15,
    cacheWrite5mPerMTok: 3.75,
    cacheWrite1hPerMTok: 6,
    cachedInputPerMTok: 0.3,
  });
  assert.deepEqual(rates["claude-sonnet-5"], {
    currency: "USD",
    inputPerMTok: 2,
    outputPerMTok: 10,
    cacheWrite5mPerMTok: 2.5,
    cacheWrite1hPerMTok: 4,
    cachedInputPerMTok: 0.2,
  });
});

test("extracts OpenAI cached input and long-context tier rates", async () => {
  const rates = extractProviderRates(
    { id: "openai", modelIds: ["gpt-5.4"] },
    await fixture("openai.html"),
  );

  assert.deepEqual(rates["gpt-5.4"], {
    currency: "USD",
    inputPerMTok: 2.5,
    cachedInputPerMTok: 0.25,
    outputPerMTok: 15,
    inputTiers: [
      {
        maxInputTokens: 272_000,
        rates: {
          currency: "USD",
          inputPerMTok: 2.5,
          cachedInputPerMTok: 0.25,
          outputPerMTok: 15,
        },
      },
      {
        maxInputTokens: "unbounded",
        rates: {
          currency: "USD",
          inputPerMTok: 5,
          cachedInputPerMTok: 0.5,
          outputPerMTok: 22.5,
        },
      },
    ],
  });
});

test("extracts Gemini's paid-tier rates by model heading", async () => {
  const rates = extractProviderRates(
    { id: "google", modelIds: ["gemini-3.1-pro-preview"] },
    await fixture("google.html"),
  );

  assert.deepEqual(rates["gemini-3.1-pro-preview"], {
    currency: "USD",
    inputPerMTok: 2,
    cachedInputPerMTok: 0.2,
    outputPerMTok: 12,
    cacheStoragePerMTokHour: 4.5,
    inputTiers: [
      {
        maxInputTokens: 200_000,
        rates: {
          inputPerMTok: 2,
          outputPerMTok: 12,
          cachedInputPerMTok: 0.2,
        },
      },
      {
        maxInputTokens: "unbounded",
        rates: {
          inputPerMTok: 4,
          outputPerMTok: 18,
          cachedInputPerMTok: 0.4,
        },
      },
    ],
  });
});

test("extracts DeepSeek's cache-hit, cache-miss, peak, and off-peak rates", async () => {
  const rates = extractProviderRates(
    { id: "deepseek", modelIds: ["deepseek-flash"] },
    await fixture("deepseek.html"),
  );

  assert.deepEqual(rates["deepseek-flash"], {
    currency: "USD",
    rateVariants: {
      offPeak: {
        cachedInputPerMTok: 0.003,
        inputPerMTok: 0.15,
        outputPerMTok: 0.6,
      },
      peak: {
        cachedInputPerMTok: 0.006,
        inputPerMTok: 0.3,
        outputPerMTok: 1.2,
      },
    },
    inputPerMTok: 0.3,
    cachedInputPerMTok: 0.006,
    outputPerMTok: 1.2,
  });
  assert.equal(rates["deepseek-v4-pro"].outputPerMTok, 3.96);
});

test("extracts Kimi cache-write, cached-input, input, and output rates", async () => {
  const rates = extractProviderRates(
    { id: "moonshot", modelIds: ["kimi-k3"] },
    await fixture("moonshot.md"),
  );

  assert.deepEqual(rates["kimi-k3"], {
    currency: "USD",
    cacheWrite5mPerMTok: 3,
    cacheWrite1hPerMTok: 6,
    cachedInputPerMTok: 0.3,
    inputPerMTok: 3,
    outputPerMTok: 15,
  });
  assert.equal(rates["kimi-k2.6"].outputPerMTok, 4);
});

test("extracts Qwen rate tiers and thinking-mode output prices", async () => {
  const rates = extractProviderRates(
    { id: "qwen", modelIds: ["qwen3.7-plus"] },
    await fixture("qwen.html"),
  );

  assert.deepEqual(rates["qwen3.7-plus"].inputTiers, [
    {
      maxInputTokens: 256_000,
      rates: {
        inputPerMTok: 0.4,
        outputPerMTok: 1.6,
        thinkingOutputPerMTok: 1.6,
      },
    },
    {
      maxInputTokens: 1_000_000,
      rates: {
        inputPerMTok: 1.2,
        outputPerMTok: 4.8,
        thinkingOutputPerMTok: 4.8,
      },
    },
  ]);
  assert.equal(rates["qwen3.7-plus-2026-05-26"].inputPerMTok, 0.4);
});

test("extracts GLM source prices with their distinct currencies", async () => {
  const chinaRates = extractProviderRates(
    { id: "glm-cn", modelIds: ["glm-5.3"] },
    await fixture("glm-cn.html"),
  );
  const internationalRates = extractProviderRates(
    { id: "glm-international", modelIds: ["glm-5.3"] },
    await fixture("glm-international.html"),
  );

  assert.deepEqual(chinaRates["glm-5.3"], {
    currency: "CNY",
    inputPerMTok: 8,
    outputPerMTok: 28,
    cachedInputPerMTok: 2,
  });
  assert.deepEqual(internationalRates["glm-5.3"], {
    currency: "USD",
    inputPerMTok: 1.4,
    outputPerMTok: 4.4,
    cachedInputPerMTok: 0.26,
  });
});

test("compares new and retired models separately from exact rate-field changes", () => {
  const result = compareProviderRates(
    {
      "old-model": {
        currency: "USD",
        cachedInputPerMTok: 0.2,
        inputPerMTok: 1,
        outputPerMTok: 2,
        inputTiers: [{ maxInputTokens: 100, rates: { outputPerMTok: 2 } }],
      },
      "retired-model": { currency: "USD", inputPerMTok: 1 },
    },
    {
      "new-model": { currency: "USD", inputPerMTok: 3 },
      "old-model": {
        currency: "USD",
        cachedInputPerMTok: 0.1,
        inputPerMTok: 1.5,
        outputPerMTok: 2,
        inputTiers: [{ maxInputTokens: 100, rates: { outputPerMTok: 2.5 } }],
      },
    },
  );

  assert.deepEqual(result.addedModels, ["new-model"]);
  assert.deepEqual(result.retiredModels, ["retired-model"]);
  assert.deepEqual(result.addedModelRates, [
    { modelId: "new-model", field: "currency", current: "USD" },
    { modelId: "new-model", field: "inputPerMTok", current: 3 },
  ]);
  assert.deepEqual(result.rateChanges, [
    {
      modelId: "old-model",
      field: "cachedInputPerMTok",
      previous: 0.2,
      current: 0.1,
    },
    {
      modelId: "old-model",
      field: "inputPerMTok",
      previous: 1,
      current: 1.5,
    },
    {
      modelId: "old-model",
      field: "inputTiers[<=100].rates.outputPerMTok",
      previous: 2,
      current: 2.5,
    },
  ]);
});

test("uses the reviewed model catalog separately from rate snapshots", () => {
  const result = compareProviderRates(
    { "priced-model": { currency: "USD", inputPerMTok: 1 } },
    {
      "priced-model": { currency: "USD", inputPerMTok: 1 },
      "catalog-only-model": { currency: "USD", inputPerMTok: 2 },
    },
    ["priced-model", "catalog-only-model", "retired-model"],
  );

  assert.deepEqual(result.addedModels, []);
  assert.deepEqual(result.retiredModels, ["retired-model"]);
  assert.deepEqual(result.addedModelRates, []);
  assert.deepEqual(result.rateChanges, []);
});