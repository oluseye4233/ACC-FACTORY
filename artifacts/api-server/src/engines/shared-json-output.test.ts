import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod/v4";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@workspace/integrations-anthropic-ai", async importOriginal => {
  const actual = await importOriginal<typeof import("@workspace/integrations-anthropic-ai")>();
  return { ...actual, getAnthropic: () => ({ messages: { create: mocks.create } }) };
});
import { callLlmJson } from "./shared";
import { F6_CLAUDE_JSON_SCHEMA } from "./f6";

const schema = z.object({
  cheatSheet: z.string(), execSummary: z.string(), worksheet: z.string(), implementation: z.string(),
});
const output = {
  cheatSheet: 'A narrative with "quoted text".', execSummary: "Summary",
  worksheet: "Worksheet", implementation: "Plan, not execution.",
};
beforeEach(() => {
  mocks.create.mockReset();
  mocks.create.mockResolvedValue({
    content: [{ type: "text", text: JSON.stringify(output) }],
    usage: { input_tokens: 10, output_tokens: 20 },
  });
});

describe("Claude F6 native structured output", () => {
  it("requests a closed four-string JSON schema and retains strict validation", async () => {
    await expect(callLlmJson("claude", "system", "input", schema, undefined,
      { claudeJsonSchema: F6_CLAUDE_JSON_SCHEMA })).resolves.toEqual(output);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      output_config: { format: { type: "json_schema", schema: F6_CLAUDE_JSON_SCHEMA } },
    }));
  });
  it("does not change the request contract for engines without a native schema", async () => {
    await callLlmJson("claude", "system", "input", schema);
    expect(mocks.create.mock.calls[0]![0]).not.toHaveProperty("output_config");
  });
  it("reads text after a non-text response block", async () => {
    mocks.create.mockResolvedValue({
      content: [{ type: "thinking", thinking: "not document content" },
        { type: "text", text: JSON.stringify(output) }],
      usage: { input_tokens: 10, output_tokens: 20 },
    });
    await expect(callLlmJson("claude", "system", "input", schema)).resolves.toEqual(output);
  });
  it("still rejects the real malformed F6 response rather than guessing how to repair its prose", async () => {
    const response = JSON.parse(readFileSync(new URL(
      "../../test/__fixtures__/llm/claude/0f735b5aa1fdc24e8aaed82d698ea13f.json", import.meta.url), "utf8"));
    mocks.create.mockResolvedValue(response);
    await expect(callLlmJson("claude", "system", "input", schema, undefined,
      { claudeJsonSchema: F6_CLAUDE_JSON_SCHEMA })).rejects.toThrow("Failed to parse engine JSON response");
  });
  it("rejects valid JSON that violates the narrative field schema", async () => {
    mocks.create.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ ...output, worksheet: 7 }) }],
      usage: { input_tokens: 10, output_tokens: 20 },
    });
    await expect(callLlmJson("claude", "system", "input", schema)).rejects.toThrow("schema validation");
  });
});
