import type { Scorecard } from "@workspace/api-client-react";

interface ScorecardPanelProps {
  scorecard: Scorecard;
  defaultOpen?: boolean;
  testId: string;
}

export function ScorecardPanel({
  scorecard,
  defaultOpen = false,
  testId,
}: ScorecardPanelProps) {
  return (
    <details
      open={defaultOpen}
      className="rounded-md border border-border/50 bg-background/20"
      data-testid={`scorecard-${testId}`}
    >
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 font-mono text-xs font-bold"
        data-testid={`scorecard-toggle-${testId}`}
      >
        <span className="text-primary">{scorecard.kind} SCORECARD</span>
        <span className="text-foreground">
          {scorecard.score}/{scorecard.maxScore}
        </span>
      </summary>
      <div className="space-y-4 border-t border-border/40 p-3">
        <div>
          <p
            className="text-xs leading-relaxed text-foreground/90"
            data-testid={`scorecard-summary-${testId}`}
          >
            {scorecard.summary}
          </p>
          <p className="mt-1 font-mono text-[10px] leading-relaxed text-muted-foreground">
            Calculation: {scorecard.calculation}
          </p>
        </div>

        {scorecard.strengths.length > 0 && (
          <div>
            <h5 className="font-mono text-[10px] font-bold uppercase tracking-wider text-secondary">
              Strengths
            </h5>
            <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
              {scorecard.strengths.map((strength, index) => (
                <li key={`${index}-${strength}`} data-testid={`scorecard-strength-${testId}-${index}`}>
                  {strength}
                </li>
              ))}
            </ul>
          </div>
        )}

        <section aria-label="Advisory report">
          <h5 className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
            Advisory report
          </h5>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {scorecard.advisoryReport.summary}
          </p>
          <ol className="mt-2 space-y-2">
            {scorecard.advisoryReport.steps.map((step, index) => (
              <li
                key={`${step.title}-${index}`}
                className="border-l-2 border-primary/40 pl-2"
                data-testid={`scorecard-step-${testId}-${index}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">{step.title}</span>
                  <span className="font-mono text-[9px] text-muted-foreground">
                    {step.priority}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  {step.why}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-foreground/90">
                  {step.action}
                </p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                  {step.expectedImpact}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <div>
          <h5 className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Score explanations
          </h5>
          <div className="mt-2 space-y-1">
            {scorecard.dimensions.map((dimension) => (
              <details
                key={dimension.key}
                className="rounded border border-border/40 px-2"
                data-testid={`scorecard-dimension-${testId}-${dimension.key.toLowerCase()}`}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-2 font-mono text-[10px]">
                  <span>{dimension.label}</span>
                  <span>
                    {dimension.score}/{dimension.maxScore}
                    {dimension.weightPercent !== null
                      ? ` · ${dimension.weightPercent}% weight`
                      : ""}
                  </span>
                </summary>
                <div className="space-y-2 border-t border-border/30 py-2 text-xs">
                  <p className="leading-relaxed text-muted-foreground">
                    {dimension.explanation}
                  </p>
                  {dimension.gaps.length > 0 && (
                    <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                      {dimension.gaps.map((gap, gapIndex) => (
                        <li key={`${gapIndex}-${gap}`}>{gap}</li>
                      ))}
                    </ul>
                  )}
                  {dimension.actions.length > 0 && (
                    <ul className="list-disc space-y-1 pl-4 text-foreground/90">
                      {dimension.actions.map((action, actionIndex) => (
                        <li key={`${actionIndex}-${action}`}>{action}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </details>
            ))}
          </div>
        </div>

        {scorecard.gaps.length > 0 && (
          <div>
            <h5 className="font-mono text-[10px] font-bold uppercase tracking-wider text-destructive">
              Gaps
            </h5>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {scorecard.gaps.map((gap, index) => (
                <li key={`${index}-${gap}`}>{gap}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}