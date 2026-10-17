import { Link } from "wouter";
import { LaunchReadinessPanel } from "@/components/status/LaunchReadinessPanel";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default function Status() {
  return (
    <div className="flex min-h-[100dvh] justify-center bg-background px-4 py-10">
      <main className="w-[560px] max-w-full space-y-6">
        <div>
          <div className="mb-5 flex justify-end">
            <ThemeToggle />
          </div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-primary">ATANDA · PUBLIC STATUS</p>
          <h1 className="mt-2 font-display text-3xl tracking-wider">SERVICE DEPENDENCIES</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Database reachability and AI configuration for this running instance of the Command Centre. No sign-in required.
          </p>
        </div>
        <section className="rounded-2xl border border-border bg-card p-6">
          <LaunchReadinessPanel />
        </section>
        <Link href="/" className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary hover:underline">
          Back to Command Centre
        </Link>
      </main>
    </div>
  );
}
