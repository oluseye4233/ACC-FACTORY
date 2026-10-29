import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useGetLlmRecommendation, type LlmProvider } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const NAME: Record<LlmProvider, string> = {
  claude: "Claude", openai: "OpenAI", gemini: "Gemini", deepseek: "DeepSeek",
  kimi: "Kimi", qwen: "Qwen", glm: "GLM",
};
const money = (value: number) => `$${value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")}`;
type ComplexityChoice = "auto" | "simple" | "standard" | "complex";
type Props = {
  featureId?: number;
  onApply: (provider: LlmProvider) => void;
  disabled?: boolean;
  currentProvider?: LlmProvider;
};

export function ModelRecommendation({
  featureId, onApply, disabled, currentProvider,
}: Props) {
  const [open, setOpen] = useState(false);
  const [complexity, setComplexity] = useState<ComplexityChoice>("auto");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled}
          className="h-7 px-2 gap-1 text-[10px] font-mono"
          aria-label="Auto model suggestion" title="Optional cost and complexity recommendation">
          <Sparkles className="h-3 w-3" aria-hidden="true" /> Auto
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,360px)] max-h-[75vh] overflow-y-auto space-y-3">
        {open && <RecommendationPanel featureId={featureId} complexity={complexity}
          onComplexityChange={setComplexity} currentProvider={currentProvider}
          disabled={disabled} onApply={provider => {
            onApply(provider);
            setOpen(false);
          }} />}
      </PopoverContent>
    </Popover>
  );
}

function RecommendationPanel({
  featureId, complexity, onComplexityChange, currentProvider, disabled, onApply,
}: Props & { complexity: ComplexityChoice; onComplexityChange: (value: ComplexityChoice) => void }) {
  const query = useGetLlmRecommendation(
    { featureId, complexity }, { query: { retry: false } },
  );
  const recommendation = query.data?.recommended;
  return <>
        <div>
          <h3 className="text-sm font-semibold">Cost &amp; complexity suggestion</h3>
          <p className="text-xs text-muted-foreground">Optional. Nothing changes until you apply it.</p>
        </div>
        <label className="text-xs block space-y-1">
          <span>Task complexity</span>
          <select aria-label="Task complexity" value={complexity}
            onChange={event => onComplexityChange(event.target.value as ComplexityChoice)}
            className="block w-full rounded border bg-background text-foreground p-2">
            <option value="auto">Auto — use current stage</option>
            <option value="simple">Simple — cost-first profile</option>
            <option value="standard">Standard — balanced profile</option>
            <option value="complex">Complex — reasoning-first profile</option>
          </select>
        </label>
        {query.isFetching ? <p role="status" className="text-xs">Checking prices and eligible providers…</p>
          : query.isError ? <div role="alert" className="text-xs">
            Suggestion unavailable. Your selected model has not changed.
            <Button type="button" size="sm" variant="outline" onClick={() => query.refetch()}>Try again</Button>
          </div>
          : query.data && <>
            {recommendation && <div className="rounded border border-primary/30 bg-primary/5 p-3">
              <p className="text-sm font-semibold">{NAME[recommendation.provider]} suggested</p>
              <p className="text-xs break-all text-muted-foreground">{recommendation.modelId}</p>
              <p className="text-xs mt-1">Estimated {money(recommendation.estimatedCostUsd)} USD per call</p>
            </div>}
            <p className="text-xs">{query.data.reason}</p>
            <p className="text-xs text-muted-foreground">
              {query.data.complexity} profile · {query.data.estimatedInputTokens.toLocaleString()} input /
              {" "}{query.data.estimatedOutputTokens.toLocaleString()} output tokens estimated.
            </p>
            {query.data.candidates.length > 1 && <details className="text-xs">
              <summary className="cursor-pointer">Compare eligible models</summary>
              <ul className="mt-2 space-y-1">
                {query.data.candidates.map(candidate => <li key={candidate.provider}
                  className="flex justify-between gap-2">
                  <span>{NAME[candidate.provider]}</span><span>{money(candidate.estimatedCostUsd)} USD</span>
                </li>)}
              </ul>
            </details>}
            {recommendation && <Button type="button" className="w-full" size="sm"
              disabled={disabled || currentProvider === recommendation.provider}
              onClick={() => {
                onApply(recommendation.provider);
              }}>
              {currentProvider === recommendation.provider ? "Suggested model already selected" : "Use suggested model"}
            </Button>}
            <p className="text-xs text-muted-foreground">{query.data.disclaimer}</p>
          </>}
  </>;
}
