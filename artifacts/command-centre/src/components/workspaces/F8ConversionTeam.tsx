import type { CodebaseCollaboration } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";

export function F8ConversionTeam({ review, hasBundle }: {
  review?: CodebaseCollaboration;
  hasBundle: boolean;
}) {
  const recorded = review?.reviewStatus === "MODEL_REVIEW_NOT_INDEPENDENT";
  return (
    <Card className="p-5 bg-card/50" data-testid="f8-conversion-team">
      <h4 className="font-mono text-sm font-bold">CODE CREATION TEAM</h4>
      <p className="text-xs text-muted-foreground mt-2">
        One F8 conversion: CODE ONE + crafts the scaffold, CODE ORACLE looks for
        specification gaps, and CODE DJ maps the proposed fixes to generated files.
        VIBE DJ and HOST DJ still guide the implementation path.
      </p>
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer font-semibold">How they work together</summary>
        <ol className="list-decimal ml-5 mt-2 space-y-1">
          <li>CODE ORACLE compares the supplied specifications with the intended code.</li>
          <li>CODE DJ revises the scaffold and identifies the files addressing each finding.</li>
          <li>CODE ONE + assembles the editable bundle. Unresolved source decisions stop generation from being saved.</li>
        </ol>
      </details>
      {hasBundle && !recorded && (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
          No CODE ORACLE / CODE DJ review was recorded for this bundle. Do not treat
          missing review data as a pass.
        </p>
      )}
      {recorded && (
        <div className="mt-3 space-y-3">
          {review.oracle.length === 0 && (
            <p className="text-xs">No specific gaps were reported by the model. This does not establish complete specification coverage.</p>
          )}
          {review.oracle.map((finding, index) => {
            const change = review.dj.find(item => item.requirement === finding.requirement);
            return (
              <div key={index} className="border-l-2 border-secondary pl-3 text-xs space-y-1">
                <p className="font-semibold">{finding.requirement}</p>
                <p>CODE ORACLE: {finding.gap}</p>
                {change && <><p>CODE DJ: {change.change}</p><p className="font-mono break-all">{change.files.join(" · ")}</p></>}
                {finding.resolution === "NEEDS_SOURCE_DECISION" && <p>Source decision required.</p>}
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        This is model self-review within one conversion, not independent agent
        execution or verification. Drift, real test evidence and release safeguards
        remain required. No additional conversion call is introduced for these roles.
      </p>
    </Card>
  );
}
