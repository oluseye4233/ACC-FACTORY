import { describe, expect, it, vi, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { buildExport, validateProfile, type Family } from "./f10-export";
import {
  createProviderAdapter, normalizeProviderExecutionStatus, providerBrokerTransport,
  targetConfigError, type ProviderTargetConfig,
} from "./f10-provider";

const source = { id: "00000000-0000-0000-0000-000000000001", type: "SPC" as const, name: "Reviewed agent", content: { prompt: "User-reviewed instructions" } };
const configs: ProviderTargetConfig[] = [
  { provider: "SLACK", target: "SLACK_NOTIFICATIONS", workspaceId: "T123", channelId: "C123" },
  { provider: "SLACK", target: "SLACK_AGENT", workspaceId: "T123", channelId: "C123", agentEndpoint: "https://agent.example.com/invoke" },
  { provider: "LANGCHAIN", target: "LANGCHAIN_APP", runtimeEndpoint: "https://runtime.example.com/import", deploymentName: "reviewed-agent" },
  { provider: "LANGSMITH", target: "LANGSMITH_DATASET", workspaceId: "workspace-1", datasetName: "Review set" },
];
afterEach(() => vi.unstubAllGlobals());

describe("F10 subscriber collaboration destinations", () => {
  it.each(configs)("builds deterministic, source-bound $provider / $target exports", config => {
    expect(targetConfigError(config)).toBeUndefined();
    const profile = { outputKind: "SPC" as const, family: config.provider, target: config.target };
    const first = buildExport(source, profile), second = buildExport(source, profile);
    expect(first.bundle.equals(second.bundle)).toBe(true);
    const contract = JSON.parse(first.files.find(f => f.path === "integration/contract.json")!.content.toString());
    expect(contract).toMatchObject({ provider: config.provider, target: config.target, automaticExecution: false, requiresConfiguredBrokerAdapter: true });
    expect(contract.source.contentSha256).toBe(createHash("sha256").update(JSON.stringify(source.content, null, 2) + "\n").digest("hex"));
  });

  it("rejects cross-provider targets, unknown token fields and missing agent endpoints", () => {
    for (const config of configs) {
      expect(targetConfigError({ ...config, target: "AWS_LAMBDA" })).toBeTruthy();
      expect(targetConfigError({ ...config, token: "not-allowed" } as ProviderTargetConfig)).toContain("unsupported");
      expect(validateProfile({ outputKind: "SPC", family: config.provider, target: "AWS_LAMBDA" })).toBeTruthy();
    }
    expect(targetConfigError({ ...configs[1]!, agentEndpoint: undefined })).toContain("agentEndpoint");
    expect(targetConfigError({ ...configs[0]!, workspaceId: " " })).toBeTruthy();
  });

  it.each(["http://agent.example.com", "https://user:password@agent.example.com", "https://localhost", "https://127.0.0.1/invoke", "https://[::1]/invoke", "https://service.local/invoke", "https://agent.example.com?token=private", "https://agent.example.com#private"])(
    "rejects credential-bearing or non-public runtime URLs: %s", agentEndpoint => {
      expect(targetConfigError({ ...configs[1]!, agentEndpoint })).toBeTruthy();
    },
  );

  it("does not create Slack mentions or include source prompts in notification text", () => {
    const exported = buildExport({ ...source, name: "<!channel> & <@U123>" }, { outputKind: "SPC", family: "SLACK", target: "SLACK_NOTIFICATIONS" });
    const message = JSON.parse(exported.files.find(f => f.path === "integration/slack-message.json")!.content.toString());
    expect(message).toMatchObject({ mrkdwn: false, parse: "none", link_names: false, unfurl_links: false });
    expect(message.text).not.toContain("<!channel>");
    expect(message.text).not.toContain(source.content.prompt);
  });

  it("publishes dataset input with source metadata without inventing expected answers or evaluation PASS", () => {
    const exported = buildExport(source, { outputKind: "SPC", family: "LANGSMITH", target: "LANGSMITH_DATASET" });
    const example = JSON.parse(exported.files.find(f => f.path === "integration/langsmith-example.json")!.content.toString());
    expect(example.inputs.artifact).toEqual(source.content);
    expect(example.metadata.source_artifact_id).toBe(source.id);
    expect(example.outputs).toBeUndefined();
    expect(example.verdict).toBeUndefined();
  });

  it.each([
    ["SLACK", "SLACK_NOTIFICATIONS", "POSTED"], ["SLACK", "SLACK_AGENT", "REGISTERED"],
    ["LANGCHAIN", "LANGCHAIN_APP", "IMPORTED"], ["LANGSMITH", "LANGSMITH_DATASET", "PUBLISHED"],
  ])("recognizes only a matching provider operation receipt: %s %s", (provider, target, status) => {
    expect(normalizeProviderExecutionStatus(provider as Family, target, status)).toBe("COMPLETED");
    expect(() => normalizeProviderExecutionStatus("AWS", target, status)).toThrow();
  });

  it("submits an explicit user-authorized operation and never converts acceptance into confirmed execution", async () => {
    const transport = vi.fn().mockResolvedValue(new Response(JSON.stringify({ accepted: true, receipt_id: "provider-operation" }), { status: 200 }));
    vi.stubGlobal("fetch", transport);
    const config = configs[0]!;
    const exported = buildExport(source, { outputKind: "SPC", family: config.provider, target: config.target });
    const receipt = await createProviderAdapter(providerBrokerTransport("https://broker.example.com", "synthetic-broker-token"), "synthetic-signature")
      .deliver(config, "opaque-user-reference", exported, "explicit-operation", new Date(Date.now() + 10_000));
    const submitted = JSON.parse(transport.mock.calls[0]![1].body);
    expect(submitted).toMatchObject({ provider: "SLACK", target: "SLACK_NOTIFICATIONS", authorization_ref: "opaque-user-reference", target_config: { workspaceId: "T123", channelId: "C123" } });
    expect(receipt).toMatchObject({ accepted: true, execution: "NOT_CONFIRMED" });
    expect(JSON.stringify(receipt)).not.toContain("opaque-user-reference");
  });

  it("fails explicitly when no broker is configured", async () => {
    await expect(providerBrokerTransport("", "")({
      provider: "SLACK", target: "SLACK_AGENT", authorizationRef: "unused",
      bundle: Buffer.from("unused"), idempotencyKey: "unused", deadline: new Date(),
    })).rejects.toThrow("not configured");
  });
});
