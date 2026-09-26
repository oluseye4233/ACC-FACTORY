import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const manifestPath = fileURLToPath(
  new URL("../data/provider-pricing-snapshots.json", import.meta.url),
);
const ACCEPT_CURRENT = process.argv.slice(2).includes("--accept-current");

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

async function fetchReviewedSource(source) {
  const response = await fetch(source.url, {
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
  if (missingModels.length > 0) {
    throw new Error(
      `${source.id}: configured model ID(s) no longer appear in the official source: ${missingModels.join(", ")}`,
    );
  }

  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

async function main() {
  const rawManifest = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(rawManifest);
  if (!Array.isArray(manifest.sources) || manifest.sources.length === 0) {
    throw new Error("Provider pricing snapshot manifest has no sources.");
  }

  const currentDate = new Date().toISOString().slice(0, 10);
  const results = await Promise.all(
    manifest.sources.map(async (source) => ({
      source,
      currentHash: await fetchReviewedSource(source),
    })),
  );
  const changed = results.filter(
    ({ source, currentHash }) => source.sha256 !== currentHash,
  );

  if (ACCEPT_CURRENT) {
    if (changed.length === 0) {
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
    console.log(
      "Updated source fingerprints only. No model prices were changed; commit this manifest update for review.",
    );
    return;
  }

  if (changed.length === 0) {
    console.log(
      `All ${results.length} official provider pricing sources match their reviewed fingerprints.`,
    );
    return;
  }

  console.error(
    `Provider pricing review required: ${changed.length} of ${results.length} official source(s) changed.`,
  );
  for (const { source, currentHash } of changed) {
    console.error(
      `- ${source.id} (${source.provider}; models: ${source.modelIds.join(", ") || "review source for new/retired models"})`,
    );
    console.error(`  Source: ${source.url}`);
    console.error(`  Reviewed SHA-256: ${source.sha256 || "(none recorded)"}`);
    console.error(`  Current SHA-256:  ${currentHash}`);
  }
  console.error(
    "Review the linked provider pages for rate, model ID, and billing-rule changes. Update production prices only in a separately reviewed code change. After review, run `pnpm --filter @workspace/scripts run check-provider-pricing -- --accept-current` to record the new source fingerprints.",
  );
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(
    `Provider pricing source check failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});