import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CertTier } from "@workspace/api-client-react";

interface CertTierChipProps {
  tier: string;
  className?: string;
}

export function CertTierChip({ tier, className }: CertTierChipProps) {
  if (!tier || tier === CertTier.NONE) return null;
  
  const getColors = () => {
    switch (tier) {
      case CertTier.BRONZE:
        return "bg-[#cd7f32]/10 text-[#cd7f32] border-[#cd7f32]/20";
      case CertTier.SILVER:
        return "bg-slate-300/10 text-slate-300 border-slate-300/20";
      case CertTier.GOLD:
        return "bg-secondary/10 text-secondary border-secondary/20";
      case CertTier.PLATINUM:
        return "bg-cyan-100/10 text-cyan-100 border-cyan-100/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Badge variant="outline" className={cn("font-mono font-bold text-[10px]", getColors(), className)}>
      {tier}
    </Badge>
  );
}
