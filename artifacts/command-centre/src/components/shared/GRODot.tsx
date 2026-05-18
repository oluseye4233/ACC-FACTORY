import { cn } from "@/lib/utils";

interface GRODotProps {
  state?: string;
  className?: string;
}

export function GRODot({ state, className }: GRODotProps) {
  if (!state) return null;
  
  const getColors = () => {
    switch (state) {
      case "SAFE_LIFE":
      case "READY":
        return "bg-primary";
      case "GREY":
      case "REFINE":
        return "bg-yellow-500";
      case "RED":
      case "GROW":
        return "bg-destructive";
      default:
        return "bg-muted-foreground";
    }
  };

  return (
    <div 
      className={cn("w-2 h-2 rounded-full", getColors(), className)} 
      title={`GRO State: ${state}`}
    />
  );
}
