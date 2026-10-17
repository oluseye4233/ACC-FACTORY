/**
 * Public identity-entry URLs must also work with an existing staff or student
 * session. Forward only the invitation, not arbitrary redirect parameters.
 */
export function authenticatedLearningEntry(
  pathname: string,
  search: string,
  authenticated: boolean,
): string | null {
  if (!authenticated) return null;
  const isEntry = ["/learn-login", "/learn-register"].some(
    (entry) => pathname === entry || pathname.startsWith(`${entry}/`),
  );
  if (!isEntry) return null;
  const invite = new URLSearchParams(search).get("invite");
  return invite ? `/learn?${new URLSearchParams({ invite })}` : "/learn";
}
