import { cn } from "@/lib/utils";
import { FeatureStatus } from "@workspace/api-client-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Lock, Circle, CheckCircle2, Loader2, Sparkles } from "lucide-react";

interface FeatureNavItemProps {
  id: number;
  name: string;
  title: string;
  description: string;
  explainer?: string;
  status: string;
  isActive: boolean;
  isNext?: boolean;
  onClick: () => void;
}

export function FeatureNavItem({
  id,
  name,
  title,
  description,
  explainer,
  status,
  isActive,
  isNext = false,
  onClick,
}: FeatureNavItemProps) {
  const isLocked = status === FeatureStatus.LOCKED;
  const showAttention = isNext && !isActive && !isLocked;

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          onClick={onClick}
          disabled={isLocked}
          data-testid={`feature-nav-${name.toLowerCase()}`}
          data-next={showAttention ? "true" : undefined}
          className={cn(
            "relative w-full flex items-center justify-between p-3 rounded-md text-left transition-all duration-200 border",
            isActive
              ? "bg-accent text-accent-foreground border-border"
              : "border-transparent hover:bg-accent/50 text-muted-foreground",
            isLocked && "opacity-50 cursor-not-allowed",
            !isLocked && "cursor-pointer",
            showAttention &&
              "border-primary/60 bg-primary/5 text-foreground animate-feature-pulse",
          )}
        >
          {showAttention && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-md ring-1 ring-primary/60 animate-feature-ring"
            />
          )}
          <div className="flex items-center gap-3 relative z-10">
            <span
              className={cn(
                "font-mono text-xs font-bold w-6",
                showAttention && "text-primary",
              )}
            >
              {name}
            </span>
            <span className="font-medium text-sm">{title}</span>
            {showAttention && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-sm bg-primary/15 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-primary">
                <Sparkles className="h-2.5 w-2.5" />
                NEXT
              </span>
            )}
          </div>
          <div className="relative z-10">
            {status === FeatureStatus.LOCKED && <Lock className="h-4 w-4" />}
            {status === FeatureStatus.AVAILABLE && (
              <Circle
                className={cn(
                  "h-4 w-4",
                  showAttention && "text-primary fill-primary/30",
                )}
              />
            )}
            {status === FeatureStatus.IN_PROGRESS && (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            )}
            {status === FeatureStatus.COMPLETE && (
              <CheckCircle2 className="h-4 w-4 text-primary" />
            )}
          </div>
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-80 p-0 overflow-hidden"
      >
        <div
          className={cn(
            "px-4 py-2 border-b flex items-center justify-between gap-2",
            showAttention ? "bg-primary/10" : "bg-muted/50",
          )}
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-primary">
              {name}
            </span>
            <span className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {title}
            </span>
          </div>
          {showAttention && (
            <span className="inline-flex items-center gap-1 rounded-sm bg-primary/20 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-primary">
              <Sparkles className="h-2.5 w-2.5" />
              NEXT
            </span>
          )}
          {status === FeatureStatus.COMPLETE && !showAttention && (
            <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider text-primary">
              <CheckCircle2 className="h-2.5 w-2.5" />
              DONE
            </span>
          )}
          {status === FeatureStatus.LOCKED && (
            <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
              <Lock className="h-2.5 w-2.5" />
              LOCKED
            </span>
          )}
        </div>
        <div className="px-4 py-3 space-y-2">
          <p className="text-xs font-medium text-foreground leading-snug">
            {description}
          </p>
          {explainer && (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {explainer}
            </p>
          )}
          {showAttention && (
            <p className="text-[10px] font-mono uppercase tracking-wider text-primary pt-1">
              → Click to run this stage
            </p>
          )}
          {isLocked && (
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground pt-1">
              Complete the previous stage to unlock
            </p>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
