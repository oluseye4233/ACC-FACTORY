import { cn } from "@/lib/utils";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

interface JCSECounterProps {
  score: number;
  max?: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function JCSECounter({ score, max = 50, className, size = "md" }: JCSECounterProps) {
  const getQualityColor = () => {
    const percentage = score / max;
    if (percentage >= 0.9) return "text-primary";
    if (percentage >= 0.7) return "text-secondary";
    return "text-destructive";
  };

  const sizes = {
    sm: "text-2xl",
    md: "text-4xl",
    lg: "text-6xl"
  };

  const tier =
    score >= 48 ? "PLATINUM" :
    score >= 43 ? "GOLD" :
    score >= 36 ? "SILVER" :
    score >= 30 ? "BRONZE" : "NONE";

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <div
          className={cn("flex items-baseline gap-1 font-mono font-bold tracking-tighter cursor-help", className)}
          aria-label={`JCSE — Junglenomics Composite Score Estimate: ${score} of ${max}, tier ${tier}`}
        >
          <span className={cn(sizes[size], getQualityColor())}>
            {score.toString().padStart(2, "0")}
          </span>
          <span className="text-muted-foreground text-sm">/{max}</span>
        </div>
      </HoverCardTrigger>
      <HoverCardContent side="bottom" align="start" sideOffset={6} className="w-80 p-0 overflow-hidden">
        <div className="px-4 py-2 border-b bg-muted/50 flex items-center justify-between gap-2">
          <span className="font-mono text-xs font-bold text-primary">JCSE</span>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {tier} · {score}/{max}
          </span>
        </div>
        <div className="px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-foreground leading-snug">
            Junglenomics Composite Score Estimate
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            The composite AI-agent quality score (0–50) F1 assigns to a prompt across the 7-pillar Context Craft rubric:
            SYSTEM, ROLE, INSTRUCTION (max 8), EXAMPLE, CONSTRAINT, FORMAT, DATA.
          </p>
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground pt-1">
            48–50 PLATINUM · 43–47 GOLD · 36–42 SILVER · 30–35 BRONZE
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
