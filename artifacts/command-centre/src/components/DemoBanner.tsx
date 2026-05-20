import { Link } from "wouter";
import { DEMO_MODE } from "@/lib/demo-mode";

export function DemoBanner() {
  if (!DEMO_MODE) return null;
  return (
    <div
      role="status"
      data-testid="demo-banner"
      className="w-full bg-yellow-500/15 border-b border-yellow-500/40 text-yellow-200"
    >
      <div className="container px-4 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs sm:text-sm font-mono">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
          <span className="uppercase tracking-wider font-bold">
            Investor Preview
          </span>
          <span className="opacity-80">
            — sample data, no live billing, no real accounts
          </span>
        </div>
        <Link
          href="/demo"
          className="underline underline-offset-4 hover:text-yellow-100"
        >
          Take the 7-stage tour →
        </Link>
      </div>
    </div>
  );
}
