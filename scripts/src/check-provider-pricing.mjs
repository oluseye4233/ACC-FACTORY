import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compareProviderRates,
  extractProviderRates,
  formatProviderRate,
} from "./provider-pricing-extractors.mjs";

const manifestPath = fileURLToPath(
  new URL("../data/provider-pricing-snapshots.json", import.meta.url),
);
const ACCEPT_CURRENT = process.argv.slice(2).includes("--accept-current");
const GITHUB_OUTPUT = process.env.GITHUB_OUTPUT;

function normalizeDocument(body) {
  return body
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(
      /<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
      " ",
    )
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function emptyComparison() {
  return {
    addedModels: [],
    retiredModels: [],
    addedModelRates: [],
    rateChanges: [],
  };
}

function hasRateChanges(comparison) {
  return (
    comparison.addedModels.length > 0 ||
    comparison.retiredModels.length > 0 ||
    comparison.rateChanges.length > 0
  );
}

export async function fetchReviewedSource(source, fetchImpl = fetch) {
  const response = await fetchImpl(source.url, {
    headers: {
      accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
      "user-agent": "ATANDA-provider-pricing-review/1.0",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    throw new Error(`${source.id}: ${source.url} returned HTTP ${response.status}`);
  }
  if (!new URL(response.url).protocol.startsWith("https:")) {
    throw new Error(`${source.id}: refused non-HTTPS final URL ${response.url}`);
  }

  const document = await response.text();
  if (Buffer.byteLength(document, "utf8") > 15_000_000) {
    throw new Error(`${source.id}: response exceeded the 15 MB safety limit`);
  }

  const normalized = normalizeDocument(document);
  const expectedModelMentions = source.modelMentions ?? source.modelIds ?? [];
  const missingModels = expectedModelMentions.filter(
    (mention) => !normalized.toLowerCase().includes(mention.toLowerCase()),
  );
  const hasReviewedRateSnapshot =
    Object.hasOwn(source, "rates") || Array.isArray(source.observedModelIds);
  const currentRates = hasReviewedRateSnapshot
    ? extractProviderRates(source, document)
    : undefined;

  return {
    currentHash: createHash("sha256").update(normalized, "utf8").digest("hex"),
    currentRates,
    missingModels,
  };
}

export async function inspectSources(sources, fetchImpl = fetch) {
  return Promise.all(
    sources.map(async (source) => {
      try {
        const { currentHash, currentRates, missingModels } =
          await fetchReviewedSource(source, fetchImpl);
        const comparison = currentRates
          ? compareProviderRates(
              source.rates,
              currentRates,
              source.observedModelIds,
            )
          : emptyComparison();
        const status =
          source.sha256 === currentHash &&
          missingModels.length === 0 &&
          !hasRateChanges(comparison)
            ? "ok"
            : "changed";

        return {
          source,
          currentHash,
          currentRates,
          missingModels,
          comparison,
          status,
        };
      } catch (error) {
        return {
          source,
          status: "unavailable",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );
}

function reportSource(result) {
  const comparison = result.comparison ?? emptyComparison();
  const rates = result.currentRates ?? {};
  return {
    id: result.source.id,
    provider: result.source.provider,
    url: result.source.url,
    modelIds: result.source.modelIds,
    status: result.status,
    reviewedHash: result.source.sha256,
    currentHash: result.currentHash,
    missingModels: result.missingModels,
    addedModels: comparison.addedModels,
    retiredModels: comparison.retiredModels,
    addedModelRates: comparison.addedModelRates.map((addition) => ({
      ...addition,
      formattedCurrent: formatProviderRate(
        addition.current,
        rates[addition.modelId],
        addition.field,
      ),
    })),
    rateChanges: comparison.rateChanges.map((change) => ({
      ...change,
      formattedPrevious: formatProviderRate(
        change.previous,
        result.source.rates?.[change.modelId],
        change.field,
      ),
      formattedCurrent: formatProviderRate(
        change.current,
        rates[change.modelId],
        change.field,
      ),
    })),
    error: result.error,
  };
}

async function writeGithubOutputs(status, sources, fatalError) {
  if (!GITHUB_OUTPUT) return;
  const report = Buffer.from(
    JSON.stringify({
      sources: sources.map(reportSource),
      fatalError,
    }),
    "utf8",
  ).toString("base64");
  await writeFile(
    GITHUB_OUTPUT,
    `result=${status}\nreport=${report}\n`,
    { flag: "a" },
  );
}

function logReviewResults(results) {
  const changed = results.filter(({ status }) => status === "changed");
  const unavailable = results.filter(({ status }) => status === "unavailable");
  if (changed.length > 0 || unavailable.length > 0) {
    console.error(
      `Provider pricing review required: ${changed.length} of ${results.length} source(s) changed; ${unavailable.length} unavailable.`,
    );
  }

  for (const result of results) {
    const { source, currentHash, status, error, missingModels } = result;
    if (status === "ok") continue;
    console.error(
      `- ${source.id} (${source.provider}; configured models: ${source.modelIds.join(", ") || "(none)"}): ${status === "changed" ? "review required" : "source could not be verified"}`,
    );
    console.error(`  Source: ${source.url}`);
    if (status === "unavailable") {
      console.error(`  Error: ${error}`);
      continue;
    }

    console.error(`  Reviewed SHA-256: ${source.sha256 || "(none recorded)"}`);
    console.error(`  Current SHA-256:  ${currentHash}`);
    if (missingModels?.length > 0) {
      console.error(
        `  Configured model mention(s) no longer found: ${missingModels.join(", ")}`,
      );
    }

    const comparison = result.comparison ?? emptyComparison();
    const currentRates = result.currentRates ?? {};
    if (comparison.addedModels.length > 0) {
      console.error(
        `  Newly listed model(s): ${comparison.addedModels.join(", ")}`,
      );
    }
    if (comparison.retiredModels.length > 0) {
      console.error(
        `  Retired model(s): ${comparison.retiredModels.join(", ")}`,
      );
    }
    for (const addition of comparison.addedModelRates) {
      console.error(
        `  New model rate: ${addition.modelId} ${addition.field}: ${formatProviderRate(addition.current, currentRates[addition.modelId], addition.field)}`,
      );
    }
    for (const change of comparison.rateChanges) {
      const previous = formatProviderRate(
        change.previous,
        source.rates?.[change.modelId],
        change.field,
      );
      const current = formatProviderRate(
        change.current,
        currentRates[change.modelId],
        change.field,
      );
      console.error(
        `  Rate change: ${change.modelId} ${change.field}: ${previous} -> ${current}`,
      );
    }
    if (
      source.sha256 !== currentHash &&
      comparison.addedModels.length === 0 &&
      comparison.retiredModels.length === 0 &&
      comparison.rateChanges.length === 0 &&
      missingModels?.length === 0
    ) {
      console.error("  No extracted model or rate changes; the page changed elsewhere.");
    }
  }

  if (changed.length > 0 || unavailable.length > 0) {
    console.error(
      "Review the linked provider pages and each extracted difference. A fingerprint change alone is not proof of a price change. This check never updates production prices. After review, run `pnpm --filter @workspace/scripts run check-provider-pricing -- --accept-current` to record the source fingerprints and observational rate snapshots.",
    );
  }
  if (results.some(({ missingModels }) => missingModels?.length > 0)) {
    console.error(
      "A configured model mention is missing from an accessible source. Confirm the model's status and update the reviewed model list before accepting the new fingerprint.",
    );
  }
}

export async function run({
  acceptCurrent = ACCEPT_CURRENT,
  fetchImpl = fetch,
} = {}) {
  const rawManifest = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(rawManifest);
  if (!Array.isArray(manifest.sources) || manifest.sources.length === 0) {
    throw new Error("Provider pricing snapshot manifest has no sources.");
  }

  const currentDate = new Date().toISOString().slice(0, 10);
  const results = await inspectSources(manifest.sources, fetchImpl);
  const changed = results.filter(({ status }) => status === "changed");
  const unavailable = results.filter(({ status }) => status === "unavailable");
  const missingModels = results.some(
    ({ missingModels: absent }) => absent?.length > 0,
  );

  if (acceptCurrent) {
    if (unavailable.length > 0 || missingModels) {
      await writeGithubOutputs("needs_review", results);
      logReviewResults(results);
      process.exitCode = 1;
      return;
    }
    if (changed.length === 0) {
      await writeGithubOutputs("ok", results);
      console.log(
        "All official provider pricing sources match their reviewed fingerprints and extracted rate snapshots.",
      );
      return;
    }

    for (const result of changed) {
      const { source, currentHash, currentRates } = result;
      source.sha256 = currentHash;
      source.reviewedOn = currentDate;
      if (currentRates) {
        source.rates = currentRates;
        source.observedModelIds = Object.keys(currentRates).sort();
      }
      console.log(
        `Accepted ${source.id} source fingerprint${currentRates ? " and extracted rate snapshot" : ""} (${source.modelIds.join(", ")}) (${source.url}).`,
      );
    }
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await writeGithubOutputs("ok", results);
    console.log(
      "Updated source fingerprints and observational rate snapshots only. Production model prices were not changed; commit this manifest update for review.",
    );
    return;
  }

  if (changed.length === 0 && unavailable.length === 0) {
    await writeGithubOutputs("ok", results);
    console.log(
      `All ${results.length} official provider pricing sources match their reviewed fingerprints and extracted rate snapshots.`,
    );
    return;
  }

  await writeGithubOutputs("needs_review", results);
  logReviewResults(results);
  process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch(async (error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Provider pricing source check failed: ${message}`);
    await writeGithubOutputs("needs_review", [], message);
    process.exitCode = 1;
  });
}