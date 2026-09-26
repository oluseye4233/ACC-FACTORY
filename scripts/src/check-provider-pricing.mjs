import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
  const expectedModelMentions = source.modelMentions ?? source.modelIds;
  const missingModels = expectedModelMentions.filter(
    (mention) => !normalized.toLowerCase().includes(mention.toLowerCase()),
  );

  return {
    currentHash: createHash("sha256").update(normalized, "utf8").digest("hex"),
    missingModels,
  };
}

export async function inspectSources(sources, fetchImpl = fetch) {
  return Promise.all(
    sources.map(async (source) => {
      try {
        const { currentHash, missingModels } = await fetchReviewedSource(
          source,
          fetchImpl,
        );
        return {
          source,
          currentHash,
          missingModels,
          status:
            source.sha256 === currentHash && missingModels.length === 0
              ? "ok"
              : "changed",
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

async function writeGithubOutputs(status, sources, fatalError) {
  if (!GITHUB_OUTPUT) return;
  const report = Buffer.from(
    JSON.stringify({
      sources: sources.map(
        ({
          source,
          status: sourceStatus,
          currentHash,
          missingModels,
          error,
        }) => ({
          id: source.id,
          provider: source.provider,
          url: source.url,
          modelIds: source.modelIds,
          status: sourceStatus,
          reviewedHash: source.sha256,
          currentHash,
          missingModels,
          error,
        }),
      ),
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
  if (changed.length > 0) {
    console.error(
      `Provider pricing review required: ${changed.length} of ${results.length} official source(s) changed.`,
    );
  }
  for (const { source, currentHash, status, error, missingModels } of results) {
    if (status === "ok") continue;
    console.error(
      `- ${source.id} (${source.provider}; models: ${source.modelIds.join(", ") || "review source for new/retired models"}): ${status === "changed" ? "source fingerprint changed" : "source could not be verified"}`,
    );
    console.error(`  Source: ${source.url}`);
    if (status === "changed") {
      console.error(`  Reviewed SHA-256: ${source.sha256 || "(none recorded)"}`);
      console.error(`  Current SHA-256:  ${currentHash}`);
      if (missingModels?.length > 0) {
        console.error(
          `  Configured model mention(s) no longer found: ${missingModels.join(", ")}`,
        );
      }
    } else {
      console.error(`  Error: ${error}`);
    }
  }
  if (changed.length > 0 || unavailable.length > 0) {
    console.error(
      "Review changed provider pages for rate, model ID, and billing-rule changes. An unavailable page needs verification when service returns. A fingerprint change alone is not proof of a price change. Production prices must only change in a separately reviewed code change. After review, run `pnpm --filter @workspace/scripts run check-provider-pricing -- --accept-current` to record the new source fingerprints.",
    );
  }
  if (results.some(({ missingModels }) => missingModels?.length > 0)) {
    console.error(
      "A configured model mention is missing from an accessible source. Confirm the model's status and update the reviewed model list before accepting the new fingerprint.",
    );
  }
}

export async function run({ acceptCurrent = ACCEPT_CURRENT } = {}) {
  const currentDate = new Date().toISOString().slice(0, 10);
  const rawManifest = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(rawManifest);
  if (!Array.isArray(manifest.sources) || manifest.sources.length === 0) {
    throw new Error("Provider pricing snapshot manifest has no sources.");
  }
  const results = await inspectSources(manifest.sources);
  const changed = results.filter(
    ({ status }) => status === "changed",
  );
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
      console.log("All official provider pricing sources match their reviewed fingerprints.");
      return;
    }

    for (const { source, currentHash } of changed) {
      source.sha256 = currentHash;
      source.reviewedOn = currentDate;
      console.log(
        `Accepted ${source.id} source fingerprint for ${source.modelIds.join(", ")} (${source.url}).`,
      );
    }
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await writeGithubOutputs("ok", results);
    console.log(
      "Updated source fingerprints only. No model prices were changed; commit this manifest update for review.",
    );
    return;
  }

  if (changed.length === 0) {
    if (unavailable.length > 0) {
      await writeGithubOutputs("needs_review", results);
      logReviewResults(results);
      process.exitCode = 1;
      return;
    }
    await writeGithubOutputs("ok", results);
    console.log(
      `All ${results.length} official provider pricing sources match their reviewed fingerprints.`,
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