import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export type NativeProvider =
  | "AWS"
  | "AZURE"
  | "OPENAI_AGENTS"
  | "GEMINI_AGENTS"
  | "SLACK"
  | "LANGCHAIN"
  | "LANGSMITH";

export type ProviderConfigField = { key: string; label: string; required?: boolean; endpoint?: boolean; requiredForTargets?: string[]; hint?: string };

export const NATIVE_PROVIDERS: NativeProvider[] = ["AWS", "AZURE", "OPENAI_AGENTS", "GEMINI_AGENTS", "SLACK", "LANGCHAIN", "LANGSMITH"];

export const PROVIDER_LABELS: Record<NativeProvider, string> = {
  AWS: "AWS",
  AZURE: "Azure",
  OPENAI_AGENTS: "OpenAI Agents",
  GEMINI_AGENTS: "Gemini Agents",
  SLACK: "Slack",
  LANGCHAIN: "LangChain (your runtime)",
  LANGSMITH: "LangSmith",
};

export const TARGET_LABELS: Record<string, string> = {
  SLACK_NOTIFICATIONS: "Slack notifications",
  SLACK_AGENT: "Slack released-agent entry point",
  LANGCHAIN_APP: "LangChain app on your runtime",
  LANGSMITH_DATASET: "LangSmith evaluation dataset",
};

export const PROVIDER_TARGETS: Record<NativeProvider, string[]> = {
  AWS: ["AWS_LAMBDA", "AWS_ECS_FARGATE", "AWS_S3"],
  AZURE: ["AZURE_FUNCTIONS", "AZURE_CONTAINER_APPS", "AZURE_BLOB_STORAGE"],
  OPENAI_AGENTS: ["OPENAI_AGENTS_SDK"],
  GEMINI_AGENTS: ["GEMINI_ADK", "GEMINI_VERTEX_AGENT_ENGINE"],
  SLACK: ["SLACK_NOTIFICATIONS", "SLACK_AGENT"],
  LANGCHAIN: ["LANGCHAIN_APP"],
  LANGSMITH: ["LANGSMITH_DATASET"],
};

export const PROVIDER_CONFIG_FIELDS: Record<NativeProvider, ProviderConfigField[]> = {
  AWS: [{ key: "region", label: "Region", required: true }, { key: "resourceName", label: "Resource name", required: true }, { key: "accountId", label: "Account ID" }, { key: "roleArn", label: "Role ARN" }],
  AZURE: [{ key: "subscriptionId", label: "Subscription ID", required: true }, { key: "resourceGroup", label: "Resource group", required: true }, { key: "location", label: "Location", required: true }, { key: "resourceName", label: "Resource name", required: true }, { key: "tenantId", label: "Tenant ID" }],
  OPENAI_AGENTS: [{ key: "model", label: "Model", required: true }, { key: "environment", label: "Environment", required: true }, { key: "projectId", label: "Project ID" }, { key: "agentId", label: "Agent ID" }],
  GEMINI_AGENTS: [{ key: "projectId", label: "Project ID", required: true }, { key: "location", label: "Location", required: true }, { key: "model", label: "Model", required: true }, { key: "environment", label: "Environment", required: true }, { key: "agentId", label: "Agent ID" }, { key: "displayName", label: "Display name" }],
  SLACK: [
    { key: "workspaceId", label: "Workspace ID", required: true, hint: "Starts with T, from your Slack workspace settings." },
    { key: "channelId", label: "Channel ID", required: true, hint: "Starts with C, from channel details." },
    { key: "agentEndpoint", label: "Agent endpoint (HTTPS)", endpoint: true, requiredForTargets: ["SLACK_AGENT"], hint: "Your released agent's public HTTPS entry point. Required for the agent target." },
  ],
  LANGCHAIN: [
    { key: "runtimeEndpoint", label: "Runtime endpoint (HTTPS)", required: true, endpoint: true, hint: "Public HTTPS URL of the runtime you host." },
    { key: "deploymentName", label: "Deployment name", required: true },
  ],
  LANGSMITH: [
    { key: "workspaceId", label: "Workspace ID", required: true },
    { key: "datasetName", label: "Dataset name", required: true },
  ],
};

export function isNativeProvider(value: string): value is NativeProvider {
  return (NATIVE_PROVIDERS as string[]).includes(value);
}

export function isFieldRequired(field: ProviderConfigField, target: string): boolean {
  return Boolean(field.required || field.requiredForTargets?.includes(target));
}

/** Returns an error message, or null when the value is an acceptable public HTTPS endpoint. */
export function validatePublicHttpsEndpoint(value: string): string | null {
  let url: URL;
  try { url = new URL(value.trim()); } catch { return "Enter a full URL starting with https://"; }
  if (url.protocol !== "https:") return "Endpoint must use HTTPS.";
  if (url.username || url.password) return "Remove credentials from the URL.";
  if (url.search || value.includes("?")) return "Remove the query string.";
  if (url.hash || value.includes("#")) return "Remove the fragment.";
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".")) return "Endpoint must be publicly reachable.";
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return "Use a public hostname, not an IP literal.";
  }
  if (host.startsWith("[")) return "Use a public hostname, not an IP literal.";
  return null;
}

/** Validate the full config for provider/target. Returns field-key to message map. */
export function validateProviderConfig(provider: NativeProvider, target: string, config: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of PROVIDER_CONFIG_FIELDS[provider]) {
    const value = config[field.key]?.trim() ?? "";
    if (!value) { if (isFieldRequired(field, target)) errors[field.key] = `${field.label} is required.`; continue; }
    if (field.endpoint) { const err = validatePublicHttpsEndpoint(value); if (err) errors[field.key] = err; }
  }
  return errors;
}

/** Strip empty values and fields not relevant to the chosen target. */
export function buildTargetConfig(provider: NativeProvider, config: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of PROVIDER_CONFIG_FIELDS[provider]) {
    const v = config[field.key]?.trim();
    if (v) out[field.key] = v;
  }
  return out;
}

type Guide = { summary: string; targets?: Array<{ id: string; text: string }>; signup?: { href: string; label: string }; docs?: { href: string; label: string }; caveat: string };

export const PROVIDER_GUIDES: Partial<Record<NativeProvider, Guide>> = {
  SLACK: {
    summary: "Deliver into a Slack workspace you already administer.",
    targets: [
      { id: "SLACK_NOTIFICATIONS", text: "Notifications post release evidence and status into one channel. Nothing executes." },
      { id: "SLACK_AGENT", text: "Agent entry point registers your released agent's own HTTPS endpoint so the channel can reach it. The agent runs on infrastructure you host." },
    ],
    signup: { href: "https://slack.com/get-started", label: "Create a Slack workspace" },
    caveat: "Slack plans and any charges are between you and Slack.",
  },
  LANGCHAIN: {
    summary: "Hand the bundle to a LangChain runtime that you host and operate.",
    targets: [{ id: "LANGCHAIN_APP", text: "The bundle is delivered to your runtime endpoint under the deployment name you choose. The legacy LANGCHAIN export in Hand-off remains available." }],
    docs: { href: "https://docs.langchain.com/oss/javascript/langchain/overview", label: "LangChain framework docs" },
    caveat: "The LangChain framework is open source and needs no subscription. Hosting, model and other third-party costs are yours.",
  },
  LANGSMITH: {
    summary: "Publish the bundle's evaluation cases as a dataset in your LangSmith workspace.",
    targets: [{ id: "LANGSMITH_DATASET", text: "Creates or updates a dataset only. It does not send traces and does not run evaluations or produce a PASS." }],
    signup: { href: "https://smith.langchain.com/", label: "Sign up for LangSmith" },
    caveat: "LangSmith plans, limits and charges are handled by LangChain, not here.",
  },
};

export function ManualHandoffNotice({ provider, onManualExport }: { provider: NativeProvider; onManualExport: () => void }) {
  return (
    <section aria-label="Manual subscription handoff" className="grid gap-3 rounded-sm border-2 border-primary/40 bg-background p-4 md:grid-cols-[1fr_auto] md:items-center">
      <div className="space-y-1">
        <p className="font-display tracking-widest text-sm text-primary">MANUAL HANDOFF · ALWAYS AVAILABLE</p>
        <p className="font-mono text-xs">Export the bundle from Hand-off, sign up or sign in with {PROVIDER_LABELS[provider]} yourself, and continue in your own account. This works even when no broker is configured.</p>
        <p className="font-mono text-[10px] uppercase text-muted-foreground">Connect and Deliver below require a server-side broker adapter for {PROVIDER_LABELS[provider]} plus your authorization. Without it, no delivery is attempted and nothing is reported as live.</p>
      </div>
      <Button type="button" variant="outline" onClick={onManualExport}>Open manual export</Button>
    </section>
  );
}

export function ProviderOnboarding({ provider, target, onConnect, connecting, hasActiveConnection }: {
  provider: NativeProvider;
  target: string;
  onConnect: () => void;
  connecting: boolean;
  hasActiveConnection: boolean;
}) {
  const guide = PROVIDER_GUIDES[provider];
  if (!guide) return null;
  const headingId = `f10-onboarding-${provider.toLowerCase()}`;
  return (
    <section aria-labelledby={headingId} className="grid gap-4 rounded-sm border border-border/60 bg-background/60 p-4 md:grid-cols-[1.4fr_1fr]">
      <div className="space-y-3">
        <h3 id={headingId} className="font-display tracking-widest text-sm text-primary">{PROVIDER_LABELS[provider].toUpperCase()} ONBOARDING</h3>
        <p className="font-mono text-xs">{guide.summary}</p>
        {guide.targets && (
          <ul className="space-y-2">
            {guide.targets.map(t => (
              <li key={t.id} className={`border-l-2 pl-3 font-mono text-xs ${t.id === target ? "border-primary text-foreground" : "border-border text-muted-foreground"}`}>
                <span className="block text-[10px] uppercase">{TARGET_LABELS[t.id] ?? t.id}{t.id === target ? " (selected)" : ""}</span>
                {t.text}
              </li>
            ))}
          </ul>
        )}
        <p className="font-mono text-[10px] uppercase text-muted-foreground">{guide.caveat} ATANDA does not sell these subscriptions and does not guarantee plan eligibility. Delivery acceptance is not proof of runtime execution.</p>
      </div>
      <div className="grid content-start gap-3">
        <div className="space-y-2 border border-border/50 p-3">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Already have an account</p>
          <Button type="button" size="sm" className="w-full" onClick={onConnect} disabled={connecting}>
            {connecting ? "Opening authorization..." : hasActiveConnection ? `Authorize another ${PROVIDER_LABELS[provider]} account` : `Authorize ${PROVIDER_LABELS[provider]}`}
          </Button>
          <p className="font-mono text-[10px] text-muted-foreground">Uses the provider's own sign-in. No tokens are entered on this page.</p>
        </div>
        <div className="space-y-2 border border-border/50 p-3">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">New here</p>
          {guide.signup && (
            <a href={guide.signup.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-mono text-xs text-primary underline-offset-4 hover:underline">
              {guide.signup.label} <ExternalLink className="h-3 w-3" aria-hidden="true" /><span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
          {guide.docs && (
            <a href={guide.docs.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-mono text-xs text-primary underline-offset-4 hover:underline">
              {guide.docs.label} <ExternalLink className="h-3 w-3" aria-hidden="true" /><span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
