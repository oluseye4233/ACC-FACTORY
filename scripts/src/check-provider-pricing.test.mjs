import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { inspectSources } from "./check-provider-pricing.mjs";

function source(id, overrides = {}) {
  return {
    id,
    provider: id,
    url: `https://example.com/${id}`,
    modelIds: [`${id}-model`],
    sha256: "0".repeat(64),
    ...overrides,
  };
}

function htmlResponse(url, html, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    text: async () => html,
  };
}

function fingerprint(normalizedText) {
  return createHash("sha256").update(normalizedText, "utf8").digest("hex");
}

test("source inspection reports matching, changed, and unavailable sources independently", async () => {
  const matchingHtml = "<html><body>model-a pricing $1</body></html>";
  const changedHtml = "<html><body>model-b pricing $2</body></html>";
  const sources = [
    source("matching", {
      modelIds: ["model-a"],
      sha256: fingerprint("model-a pricing $1"),
    }),
    source("changed", {
      modelIds: ["model-b"],
      sha256: fingerprint("model-b pricing $1"),
    }),
    source("unavailable"),
  ];

  const results = await inspectSources(sources, async (url) => {
    if (url.endsWith("/matching")) return htmlResponse(url, matchingHtml);
    if (url.endsWith("/changed")) return htmlResponse(url, changedHtml);
    throw new Error("provider timed out");
  });

  assert.deepEqual(
    results.map(({ status }) => status),
    ["ok", "changed", "unavailable"],
  );
  assert.equal(results[1].currentHash, fingerprint("model-b pricing $2"));
  assert.match(results[2].error, /provider timed out/);
});

test("a missing configured model mention is a source change, not a source outage", async () => {
  const modelSource = source("model-removal", {
    modelIds: ["retired-model"],
  });

  const [result] = await inspectSources([modelSource], async (url) =>
    htmlResponse(url, "<html><body>Current pricing table</body></html>"),
  );

  assert.equal(result.status, "changed");
  assert.deepEqual(result.missingModels, ["retired-model"]);
  assert.equal(result.error, undefined);
});

test("non-success HTTP responses are reported as unavailable", async () => {
  const [result] = await inspectSources([source("http-error")], async (url) =>
    htmlResponse(url, "temporarily unavailable", 503),
  );

  assert.equal(result.status, "unavailable");
  assert.match(result.error, /HTTP 503/);
});