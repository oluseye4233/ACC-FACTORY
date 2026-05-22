import { useState } from "react";
import {
  useUpdateSession,
  useGetMe,
  getGetSessionQueryKey,
  type LlmProvider,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PROVIDER_LABELS: Record<LlmProvider, string> = {
  claude: "Claude Sonnet 4",
  openai: "OpenAI GPT-5.4",
  gemini: "Gemini 3.1 Pro",
};

export function ProviderSelector({
  sessionId,
  value,
}: {
  sessionId: string;
  value: LlmProvider;
}) {
  const qc = useQueryClient();
  const { data: me } = useGetMe();
  const tier = me?.subscriber?.tier ?? "EXPLORER";
  const isExplorer = tier === "EXPLORER";
  const update = useUpdateSession();
  const [pending, setPending] = useState<LlmProvider | null>(null);

  const current = pending ?? value;

  const onChange = (next: string) => {
    const p = next as LlmProvider;
    if (p === current) return;
    setPending(p);
    update.mutate(
      { id: sessionId, data: { preferredModelProvider: p } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetSessionQueryKey(sessionId) });
        },
        onSettled: () => setPending(null),
      },
    );
  };

  return (
    <Select value={current} onValueChange={onChange} disabled={update.isPending}>
      <SelectTrigger
        className="h-7 px-2 font-mono text-[10px] gap-1 w-auto min-w-[140px]"
        data-testid="select-session-provider"
        title={
          isExplorer
            ? "Explorer tier is locked to Claude. Upgrade to use OpenAI or Gemini."
            : "Default LLM provider for HARNESS engines in this session"
        }
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="claude">{PROVIDER_LABELS.claude}</SelectItem>
        <SelectItem value="openai" disabled={isExplorer}>
          {PROVIDER_LABELS.openai}
          {isExplorer ? " (Practitioner+)" : ""}
        </SelectItem>
        <SelectItem value="gemini" disabled={isExplorer}>
          {PROVIDER_LABELS.gemini}
          {isExplorer ? " (Practitioner+)" : ""}
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
