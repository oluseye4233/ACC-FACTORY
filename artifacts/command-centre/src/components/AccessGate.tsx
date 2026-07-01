import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { useLogin } from "@/lib/staff-session";

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
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="w-[440px] max-w-full rounded-2xl border border-[#262626] bg-[#121212] p-8">
        <div className="mb-6 flex justify-center">
          <img
            src={`${import.meta.env.BASE_URL}atanda-logo.png`}
            alt="ATANDA"
            className="h-16 w-auto"
          />
        </div>
        <h1 className="text-center font-display text-2xl tracking-wider text-[#f2f2f2]">
          STAFF ACCESS
        </h1>
        <p className="mt-1 text-center font-mono text-sm text-[#999999]">
          Enter the team access code to open the HARNESS
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="staff-name"
              className="block text-xs font-mono font-bold uppercase text-[#f2f2f2]"
            >
              Your name or initials
            </label>
            <input
              id="staff-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. A. Tanda"
              className="w-full rounded border border-[#262626] bg-[#0D0D0D] px-3 py-2 font-mono text-[#f2f2f2] outline-none focus:border-[#1A6B3A]"
              data-testid="input-staff-name"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="staff-code"
              className="block text-xs font-mono font-bold uppercase text-[#f2f2f2]"
            >
              Access code
            </label>
            <input
              id="staff-code"
              type="password"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded border border-[#262626] bg-[#0D0D0D] px-3 py-2 font-mono text-[#f2f2f2] outline-none focus:border-[#1A6B3A]"
              data-testid="input-staff-code"
            />
          </div>

          {errorMessage ? (
            <p
              className="rounded border border-[#DF1A12]/20 bg-[#DF1A12]/10 px-3 py-2 text-sm text-[#DF1A12]"
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

        <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-[#666666]">
          Internal tool · {basePath || "/"}
        </p>
      </div>
    </div>
  );
}
