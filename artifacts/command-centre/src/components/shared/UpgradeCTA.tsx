import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLocation } from "wouter";

interface UpgradeCTAProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message?: string;
}

export function UpgradeCTA({ open, onOpenChange, message = "This feature requires a higher tier." }: UpgradeCTAProps) {
  const [, setLocation] = useLocation();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-secondary/20 bg-background/95 backdrop-blur">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-2xl tracking-wider text-secondary">AUTHORIZATION REQUIRED</AlertDialogTitle>
          <AlertDialogDescription className="text-foreground">
            {message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="font-mono">CANCEL</AlertDialogCancel>
          <AlertDialogAction 
            onClick={() => setLocation("/pricing")}
            className="font-display tracking-wider bg-secondary text-secondary-foreground hover:bg-secondary/90"
          >
            UPGRADE ACCESS
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
