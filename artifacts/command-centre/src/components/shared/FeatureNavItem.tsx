import { cn } from "@/lib/utils";
import { FeatureStatus } from "@workspace/api-client-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Lock, Circle, CheckCircle2, Loader2 } from "lucide-react";

interface FeatureNavItemProps {
  id: number;
  name: string;
  title: string;
  description: string;
  status: string;
  isActive: boolean;
  onClick: () => void;
}

export function FeatureNavItem({ id, name, title, description, status, isActive, onClick }: FeatureNavItemProps) {
  const isLocked = status === FeatureStatus.LOCKED;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={isLocked}
          className={cn(
            "w-full flex items-center justify-between p-3 rounded-md text-left transition-all duration-200 border border-transparent",
            isActive ? "bg-accent text-accent-foreground border-border" : "hover:bg-accent/50 text-muted-foreground",
            isLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
          )}
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold w-6">{name}</span>
            <span className="font-medium text-sm">{title}</span>
          </div>
          <div>
            {status === FeatureStatus.LOCKED && <Lock className="h-4 w-4" />}
            {status === FeatureStatus.AVAILABLE && <Circle className="h-4 w-4" />}
            {status === FeatureStatus.IN_PROGRESS && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            {status === FeatureStatus.COMPLETE && <CheckCircle2 className="h-4 w-4 text-primary" />}
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[200px]">
        <p>{description}</p>
      </TooltipContent>
    </Tooltip>
  );
}
