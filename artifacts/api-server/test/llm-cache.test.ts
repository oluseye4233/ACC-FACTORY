import { expect, it } from "vitest";
import { hashKey } from "./llm-cache";

it("separates native structured-output recordings from unconstrained requests", () => {
  const base = { model: "model", system: "system", messages: [{ role: "user", content: "input" }] };
  expect(hashKey("claude", base)).not.toBe(hashKey("claude", {
    ...base, output_config: { format: {
      type: "json_schema", schema: { type: "object", properties: { content: { type: "string" } } },
    } },
  }));
});
