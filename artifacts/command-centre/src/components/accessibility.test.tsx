// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import type { VerifyResult } from "@workspace/api-client-react";

const state = vi.hoisted(() => ({
  login: { mutate: vi.fn(), isPending: false, error: null as Error | null },
  create: { mutate: vi.fn(), isPending: false },
  verification: {
    data: undefined as VerifyResult | undefined,
    isLoading: false, isFetching: false, isError: false,
    error: null as Error | { status: number } | null,
    refetch: vi.fn(),
  },
}));
vi.mock("@/lib/staff-session", () => ({ useLogin: () => state.login }));
vi.mock("@/components/layout/ThemeToggle", () => ({ ThemeToggle: () => <button>Theme</button> }));
vi.mock("@/components/layout/TopNav", () => ({ TopNav: () => null }));
vi.mock("@/components/layout/Footer", () => ({ Footer: () => null }));
vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
  Link: (props: ComponentProps<"a">) => <a {...props} />,
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...await importOriginal<typeof import("@workspace/api-client-react")>(),
  useCreateLearningCohort: () => state.create,
  useVerifyCertificate: () => state.verification,
  getVerifyCertificateQueryKey: () => ["verify"],
}));

import { AccessGate } from "./AccessGate";
import { CreateCohortForm } from "./learning/CreateCohortForm";
import Verify from "@/pages/verify";

afterEach(() => {
  cleanup();
  state.login.error = null;
  state.login.isPending = false;
  state.create.isPending = false;
  state.verification.isLoading = false;
  state.verification.isFetching = false;
  state.verification.isError = false;
  state.verification.error = null;
  state.verification.data = undefined;
  window.history.replaceState({}, "", "/");
  vi.clearAllMocks();
});

describe("staff entry accessibility", () => {
  it("exposes a main landmark, named form and required labeled fields", () => {
    render(<AccessGate />);
    expect(screen.getByRole("main")).toBeTruthy();
    const form = screen.getByRole("form", { name: "Staff sign-in" });
    expect(document.getElementById(form.getAttribute("aria-describedby")!)?.textContent).toContain("team access code");
    expect((screen.getByLabelText("Your name or initials") as HTMLInputElement).required).toBe(true);
    expect((screen.getByLabelText("Access code") as HTMLInputElement).required).toBe(true);
  });

  it("announces login errors and associates them with the access code", () => {
    state.login.error = new Error("Request failed");
    render(<AccessGate />);
    const code = screen.getByLabelText("Access code");
    const alert = screen.getByRole("alert");
    expect(code.getAttribute("aria-invalid")).toBe("true");
    expect(code.getAttribute("aria-describedby")).toBe(alert.id);
    expect(alert.textContent).toContain("Something went wrong");
  });

  it("preserves trimmed login payloads and exposes the pending state", () => {
    const { rerender } = render(<AccessGate />);
    fireEvent.change(screen.getByLabelText("Your name or initials"), { target: { value: " Operator " } });
    fireEvent.change(screen.getByLabelText("Access code"), { target: { value: " example-code " } });
    fireEvent.submit(screen.getByRole("form", { name: "Staff sign-in" }));
    expect(state.login.mutate).toHaveBeenCalledWith({ name: "Operator", code: "example-code" });
    state.login.isPending = true;
    rerender(<AccessGate />);
    expect(screen.getByRole("form").getAttribute("aria-busy")).toBe("true");
    expect((screen.getByRole("button", { name: "AUTHENTICATING…" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("cohort form accessibility and mobile layout", () => {
  it("names the form and associates its existing validation guidance", () => {
    render(<CreateCohortForm />);
    const form = screen.getByRole("form", { name: "Create cohort draft" });
    expect(form.getAttribute("aria-describedby")).toBe(screen.getByTestId("text-create-invalid").id);
    expect(screen.getByLabelText("Ends").parentElement?.parentElement?.className).toContain("grid-cols-1 sm:grid-cols-2");
    expect((screen.getByRole("button", { name: "Create draft" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("announces a pending cohort creation without changing draft eligibility", () => {
    state.create.isPending = true;
    render(<CreateCohortForm />);
    expect(screen.getByRole("form").getAttribute("aria-busy")).toBe("true");
  });
});

describe("certificate search accessibility", () => {
  it.each([new Error("Network failed"), { status: 500 }, { status: 429 }, { status: 403 }])(
    "does not present registry failures as an invalid certificate: %o",
    (error) => {
      window.history.replaceState({}, "", "/verify?cert=example-id");
      state.verification.isError = true;
      state.verification.error = error;
      render(<Verify />);
      expect(screen.getByRole("heading", { name: "VERIFICATION UNAVAILABLE" })).toBeTruthy();
      expect(screen.queryByRole("heading", { name: "NOT FOUND" })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Retry verification" }));
      expect(state.verification.refetch).toHaveBeenCalledOnce();
    },
  );

  it("shows not found only for a registry 404 without exposing a retry error", () => {
    window.history.replaceState({}, "", "/verify?cert=missing");
    state.verification.isError = true;
    state.verification.error = { status: 404 };
    render(<Verify />);
    expect(screen.getByRole("heading", { name: "NOT FOUND" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry verification" })).toBeNull();
  });

  it("supports an explicit invalid registry response", () => {
    window.history.replaceState({}, "", "/verify?cert=missing");
    state.verification.data = { valid: false } as VerifyResult;
    render(<Verify />);
    expect(screen.getByRole("heading", { name: "NOT FOUND" })).toBeTruthy();
  });

  it("rechecks the current certificate when the search form is submitted again", () => {
    window.history.replaceState({}, "", "/verify?cert=example-id");
    render(<Verify />);
    fireEvent.submit(screen.getByRole("form", { name: "Verify certificate" }));
    expect(state.verification.refetch).toHaveBeenCalledOnce();
    expect(window.location.search).toBe("?cert=example-id");
  });

  it("announces a retry in progress instead of showing a stale failure", () => {
    window.history.replaceState({}, "", "/verify?cert=example-id");
    state.verification.isError = true;
    state.verification.error = { status: 500 };
    state.verification.isFetching = true;
    render(<Verify />);
    expect(screen.getByRole("form").getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByRole("button", { name: "Retry verification" })).toBeNull();
    expect((screen.getByRole("button", { name: "VERIFYING..." }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows a successful certificate after retry and removes the failure", () => {
    window.history.replaceState({}, "", "/verify?cert=example-id");
    state.verification.isError = true;
    state.verification.error = { status: 500 };
    const { rerender } = render(<Verify />);
    state.verification.isError = false;
    state.verification.error = null;
    state.verification.data = { valid: true, certId: "example-id" } as VerifyResult;
    rerender(<Verify />);
    expect(screen.getByRole("heading", { name: "VERIFIED AUTHENTIC" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "VERIFICATION UNAVAILABLE" })).toBeNull();
  });

  it("provides a named search form with a required certificate field", () => {
    render(<Verify />);
    const form = screen.getByRole("form", { name: "Verify certificate" });
    expect(form.className).toContain("flex-col sm:flex-row");
    expect((screen.getByLabelText("Certificate ID") as HTMLInputElement).required).toBe(true);
  });

  it("announces pending verification in a named live results region", () => {
    window.history.replaceState({}, "", "/verify?cert=example-id");
    state.verification.isLoading = true;
    render(<Verify />);
    const results = screen.getByRole("region", { name: "Certificate verification result" });
    expect(results.getAttribute("aria-live")).toBe("polite");
    expect(results.textContent).toContain("QUERYING VERIFICATION MATRIX");
    expect(screen.getByRole("form").getAttribute("aria-busy")).toBe("true");
  });
});
