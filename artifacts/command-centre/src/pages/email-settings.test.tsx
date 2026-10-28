// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

vi.mock("@/components/layout/TopNav", () => ({ TopNav: () => null }));
const m = vi.hoisted(() => ({ data: null as unknown, params: [] as unknown[], save: vi.fn(), test: vi.fn(), verify: vi.fn() }));
vi.mock("@workspace/api-client-react", () => ({
  getGetEmailDeliverySettingsQueryKey: (p?: unknown) => ["email", p ?? null],
  getGetImprimaPortalQueryKey: () => ["portal"],
  useGetEmailDeliverySettings: (p?: unknown) => { m.params.push(p); return { data: m.data, isLoading: false, isError: false, refetch: vi.fn() }; },
  useSaveEmailDeliverySettings: () => ({ mutateAsync: m.save, isPending: false }),
  useTestEmailDeliverySettings: () => ({ mutateAsync: m.test, isPending: false }),
  useVerifyEmailDeliverySettings: () => ({ mutateAsync: m.verify, isPending: false }),
}));
import EmailSettings, { buildEmailInput } from "./email-settings";

const base = { organizationId: null, mode: "MANAGED", provider: null, senderName: null, fromEmail: null, replyTo: null, status: "ACTIVE", configured: true, canManage: true, hasCredential: false, verificationExpiresAt: null, authenticationSeparate: true };
function renderAt(path: string) {
  const { hook, searchHook } = memoryLocation({ path });
  return render(<QueryClientProvider client={new QueryClient()}><Router hook={hook} searchHook={searchHook}><EmailSettings /></Router></QueryClientProvider>);
}
const btn = (id: string) => screen.getByTestId(id) as HTMLButtonElement;

beforeEach(() => { vi.clearAllMocks(); m.data = { ...base }; m.params = []; });
afterEach(cleanup);

describe("email settings", () => {
  it("omits blank optional fields so the server clears them", () => {
    expect(buildEmailInput({ mode: "MANAGED", provider: "", senderName: " ", fromEmail: "", replyTo: "", credential: "" }, null)).toEqual({ mode: "MANAGED" });
    expect(buildEmailInput({ mode: "OWN_PROVIDER", provider: "RESEND", senderName: "Ark", fromEmail: "a@b.co", replyTo: "", credential: "" }, "org-1"))
      .toEqual({ mode: "OWN_PROVIDER", organizationId: "org-1", provider: "RESEND", fromEmail: "a@b.co", senderName: "Ark" });
  });

  it("saves managed mode with branding and states auth is separate", async () => {
    m.save.mockResolvedValue({ ...base, senderName: "Ark" });
    renderAt("/email-settings");
    expect(screen.getByTestId("text-auth-separate").textContent).toContain("not changed");
    expect(screen.getByTestId("link-email-back").getAttribute("href")).toBe("/account");
    fireEvent.change(screen.getByTestId("input-sender-name"), { target: { value: "Ark" } });
    fireEvent.click(btn("button-save-email"));
    await waitFor(() => expect(m.save).toHaveBeenCalledWith({ data: { mode: "MANAGED", senderName: "Ark" } }));
  });

  it("own provider requires provider, sender and key, then clears the key after save", async () => {
    m.save.mockResolvedValue({ ...base, mode: "OWN_PROVIDER", provider: "POSTMARK", fromEmail: "n@x.io", hasCredential: true, status: "PENDING_VERIFICATION", configured: false });
    renderAt("/email-settings");
    fireEvent.click(screen.getByTestId("radio-mode-OWN_PROVIDER"));
    expect(btn("button-save-email").disabled).toBe(true);
    fireEvent.change(screen.getByTestId("select-email-provider"), { target: { value: "POSTMARK" } });
    expect(screen.getByTestId("help-POSTMARK").textContent).toContain("Sender Signature");
    fireEvent.change(screen.getByTestId("input-from-email"), { target: { value: "n@x.io" } });
    expect(btn("button-save-email").disabled).toBe(true);
    fireEvent.change(screen.getByTestId("input-credential"), { target: { value: "secret-token" } });
    fireEvent.click(btn("button-save-email"));
    await waitFor(() => expect(m.save).toHaveBeenCalledWith({ data: { mode: "OWN_PROVIDER", provider: "POSTMARK", fromEmail: "n@x.io", credential: "secret-token" } }));
    await waitFor(() => expect((screen.getByTestId("input-credential") as HTMLInputElement).value).toBe(""));
    expect(document.body.innerHTML).not.toContain("secret-token");
    expect(window.location.href).not.toContain("secret");
  });

  it("blank key retains the stored credential for the same provider but not after a provider change", () => {
    m.data = { ...base, mode: "OWN_PROVIDER", provider: "RESEND", fromEmail: "a@b.co", hasCredential: true };
    renderAt("/email-settings");
    fireEvent.change(screen.getByTestId("input-sender-name"), { target: { value: "Ark" } });
    expect(btn("button-save-email").disabled).toBe(false);
    fireEvent.change(screen.getByTestId("select-email-provider"), { target: { value: "POSTMARK" } });
    expect(btn("button-save-email").disabled).toBe(true);
    expect(screen.getByTestId("list-email-errors").textContent).toContain("provider changed");
  });

  it("org members without manage rights see read-only settings with org scope", () => {
    m.data = { ...base, organizationId: "org-9", canManage: false };
    renderAt("/email-settings?organizationId=org-9");
    expect(m.params[0]).toEqual({ organizationId: "org-9" });
    expect(screen.getByTestId("link-email-back").getAttribute("href")).toBe("/orgs/org-9");
    expect(screen.getByTestId("badge-readonly")).toBeTruthy();
    expect((screen.getByTestId("form-email-delivery") as HTMLFieldSetElement).disabled).toBe(true);
    expect(screen.queryByTestId("button-save-email")).toBeNull();
    expect(screen.queryByTestId("button-test-email")).toBeNull();
  });

  it("BYO test requires a six-digit inbox code before activation", async () => {
    m.data = { ...base, mode: "OWN_PROVIDER", provider: "RESEND", fromEmail: "a@b.co", hasCredential: true, status: "PENDING_VERIFICATION", configured: false };
    m.test.mockResolvedValue({ message: "Test sent to your account email.", expiresAt: "2026-01-01T00:10:00Z" });
    m.verify.mockResolvedValue({ ...base });
    renderAt("/email-settings");
    expect(screen.getByTestId("status-email-delivery").textContent).toBe("Pending verification");
    fireEvent.click(btn("button-test-email"));
    await waitFor(() => expect(m.test).toHaveBeenCalledWith({ data: {} }));
    fireEvent.change(await screen.findByTestId("input-verify-code"), { target: { value: "12ab34" } });
    expect(btn("button-verify-email").disabled).toBe(true);
    fireEvent.change(screen.getByTestId("input-verify-code"), { target: { value: "123456" } });
    fireEvent.click(btn("button-verify-email"));
    await waitFor(() => expect(m.verify).toHaveBeenCalledWith({ data: { code: "123456" } }));
    expect(m.test).toHaveBeenCalledTimes(1);
  });

  it("managed test needs no code", async () => {
    m.test.mockResolvedValue({ message: "The email provider accepted the test.", expiresAt: null });
    renderAt("/email-settings");
    fireEvent.click(btn("button-test-email"));
    expect((await screen.findByTestId("text-email-msg")).textContent).toContain("accepted");
    expect(screen.queryByTestId("panel-verify-code")).toBeNull();
  });

  it("shows unconfigured clearly", () => {
    m.data = { ...base, status: "UNCONFIGURED", configured: false };
    renderAt("/email-settings");
    expect(screen.getByTestId("text-email-status-note").textContent).toContain("cannot be emailed");
  });
});
