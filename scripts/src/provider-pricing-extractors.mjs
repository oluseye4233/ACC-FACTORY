const MODEL_ID_PATTERNS = {
  anthropic: /\bclaude-[a-z0-9.-]+\b/i,
  openai: /\bgpt-[a-z0-9.-]+\b/i,
  gemini: /\bgemini-[a-z0-9.-]+\b/i,
  deepseek: /\bdeepseek-[a-z0-9.-]+\b/i,
  kimi: /\bkimi-[a-z0-9.-]+\b/i,
  qwen: /\bqwen[a-z0-9.-]+\b/i,
  glm: /\bglm-[a-z0-9.-]+\b/i,
};

function decodeEntities(value) {
  return value
    .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_match, code) =>
      String.fromCodePoint(
        code.toLowerCase().startsWith("x")
          ? Number.parseInt(code.slice(1), 16)
          : Number.parseInt(code, 10),
      ),
    );
}

function textFromMarkup(value) {
  return decodeEntities(
    value
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<br\b[^>]*>/gi, " ")
      .replace(/<\/(?:td|th|p|div|li|h[1-6])\s*>/gi, " ")
      .replace(/<\/?[a-z][^>]*>/gi, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function parseHtmlTables(document) {
  const tables = [];
  for (const tableMatch of document.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table\s*>/gi)) {
    const rows = [];
    const activeSpans = new Map();
    const tableHtml = tableMatch[1];

    for (const rowMatch of tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)) {
      const row = [];
      for (const [column, span] of activeSpans) {
        row[column] = span.text;
        span.remaining -= 1;
        if (span.remaining === 0) activeSpans.delete(column);
      }

      const cells = [
        ...rowMatch[1].matchAll(
          /<(td|th)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi,
        ),
      ];
      let nextColumn = 0;
      for (const cell of cells) {
        while (row[nextColumn] !== undefined) nextColumn += 1;
        const attributes = cell[2];
        const colSpan = Number(attributes.match(/\bcolspan=["']?(\d+)/i)?.[1] ?? 1);
        const rowSpan = Number(attributes.match(/\browspan=["']?(\d+)/i)?.[1] ?? 1);
        const text = textFromMarkup(cell[3]);

        for (let offset = 0; offset < colSpan; offset += 1) {
          const column = nextColumn + offset;
          row[column] = text;
          if (rowSpan > 1) {
            activeSpans.set(column, { text, remaining: rowSpan - 1 });
          }
        }
        nextColumn += colSpan;
      }
      rows.push(row.map((value) => value ?? ""));
    }

    tables.push({ start: tableMatch.index ?? 0, rows });
  }
  return tables;
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function modelId(provider, value, source, cellMarkup = "") {
  const aliases = source.modelAliases ?? {};
  const exactAlias = Object.entries(aliases).find(
    ([label]) => label.toLowerCase() === value.toLowerCase(),
  );
  if (exactAlias) return exactAlias[1];

  if (provider === "anthropic") {
    const href = cellMarkup.match(/href=["'][^"']*\/models\/([^/"']+)/i)?.[1];
    if (href) return `claude-${href.replace(/^claude-/, "")}`.toLowerCase();
    const name = value.match(
      /Claude\s+([A-Za-z]+(?:\s+[A-Za-z]+)?\s+\d+(?:\.\d+)?)/i,
    )?.[1];
    return name ? `claude-${slug(name.replace(/\./g, "-"))}` : undefined;
  }

  const pattern = MODEL_ID_PATTERNS[provider];
  const explicitId = value.match(pattern)?.[0];
  if (explicitId) return explicitId.toLowerCase();

  if (provider === "glm" && /^GLM\b/i.test(value)) return slug(value);
  if (provider === "openai") return source.modelIds?.[0];
  return undefined;
}

function priceNumber(value) {
  const match = value.match(/(?:[$¥￥]\s*)?(-?\d[\d,]*(?:\.\d+)?)/);
  if (!match) return undefined;
  const parsed = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function modelRecord(currency = "USD") {
  return { currency };
}

function rowLabel(row) {
  return (row[0] ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function extractAnthropic(document, source) {
  const result = {};
  for (const { rows } of parseHtmlTables(document)) {
    const headerIndex = rows.findIndex((row) =>
      row.some((cell) => /\b(?:model|name)\b/i.test(cell)) &&
      row.some((cell) => /\binput\b/i.test(cell)) &&
      row.some((cell) => /\boutput\b/i.test(cell)),
    );
    if (headerIndex < 0) continue;
    const groupedHeader = (rows[headerIndex - 1] ?? []).join(" ").toLowerCase();
    if (
      !/\bbase tokens\b/.test(groupedHeader) ||
      !/\bprompt caching\b/.test(groupedHeader)
    ) {
      continue;
    }
    const header = rows[headerIndex].map((cell) => cell.toLowerCase());
    const inputIndex = header.findIndex((cell) => /\binput\b/.test(cell));
    const outputIndex = header.findIndex((cell) => /\boutput\b/.test(cell));
    const write5mIndex = header.findIndex((cell) => /5m.*write|write.*5m/.test(cell));
    const write1hIndex = header.findIndex((cell) => /1h.*write|write.*1h/.test(cell));
    const cachedIndex = header.findIndex((cell) => /hit|refresh/.test(cell));

    for (const row of rows.slice(headerIndex + 1)) {
      const name = row[0] ?? "";
      const id = modelId("anthropic", name, source, name);
      if (!id || row.length <= Math.max(inputIndex, outputIndex)) continue;
      const record = modelRecord("USD");
      const input = priceNumber(row[inputIndex] ?? "");
      const output = priceNumber(row[outputIndex] ?? "");
      if (input !== undefined) record.inputPerMTok = input;
      if (output !== undefined) record.outputPerMTok = output;
      if (cachedIndex >= 0) {
        const cached = priceNumber(row[cachedIndex] ?? "");
        if (cached !== undefined) record.cachedInputPerMTok = cached;
      }
      if (write5mIndex >= 0) {
        const price = priceNumber(row[write5mIndex] ?? "");
        if (price !== undefined) record.cacheWrite5mPerMTok = price;
      }
      if (write1hIndex >= 0) {
        const price = priceNumber(row[write1hIndex] ?? "");
        if (price !== undefined) record.cacheWrite1hPerMTok = price;
      }
      if (record.inputPerMTok !== undefined && record.outputPerMTok !== undefined) {
        result[id] = record;
      }
    }
  }
  return result;
}

function extractOpenAi(document, source) {
  const result = {};
  const pricingText = textFromMarkup(document);
  const textTokensIndex = pricingText.toLowerCase().indexOf("text tokens");
  const textTokens = textTokensIndex < 0 ? "" : pricingText.slice(textTokensIndex);
  const tokenRates = textTokens.match(
    /\bInput\s+\$?\s*([\d,.]+)[\s\S]{0,120}?\bCached input\s+\$?\s*([\d,.]+)[\s\S]{0,120}?\bOutput\s+\$?\s*([\d,.]+)/i,
  );
  const id = source.modelIds?.[0];
  if (id && tokenRates) {
    result[id] = {
      currency: "USD",
      inputPerMTok: Number(tokenRates[1].replace(/,/g, "")),
      cachedInputPerMTok: Number(tokenRates[2].replace(/,/g, "")),
      outputPerMTok: Number(tokenRates[3].replace(/,/g, "")),
    };
  }

  // GPT-5.4's model page states that long-context requests are billed at
  // 2x input and 1.5x output once the full prompt exceeds 272K tokens.
  const longContext = textFromMarkup(document).match(
    />\s*([\d,]+)K input tokens are priced at\s*([\d.]+)x input and\s*([\d.]+)x output/i,
  );
  if (id && result[id] && longContext) {
    const base = result[id];
    const boundary = Number(longContext[1].replace(/,/g, "")) * 1_000;
    result[id].inputTiers = [
      {
        maxInputTokens: boundary,
        rates: { ...base },
      },
      {
        maxInputTokens: "unbounded",
        rates: {
          ...base,
          inputPerMTok: base.inputPerMTok * Number(longContext[2]),
          outputPerMTok: base.outputPerMTok * Number(longContext[3]),
          ...(base.cachedInputPerMTok === undefined
            ? {}
            : {
                cachedInputPerMTok:
                  base.cachedInputPerMTok * Number(longContext[2]),
              }),
        },
      },
    ];
  }
  return result;
}

function extractDeepseek(document) {
  const result = {};
  for (const { rows } of parseHtmlTables(document)) {
    const modelRowIndex = rows.findIndex((row) =>
      rowLabel(row).startsWith("model") &&
      row.slice(1).some((cell) => MODEL_ID_PATTERNS.deepseek.test(cell)),
    );
    if (modelRowIndex < 0) continue;
    const modelRow = rows[modelRowIndex];
    const ids = modelRow.map((cell) => cell.match(MODEL_ID_PATTERNS.deepseek)?.[0]?.toLowerCase());
    const variants = {};

    for (const row of rows.slice(modelRowIndex + 1)) {
      const text = row.join(" ").toLowerCase();
      const period = /\boff[\s-]?peak\b/.test(text)
        ? "offPeak"
        : /\bpeak\b/.test(text)
          ? "peak"
          : undefined;
      if (!period) continue;
      const category = text.includes("cache hit")
        ? "cachedInputPerMTok"
        : text.includes("cache miss")
          ? "inputPerMTok"
          : text.includes("output tokens")
            ? "outputPerMTok"
            : undefined;
      if (!category) continue;

      ids.forEach((id, index) => {
        if (!id) return;
        const amount = priceNumber(row[index] ?? "");
        if (amount === undefined) return;
        variants[id] ??= {};
        variants[id][period] ??= {};
        variants[id][period][category] = amount;
      });
    }

    for (const [id, rateVariants] of Object.entries(variants)) {
      const peak = rateVariants.peak;
      const record = {
        currency: "USD",
        rateVariants,
        ...(peak?.inputPerMTok === undefined
          ? {}
          : { inputPerMTok: peak.inputPerMTok }),
        ...(peak?.cachedInputPerMTok === undefined
          ? {}
          : { cachedInputPerMTok: peak.cachedInputPerMTok }),
        ...(peak?.outputPerMTok === undefined
          ? {}
          : { outputPerMTok: peak.outputPerMTok }),
      };
      result[id] = record;
    }
  }
  return result;
}

function extractMoonshot(document) {
  const result = {};
  const rowPattern = /\[\s*"([^"]+)"\s*,\s*"1M tokens"\s*,([\s\S]*?)\]\s*,?/g;
  for (const match of document.matchAll(rowPattern)) {
    const id = match[1].toLowerCase();
    if (!MODEL_ID_PATTERNS.kimi.test(id)) continue;
    const prices = [...match[2].matchAll(/\{"\$"\}([\d,.]+)/g)].map((item) =>
      Number(item[1].replace(/,/g, "")),
    );
    if (prices.length >= 5) {
      result[id] = {
        currency: "USD",
        cacheWrite5mPerMTok: prices[0],
        cacheWrite1hPerMTok: prices[1],
        cachedInputPerMTok: prices[2],
        inputPerMTok: prices[3],
        outputPerMTok: prices[4],
      };
    } else if (prices.length >= 3) {
      result[id] = {
        currency: "USD",
        cachedInputPerMTok: prices[0],
        inputPerMTok: prices[1],
        outputPerMTok: prices[2],
      };
    }
  }
  return result;
}

function tokenThreshold(value) {
  const normalized = value.replace(/,/g, "").toUpperCase();
  const match = normalized.match(/(?:≤|<=|<)\s*(\d+(?:\.\d+)?)\s*(K|M)?/);
  if (!match) return Number.POSITIVE_INFINITY;
  const amount = Number(match[1]);
  return amount * (match[2] === "M" ? 1_000_000 : match[2] === "K" ? 1_000 : 1);
}

function extractQwen(document) {
  const result = {};
  for (const { rows } of parseHtmlTables(document)) {
    const headerText = rows.slice(0, 3).flat().join(" ").toLowerCase();
    if (!headerText.includes("input tokens per request")) continue;

    const grouped = new Map();
    for (const row of rows) {
      const id = row[0]?.match(MODEL_ID_PATTERNS.qwen)?.[0]?.toLowerCase();
      if (
        !id ||
        row.length < 6 ||
        !/\binternational\b/i.test(row[1] ?? "") ||
        result[id]
      ) {
        continue;
      }
      const tierName = row[2] ?? "";
      const input = priceNumber(row[3] ?? "");
      const output = priceNumber(row[4] ?? "");
      const thinkingOutput = priceNumber(row[5] ?? "");
      if (input === undefined || output === undefined) continue;
      grouped.set(id, [
        ...(grouped.get(id) ?? []),
        {
          maxInputTokens: tokenThreshold(tierName),
          rates: {
            inputPerMTok: input,
            outputPerMTok: output,
            ...(thinkingOutput === undefined
              ? {}
              : { thinkingOutputPerMTok: thinkingOutput }),
          },
        },
      ]);
    }

    for (const [id, inputTiers] of grouped) {
      inputTiers.sort((left, right) => left.maxInputTokens - right.maxInputTokens);
      const standardTier =
        inputTiers.find((tier) => tier.maxInputTokens >= 256_000) ??
        inputTiers[0];
      result[id] = {
        currency: "USD",
        ...standardTier.rates,
        inputTiers,
      };
    }
  }
  return result;
}

function allPrices(value) {
  return [...value.matchAll(/[$¥￥]\s*([\d,]+(?:\.\d+)?)/g)].map((match) =>
    Number(match[1].replace(/,/g, "")),
  );
}

function modelHeadingBefore(document, index) {
  const headings = [
    ...document
      .slice(0, index)
      .matchAll(/<h2\b[^>]*\bid=["']([^"']+)["'][^>]*>/gi),
  ]
    .map((match) => match[1])
    .filter((id) => /^gemini-[a-z0-9.-]+$/i.test(id));
  return headings.at(-1)?.toLowerCase();
}

function pricingModeBefore(document, index) {
  const headings = [
    ...document
      .slice(0, index)
      .matchAll(/<h3\b([^>]*)>([\s\S]*?)<\/h3\s*>/gi),
  ];
  const heading = headings.at(-1);
  if (!heading) return undefined;
  return (
    heading[1].match(/\bdata-text=["']([^"']+)["']/i)?.[1] ??
    textFromMarkup(heading[2])
  )
    .toLowerCase()
    .trim();
}

function extractGoogle(document) {
  const result = {};
  const tiered = new Map();
  for (const table of parseHtmlTables(document)) {
    const id = modelHeadingBefore(document, table.start);
    if (!id || pricingModeBefore(document, table.start) !== "standard") continue;

    const standard = tiered.get(id) ?? {
      currency: "USD",
      tiers: new Map(),
    };
    for (const row of table.rows) {
      const label = rowLabel(row);
      const cell = row.at(-1) ?? "";
      const prices = allPrices(cell);
      if (prices.length === 0) continue;

      const maxInputTokens =
        /(?:<=|≤)\s*([\d,]+)\s*k\b/i.exec(cell)?.[1] ??
        /prompts\s*<=\s*([\d,]+)\s*k\b/i.exec(cell)?.[1];
      const secondTier = /prompts\s*>\s*([\d,]+)\s*k\b/i.test(cell);
      const thresholds =
        prices.length >= 2 && maxInputTokens && secondTier
          ? [Number(maxInputTokens.replace(/,/g, "")) * 1_000, "unbounded"]
          : ["unbounded"];

      if (/^input price\b/.test(label)) {
        prices.slice(0, thresholds.length).forEach((price, index) => {
          const threshold = thresholds[index];
          standard.tiers.set(threshold, {
            ...(standard.tiers.get(threshold) ?? {}),
            inputPerMTok: price,
          });
        });
      } else if (/^output price\b/.test(label)) {
        prices.slice(0, thresholds.length).forEach((price, index) => {
          const threshold = thresholds[index];
          standard.tiers.set(threshold, {
            ...(standard.tiers.get(threshold) ?? {}),
            outputPerMTok: price,
          });
        });
      } else if (/context caching price|cached input price/.test(label)) {
        prices.slice(0, thresholds.length).forEach((price, index) => {
          const threshold = thresholds[index];
          standard.tiers.set(threshold, {
            ...(standard.tiers.get(threshold) ?? {}),
            cachedInputPerMTok: price,
          });
        });
        if (prices.length > thresholds.length) {
          standard.cacheStoragePerMTokHour = prices[thresholds.length];
        }
      }
    }

    if (standard.tiers.size > 0) tiered.set(id, standard);
  }

  for (const [id, standard] of tiered) {
    const inputTiers = [...standard.tiers]
      .sort(([left], [right]) => {
        if (left === "unbounded") return 1;
        if (right === "unbounded") return -1;
        return left - right;
      })
      .map(([maxInputTokens, rates]) => ({ maxInputTokens, rates }));
    const base = inputTiers[0]?.rates ?? {};
    result[id] = {
      currency: "USD",
      ...base,
      ...(standard.cacheStoragePerMTokHour === undefined
        ? {}
        : { cacheStoragePerMTokHour: standard.cacheStoragePerMTokHour }),
      inputTiers,
    };
  }
  return result;
}

function extractGlmCn(document) {
  const result = {};
  for (const { rows } of parseHtmlTables(document)) {
    const headerIndex = rows.findIndex((row) =>
      row.some((cell) => /模型名称|model name/i.test(cell)) &&
      row.some((cell) => /输入单价/i.test(cell)) &&
      row.some((cell) => /输出单价/i.test(cell)),
    );
    if (headerIndex < 0) continue;
    const header = rows[headerIndex];
    const inputIndex = header.findIndex((cell) => /输入单价/i.test(cell));
    const outputIndex = header.findIndex((cell) => /输出单价/i.test(cell));
    const cachedIndex = header.findIndex((cell) => /缓存命中/i.test(cell));
    for (const row of rows.slice(headerIndex + 1)) {
      const id = row[0]?.match(MODEL_ID_PATTERNS.glm)?.[0]?.toLowerCase();
      if (!id) continue;
      const record = modelRecord("CNY");
      const input = priceNumber(row[inputIndex] ?? "");
      const output = priceNumber(row[outputIndex] ?? "");
      const cached = cachedIndex >= 0 ? priceNumber(row[cachedIndex] ?? "") : undefined;
      if (input !== undefined) record.inputPerMTok = input;
      if (output !== undefined) record.outputPerMTok = output;
      if (cached !== undefined) record.cachedInputPerMTok = cached;
      if (input !== undefined && output !== undefined) result[id] = record;
    }
  }
  return result;
}

function extractGlmInternational(document, source) {
  const rows = parseHtmlTables(document).flatMap((table) => table.rows);
  const record = modelRecord("USD");
  for (const row of rows) {
    const label = rowLabel(row);
    const amount = priceNumber(row[1] ?? "");
    if (amount === undefined) continue;
    if (/^input$/.test(label)) record.inputPerMTok = amount;
    else if (/^output$/.test(label)) record.outputPerMTok = amount;
    else if (/input.*(?:cache|implicit)/.test(label)) {
      record.cachedInputPerMTok = amount;
    }
  }
  return source.modelIds?.[0] &&
    record.inputPerMTok !== undefined &&
    record.outputPerMTok !== undefined
    ? { [source.modelIds[0]]: record }
    : {};
}

export function extractProviderRates(source, document) {
  const result = (() => {
    switch (source.id) {
      case "anthropic":
        return extractAnthropic(document, source);
      case "openai":
        return extractOpenAi(document, source);
      case "google":
        return extractGoogle(document);
      case "deepseek":
        return extractDeepseek(document);
      case "moonshot":
        return extractMoonshot(document);
      case "qwen":
        return extractQwen(document);
      case "glm-cn":
        return extractGlmCn(document);
      case "glm-international":
        return extractGlmInternational(document, source);
      default:
        throw new Error(`No rate extractor is registered for source "${source.id}".`);
    }
  })();

  if (Object.keys(result).length === 0) {
    throw new Error(
      `${source.id}: no model rate rows were extracted; refusing to treat an unreadable page as a model retirement.`,
    );
  }

  return Object.fromEntries(
    Object.entries(result).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function flattenValues(value, prefix = "", output = {}) {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const label =
        item && typeof item === "object" && "maxInputTokens" in item
          ? `<=${item.maxInputTokens}`
          : String(index);
      flattenValues(item, `${prefix}[${label}]`, output);
    }
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      flattenValues(child, prefix ? `${prefix}.${key}` : key, output);
    }
  } else {
    output[prefix] = value;
  }
  return output;
}

export function compareProviderRates(previous, current, previousModelIds) {
  const oldModels = previous ?? {};
  const newModels = current ?? {};
  const oldIds = Object.keys(oldModels).sort();
  const newIds = Object.keys(newModels).sort();
  const previousCatalog = new Set(previousModelIds ?? oldIds);
  const addedModels = newIds.filter((id) => !previousCatalog.has(id));
  const retiredModels = [...previousCatalog]
    .filter((id) => !Object.hasOwn(newModels, id))
    .sort();
  const addedModelRates = addedModels.flatMap((modelId) =>
    Object.entries(flattenValues(newModels[modelId])).map(([field, current]) => ({
      modelId,
      field,
      current,
    })),
  );
  const rateChanges = [];

  for (const modelId of newIds.filter((id) => Object.hasOwn(oldModels, id))) {
    const oldValues = flattenValues(oldModels[modelId]);
    const newValues = flattenValues(newModels[modelId]);
    const fields = [...new Set([...Object.keys(oldValues), ...Object.keys(newValues)])]
      .sort();
    for (const field of fields) {
      if (Object.is(oldValues[field], newValues[field])) continue;
      rateChanges.push({
        modelId,
        field,
        previous: oldValues[field],
        current: newValues[field],
      });
    }
  }

  return { addedModels, retiredModels, addedModelRates, rateChanges };
}

export function formatProviderRate(value, record, field = "") {
  if (value === undefined) return "(not listed)";
  if (/maxInputTokens|maxOutputTokens/.test(field)) return String(value);
  if (typeof value === "number") {
    return `${value} ${record?.currency ?? ""}`.trim();
  }
  return JSON.stringify(value);
}