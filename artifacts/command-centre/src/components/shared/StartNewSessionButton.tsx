import { Link } from "wouter";
import { ChevronDown, FileUp, Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const entryOptions = [
  { href: "/session/new", label: "NEW SESSION", description: "Start with a fresh idea", icon: Plus },
  { href: "/ingest", label: "INGESTION", description: "Start from an existing document", icon: FileUp },
  { href: "/cartridge", label: "CARTRIDGE", description: "Build a session from a cartridge", icon: Package },
];

export function StartNewSessionButton() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="font-display tracking-wider gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" aria-hidden="true" />
          START NEW SESSION
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-2rem)]">
        {entryOptions.map(({ href, label, description, icon: Icon }) => (
          <DropdownMenuItem key={href} asChild>
            <Link href={href} className="flex items-center gap-3 py-3">
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="block font-display tracking-wider">{label}</span>
                <span className="block text-xs text-muted-foreground">{description}</span>
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
