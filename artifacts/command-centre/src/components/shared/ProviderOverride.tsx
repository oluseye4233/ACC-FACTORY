import {
  useGetMe,
  type LlmProvider,
} from "@workspace/api-client-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LABEL: Record<LlmProvider, string> = {
  claude: "Claude",
  openai: "OpenAI",
  gemini: "Gemini",
  deepseek: "DeepSeek",
  kimi: "Kimi",
  qwen: "Qwen",
  glm: "GLM",
};

const OVERRIDE_VALUES = [
  "session",
  "claude",
  "openai",
  "gemini",
  "deepseek",
  "kimi",
  "qwen",
  "glm",
] as const;
export type OverrideValue = (typeof OVERRIDE_VALUES)[number];

/**
 * Per-engine provider override. "session" (default) defers to the
 * session-level preferred provider; explicit picks are sent as
 * `body.provider` on the engine mutation for a single run.
 */
export function ProviderOverride({
  value,
  onChange,
  disabled,
  testId,
}: {
  value: OverrideValue;
  onChange: (v: OverrideValue) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const { data: me } = useGetMe();
  const isExplorer = (me?.subscriber?.tier ?? "EXPLORER") === "EXPLORER";

  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as OverrideValue)}
      disabled={disabled}
    >
      <SelectTrigger
        className="h-7 px-2 font-mono text-[10px] gap-1 w-auto min-w-[130px]"
        data-testid={testId ?? "select-engine-provider"}
        title={
          isExplorer
            ? "Explorer tier is locked to Claude. Upgrade to override with another provider."
            : "Run this engine on a specific provider (overrides the session default)"
        }
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="session">Session default</SelectItem>
        <SelectItem value="claude">{LABEL.claude}</SelectItem>
        <SelectItem value="openai" disabled={isExplorer}>
          {LABEL.openai}
          {isExplorer ? " (Practitioner+)" : ""}
        </SelectItem>
        <SelectItem value="gemini" disabled={isExplorer}>
          {LABEL.gemini}
          {isExplorer ? " (Practitioner+)" : ""}
        </SelectItem>
        <SelectItem value="deepseek" disabled={isExplorer}>
          {LABEL.deepseek}
          {isExplorer ? " (Practitioner+)" : ""}
        </SelectItem>
        <SelectItem value="kimi" disabled={isExplorer}>
          {LABEL.kimi}
          {isExplorer ? " (Practitioner+)" : ""}
        </SelectItem>
        <SelectItem value="qwen" disabled={isExplorer}>
          {LABEL.qwen}
          {isExplorer ? " (Practitioner+)" : ""}
        </SelectItem>
        <SelectItem value="glm" disabled={isExplorer}>
          {LABEL.glm}
          {isExplorer ? " (Practitioner+)" : ""}
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

/** Map an override value to the optional `provider` field sent in the body. */
export function overrideToBody(
  v: OverrideValue,
): { provider?: LlmProvider } {
  return v === "session" ? {} : { provider: v };
}
