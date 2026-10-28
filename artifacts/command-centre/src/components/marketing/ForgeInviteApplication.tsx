import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const FORGE_APPLICATION_EMAIL = "atanda.projects@gmail.com";

/** Applications are emailed for review; no automatic admission or entitlement. */
export function ForgeInviteApplication() {
  const [prepared, setPrepared] = useState(false);
  const emailConfigured = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(FORGE_APPLICATION_EMAIL) && !/\.(example|invalid|test|local)$/i.test(FORGE_APPLICATION_EMAIL);
  function prepareEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailConfigured) return;
    const data = new FormData(event.currentTarget);
    const body = [
      "FORGE FIELD ENGINEER — invitation application",
      ...[
        ["Full name", "name"], ["Email", "email"], ["Phone (optional)", "phone"],
        ["Country / time zone", "location"], ["Educational background", "education"],
        ["Relevant experience and learning goals", "goals"],
      ].map(([label, field]) => `${label}: ${String(data.get(field) ?? "").trim()}`),
      "",
      "I consent to ATANDA using these details to review my application and contact me about the programme.",
      "I understand admission requires an invitation. Lifetime Practitioner access requires course completion and issued FORGE FIELD ENGINEER Certification.",
    ].join("\n\n");
    window.location.href = `mailto:${FORGE_APPLICATION_EMAIL}?subject=${encodeURIComponent("FORGE FIELD ENGINEER — invitation application")}&body=${encodeURIComponent(body)}`;
    setPrepared(true);
  }
  const inputClass = "mt-1 w-full border border-input bg-background px-3 py-2 text-sm text-foreground";
  return <Dialog onOpenChange={() => setPrepared(false)}>
    <DialogTrigger asChild>
      <button type="button" className="inline-flex min-h-11 items-center justify-center border border-primary px-6 py-2 font-display text-lg uppercase tracking-wider text-primary hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" data-testid="button-forge-apply">Apply for invite</button>
    </DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Apply for a FORGE Field Engineer invite</DialogTitle>
        <DialogDescription>Share your contact details and educational background for review. Applying does not enrol you or guarantee an invitation.</DialogDescription>
      </DialogHeader>
      <form onSubmit={prepareEmail} className="space-y-4">
        <label className="block text-sm">Full name <span aria-hidden>*</span>
          <input className={inputClass} name="name" autoComplete="name" required maxLength={160} />
        </label>
        <label className="block text-sm">Email address <span aria-hidden>*</span>
          <input className={inputClass} name="email" type="email" autoComplete="email" required maxLength={254} />
        </label>
        <label className="block text-sm">Phone number (optional)
          <input className={inputClass} name="phone" type="tel" autoComplete="tel" maxLength={40} />
        </label>
        <label className="block text-sm">Country / time zone <span aria-hidden>*</span>
          <input className={inputClass} name="location" required maxLength={160} />
        </label>
        <label className="block text-sm">Educational background <span aria-hidden>*</span>
          <textarea className={inputClass} name="education" required minLength={10} maxLength={2000} rows={3} placeholder="Qualifications, subject areas, institutions or self-directed learning." />
        </label>
        <label className="block text-sm">Relevant experience and learning goals <span aria-hidden>*</span>
          <textarea className={inputClass} name="goals" required minLength={10} maxLength={2000} rows={3} />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" required className="mt-1" />
          <span>I consent to ATANDA using these details to review my application and contact me about the programme.</span>
        </label>
        <p className="text-xs text-muted-foreground">This opens your email app with an application addressed to {FORGE_APPLICATION_EMAIL}. Review and send it to complete your request. No details are submitted or saved by this form. Do not include identity documents or other sensitive records. Practitioner free for life is unlocked only after completing the course and receiving its certification.</p>
        {!emailConfigured && <p role="status" className="text-sm text-destructive">Applications cannot be sent yet: the programme’s application email address has not been configured.</p>}
        <button type="submit" disabled={!emailConfigured} className="inline-flex min-h-11 w-full items-center justify-center bg-primary px-4 py-2 font-display text-lg text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed" data-testid="button-forge-prepare-email">Prepare application email</button>
        {prepared && <p role="status" className="text-sm text-primary">Your application email is ready to open. It has not been submitted here—please send it from your email app. If no app opens, configure your device’s email handler and try again.</p>}
      </form>
    </DialogContent>
  </Dialog>;
}
