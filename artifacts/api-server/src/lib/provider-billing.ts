export type ParsedProviderBillingLine = {
  provider: string;
  modelId: string;
  amountUsd: string;
};

const MAX_CSV_BYTES = 1_000_000;
const MAX_ROWS = 10_000;
const MAX_MODEL_AMOUNT_MICROS = 99_999_999_999_999n;

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i]!;
    if (quoted) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      row.push(field);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
      if (char === "\r" && content[i + 1] === "\n") i += 1;
    } else if (char === '"') {
      throw new Error("CSV contains a quote inside an unquoted field.");
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
  }
  return rows;
}

function parseUsdMicros(value: string, lineNumber: number): bigint {
  const trimmed = value.trim();
  const match = /^\$?(-?(?:\d+|\d{1,3}(?:,\d{3})+))(?:\.(\d{1,6}))?$/.exec(
    trimmed,
  );
  if (!match) {
    throw new Error(
      `CSV line ${lineNumber} has an invalid amount_usd. Use a USD amount with up to 6 decimal places.`,
    );
  }

  const signedWhole = BigInt(match[1]!.replaceAll(",", ""));
  const whole = signedWhole < 0n ? -signedWhole : signedWhole;
  const fraction = BigInt((match[2] ?? "").padEnd(6, "0"));
  const negative = match[1]!.startsWith("-");
  const micros = whole * 1_000_000n + fraction;
  if (micros > MAX_MODEL_AMOUNT_MICROS) {
    throw new Error(`CSV line ${lineNumber} amount_usd is outside the supported range.`);
  }
  return negative ? -micros : micros;
}

function formatUsdMicros(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / 1_000_000n;
  const fraction = String(absolute % 1_000_000n).padStart(6, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

function normalizeProvider(value: string): string {
  const key = value.trim().toLowerCase();
  const aliases: Record<string, string> = {
    anthropic: "claude",
    google: "gemini",
    "google-ai-studio": "gemini",
    "google-vertex": "gemini",
    moonshot: "kimi",
    alibaba: "qwen",
    zhipu: "glm",
    "z.ai": "glm",
  };
  return aliases[key] ?? key;
}

/**
 * Parse normalized provider billing CSVs with columns provider, model,
 * amount_usd. Multiple rows for one provider/model are summed exactly to six
 * decimal places so vendor discounts and usage adjustments remain intact.
 */
export function parseProviderBillingCsv(content: string): ParsedProviderBillingLine[] {
  if (Buffer.byteLength(content, "utf8") > MAX_CSV_BYTES) {
    throw new Error("CSV is larger than the 1 MB upload limit.");
  }

  const rows = parseCsv(content.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new Error("CSV must contain a header and at least one billing row.");
  if (rows.length - 1 > MAX_ROWS) {
    throw new Error(`CSV contains more than the ${MAX_ROWS.toLocaleString()}-row limit.`);
  }

  const headers = rows[0]!.map((header) => header.trim().toLowerCase());
  if (new Set(headers).size !== headers.length) {
    throw new Error("CSV header contains duplicate column names.");
  }
  const providerIndex = headers.indexOf("provider");
  const modelIndex = headers.indexOf("model");
  const amountIndex = headers.indexOf("amount_usd");
  if (providerIndex < 0 || modelIndex < 0 || amountIndex < 0) {
    throw new Error("CSV must include provider, model, and amount_usd columns.");
  }

  const totals = new Map<
    string,
    { provider: string; modelId: string; amountMicros: bigint }
  >();
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index]!;
    const lineNumber = index + 1;
    if (row.length !== headers.length) {
      throw new Error(`CSV line ${lineNumber} has ${row.length} fields; expected ${headers.length}.`);
    }

    const provider = normalizeProvider(row[providerIndex]!);
    const modelId = row[modelIndex]!.trim();
    if (!/^[a-z0-9][a-z0-9._-]{0,47}$/.test(provider)) {
      throw new Error(
        `CSV line ${lineNumber} has an invalid provider. Use a lowercase provider key such as claude, openai, or gemini.`,
      );
    }
    if (!modelId || modelId.length > 160) {
      throw new Error(`CSV line ${lineNumber} must include a model name of 1 to 160 characters.`);
    }

    const amountMicros = parseUsdMicros(row[amountIndex]!, lineNumber);
    const modelKey = modelId.toLowerCase();
    const key = `${provider}\u0000${modelKey}`;
    const current = totals.get(key);
    if (current) {
      current.amountMicros += amountMicros;
      if (
        current.amountMicros > MAX_MODEL_AMOUNT_MICROS ||
        current.amountMicros < -MAX_MODEL_AMOUNT_MICROS
      ) {
        throw new Error(`CSV line ${lineNumber} makes the combined model amount too large.`);
      }
    } else {
      totals.set(key, { provider, modelId, amountMicros });
    }
  }

  return [...totals.values()].map(({ provider, modelId, amountMicros }) => ({
    provider,
    modelId,
    amountUsd: formatUsdMicros(amountMicros),
  }));
}

export function isMaterialProviderDifference(
  estimatedUsd: number,
  reportedUsd: number,
): boolean {
  const difference = Math.abs(reportedUsd - estimatedUsd);
  const comparisonBase = Math.max(Math.abs(estimatedUsd), Math.abs(reportedUsd));
  return difference >= 1 && (comparisonBase === 0 || difference / comparisonBase >= 0.05);
}