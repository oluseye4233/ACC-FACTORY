import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

interface EscalationModalProps {
  sessionId: string;
}

export function EscalationModal({ sessionId }: EscalationModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive h-8 px-2 md:px-3">
          <ShieldAlert className="h-4 w-4" />
          <span className="font-mono text-[10px] md:text-xs">
          <span className="hidden sm:inline">ESCALATIONS </span>(0)
        </span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display tracking-wider text-destructive">SYSTEM ESCALATIONS</DialogTitle>
          <DialogDescription>
            Active escalations requiring operator intervention.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-8 flex flex-col items-center justify-center text-center text-muted-foreground">
          <ShieldAlert className="h-12 w-12 mb-4 opacity-20" />
          <p className="font-mono text-sm">NO ACTIVE ESCALATIONS</p>
          <p className="text-xs mt-2">System operating within nominal parameters.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
