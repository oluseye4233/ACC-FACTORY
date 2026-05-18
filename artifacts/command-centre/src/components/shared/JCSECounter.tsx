import { cn } from "@/lib/utils";

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

  return (
    <div className={cn("flex items-baseline gap-1 font-mono font-bold tracking-tighter", className)}>
      <span className={cn(sizes[size], getQualityColor())}>
        {score.toString().padStart(2, "0")}
      </span>
      <span className="text-muted-foreground text-sm">/{max}</span>
    </div>
  );
}
