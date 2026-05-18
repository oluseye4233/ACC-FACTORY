import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TierBadgeProps {
  tier: string;
  className?: string;
}

export function TierBadge({ tier, className }: TierBadgeProps) {
  const getColors = () => {
    switch (tier) {
      case "EXPLORER":
        return "bg-muted text-muted-foreground border-border";
      case "PRACTITIONER":
        return "bg-primary/10 text-primary border-primary/20";
      case "ARCHITECT":
        return "bg-secondary/10 text-secondary border-secondary/20";
      case "INSTITUTION":
        return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Badge variant="outline" className={cn("font-mono font-bold tracking-wider", getColors(), className)}>
      {tier}
    </Badge>
  );
}
