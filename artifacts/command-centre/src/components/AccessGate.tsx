import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { useLogin } from "@/lib/staff-session";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/**
 * Internal-staff front door: one shared access code plus a typed name. The name
 * is attribution only (it tags the staff member's sessions and activity); the
 * code is the sole credential.
 */
export function AccessGate() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const login = useLogin();

  const errorMessage =
    login.error instanceof ApiError
      ? login.error.message
      : login.error
        ? "Something went wrong. Try again."
        : null;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;
    login.mutate({ code: code.trim(), name: name.trim() });
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-6">
      <div className="w-[440px] max-w-full rounded-2xl border border-border bg-card p-5 sm:p-8 text-card-foreground shadow-lg">
        <div className="mb-6 flex items-center justify-between">
          <span aria-hidden="true" />
          <ThemeToggle />
        </div>
        <div className="mb-6 flex justify-center">
          <img
            src={`${import.meta.env.BASE_URL}atanda-logo.png`}
            alt="ATANDA"
            className="h-16 w-auto"
          />
        </div>
        <h1 className="text-center font-display text-2xl tracking-wider text-foreground">
          STAFF ACCESS
        </h1>
        <p id="staff-access-help" className="mt-1 text-center font-mono text-sm text-muted-foreground">
          Enter the team access code to open the HARNESS
        </p>

        <form onSubmit={onSubmit} aria-label="Staff sign-in" aria-describedby="staff-access-help" aria-busy={login.isPending} className="mt-8 space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="staff-name"
              className="block text-xs font-mono font-bold uppercase text-foreground"
            >
              Your name or initials
            </label>
            <input
              id="staff-name"
              type="text"
              name="staff-name"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. A. Tanda"
              className="w-full rounded border border-input bg-background px-3 py-2 font-mono text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="input-staff-name"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="staff-code"
              className="block text-xs font-mono font-bold uppercase text-foreground"
            >
              Access code
            </label>
            <input
              id="staff-code"
              type="password"
              name="staff-code"
              required
              aria-describedby={errorMessage ? "staff-access-error" : undefined}
              aria-invalid={errorMessage ? true : undefined}
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded border border-input bg-background px-3 py-2 font-mono text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="input-staff-code"
            />
          </div>

          {errorMessage ? (
            <p
              id="staff-access-error"
              role="alert"
              className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              data-testid="text-login-error"
            >
              {errorMessage}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={login.isPending || !code.trim() || !name.trim()}
            className="h-12 w-full bg-[#1A6B3A] font-display text-lg tracking-wider text-white hover:bg-[#1A6B3A]/90"
            data-testid="button-staff-login"
          >
            {login.isPending ? "AUTHENTICATING…" : "ENTER"}
          </Button>
        </form>

        <p className="mt-6 text-center">
            <Link href="/learn-login" className="block mb-4 text-sm text-primary underline" data-testid="link-student-login">FORGE FIELD ENGINEER · Student sign-in</Link>
            <Link href="/status" className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" data-testid="link-service-status">
            Service status
          </Link>
        </p>

        <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Internal tool · {basePath || "/"}
        </p>
      </div>
    </main>
  );
}
