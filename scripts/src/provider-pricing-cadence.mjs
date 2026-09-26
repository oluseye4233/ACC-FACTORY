import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const GRACE_DAYS = 3;
const WEEK_MINUTES = 7 * 24 * 60;
const PRICING_WORKFLOW = fileURLToPath(
  new URL("../../.github/workflows/provider-pricing.yml", import.meta.url),
);

function parseField(field, min, max, { sundaySeven = false } = {}) {
  const values = new Set();
  for (const part of field.split(",")) {
    const [rangePart, stepPart] = part.split("/");
    if (part.split("/").length > 2) {
      throw new Error(`Invalid cron field: ${field}`);
    }

    const step = stepPart === undefined ? 1 : Number(stepPart);
    if (!Number.isInteger(step) || step < 1) {
      throw new Error(`Invalid cron step: ${field}`);
    }

    let start;
    let end;
    if (rangePart === "*") {
      start = min;
      end = max;
    } else if (/^\d+-\d+$/.test(rangePart)) {
      [start, end] = rangePart.split("-").map(Number);
    } else if (/^\d+$/.test(rangePart)) {
      start = Number(rangePart);
      end = stepPart === undefined ? start : max;
    } else {
      throw new Error(`Unsupported cron field: ${field}`);
    }

    if (start < min || start > max || end < min || end > max || start > end) {
      throw new Error(`Cron field is out of range: ${field}`);
    }
    for (let value = start; value <= end; value += step) {
      values.add(sundaySeven && value === 7 ? 0 : value);
    }
  }
  return [...values];
}

function parseWeeklyCron(expression) {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(`Expected a five-field cron expression: ${expression}`);
  }
  const [minuteField, hourField, dayOfMonth, month, dayOfWeek] = fields;
  if (dayOfMonth !== "*" || month !== "*") {
    throw new Error(
      `Only weekly pricing schedules with wildcard day-of-month and month are supported: ${expression}`,
    );
  }

  return {
    minutes: parseField(minuteField, 0, 59),
    hours: parseField(hourField, 0, 23),
    weekdays: parseField(dayOfWeek, 0, 7, { sundaySeven: true }),
  };
}

export function extractPricingScheduleCrons(workflowText) {
  const crons = [
    ...workflowText.matchAll(
      /^[ \t]{4}-[ \t]*cron:[ \t]*(?:"([^"]+)"|'([^']+)'|([^\s#]+))[ \t]*(?:#.*)?$/gm,
    ),
  ].map((match) => match[1] ?? match[2] ?? match[3]);

  if (crons.length === 0) {
    throw new Error("No scheduled cron entry found in provider-pricing.yml");
  }
  return crons;
}

export function deriveFreshnessWindow(cronExpressions) {
  if (!Array.isArray(cronExpressions) || cronExpressions.length === 0) {
    throw new Error("At least one provider pricing cron expression is required");
  }

  const scheduledMinutes = new Set();
  for (const expression of cronExpressions) {
    const { minutes, hours, weekdays } = parseWeeklyCron(expression);
    for (const weekday of weekdays) {
      const mondayBasedDay = (weekday + 6) % 7;
      for (const hour of hours) {
        for (const minute of minutes) {
          scheduledMinutes.add(mondayBasedDay * 24 * 60 + hour * 60 + minute);
        }
      }
    }
  }

  const sortedMinutes = [...scheduledMinutes].sort((a, b) => a - b);
  if (sortedMinutes.length === 0) {
    throw new Error("Provider pricing cron expressions do not schedule any runs");
  }

  let largestGapMinutes = sortedMinutes[0] + WEEK_MINUTES - sortedMinutes.at(-1);
  for (let index = 1; index < sortedMinutes.length; index += 1) {
    largestGapMinutes = Math.max(
      largestGapMinutes,
      sortedMinutes[index] - sortedMinutes[index - 1],
    );
  }

  const maxScheduleGapMs = largestGapMinutes * MINUTE_MS;
  const staleAfterMs = maxScheduleGapMs + GRACE_DAYS * DAY_MS;
  return {
    maxScheduleGapMs,
    staleAfterMs,
    staleAfterDays: Math.ceil(staleAfterMs / DAY_MS),
  };
}

export function deriveProviderPricingFreshness(workflowText) {
  return deriveFreshnessWindow(extractPricingScheduleCrons(workflowText));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const workflowText = readFileSync(PRICING_WORKFLOW, "utf8");
    const { staleAfterMs, staleAfterDays, maxScheduleGapMs } =
      deriveProviderPricingFreshness(workflowText);
    process.stdout.write(
      `stale_after_ms=${staleAfterMs}\nstale_after_days=${staleAfterDays}\n`,
    );
    console.error(
      `Pricing cadence max gap: ${Math.ceil(maxScheduleGapMs / DAY_MS)} day(s); freshness window: ${staleAfterDays} day(s).`,
    );
  } catch (error) {
    console.error(
      `Could not derive provider pricing freshness window: ${error.message}`,
    );
    process.exitCode = 1;
  }
}