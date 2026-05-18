import { ReactNode } from "react";
import { AlertCircle, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";

export function WorkspaceShell({
  toolbar,
  children,
}: {
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0">
      {toolbar && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {toolbar}
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-auto">{children}</div>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  hint,
  icon,
}: {
  title: string;
  body: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <Card className="p-10 bg-card/30 border-border/50 flex flex-col items-center justify-center text-center">
      <div className="text-muted-foreground/40 mb-4">{icon ?? <Lock className="h-12 w-12" />}</div>
      <h3 className="font-display text-2xl tracking-wider mb-2">{title}</h3>
      <p className="font-mono text-sm text-muted-foreground max-w-md mb-3">{body}</p>
      {hint && (
        <p className="font-mono text-xs text-primary/80 max-w-md uppercase tracking-wider">
          {hint}
        </p>
      )}
    </Card>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-md border border-destructive/30 bg-destructive/10 text-destructive font-mono text-xs">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export const PILLAR_LABELS = [
  "SYSTEM",
  "ROLE",
  "INSTRUCTION",
  "EXAMPLE",
  "CONSTRAINT",
  "FORMAT",
  "DATA",
] as const;
