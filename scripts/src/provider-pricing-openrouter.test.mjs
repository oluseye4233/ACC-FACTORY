import { test } from "node:test";
import assert from "node:assert/strict";
import { extractProviderRates, compareProviderRates } from "./provider-pricing-extractors.mjs";

const source = { id: "openrouter-kimi", modelIds: ["moonshotai/kimi-k3"] };
const model = { id: source.modelIds[0], pricing: {
  prompt: "0.000000239", completion: "0.0000108", input_cache_read: "0.00000021",
} };
const document = (models) => JSON.stringify({ data: models });

test("OpenRouter observation converts per-token USD without including unrelated models", () => {
  assert.deepEqual(extractProviderRates(source, document([model, {
    id: "unrelated/model", pricing: model.pricing,
  }])), { "moonshotai/kimi-k3": {
    currency: "USD", inputPerMTok: 0.239, outputPerMTok: 10.8, cachedInputPerMTok: 0.21,
  } });
});
test("OpenRouter observation preserves tier overrides for drift review", () => {
  const overrides = [{ min_prompt_tokens: 256000, prompt: "0.00000096" }];
  const rates = extractProviderRates(source, document([{
    ...model, pricing: { ...model.pricing, overrides },
  }]));
  assert.deepEqual(rates[model.id].overrides, overrides);
});
test("a retired OpenRouter model and changed rate remain review failures", () => {
  const before = extractProviderRates(source, document([model]));
  assert.throws(() => extractProviderRates(source, document([])), /no model rate rows/);
  assert.deepEqual(compareProviderRates(before, {}, [model.id]).retiredModels, [model.id]);
  const after = extractProviderRates(source, document([{
    ...model, pricing: { ...model.pricing, completion: "0.00002" },
  }]));
  assert.equal(compareProviderRates(before, after, [model.id]).rateChanges.length, 1);
});
test("malformed OpenRouter pricing fails explicitly", () => {
  assert.throws(() => extractProviderRates(source, document([{
    ...model, pricing: { prompt: "not-a-number", completion: "1" },
  }])), /Invalid OpenRouter rate/);
  assert.throws(() => extractProviderRates(source, "{}"), /Invalid OpenRouter model catalog/);
});
