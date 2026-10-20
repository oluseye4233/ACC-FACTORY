// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const verify = vi.hoisted(() => vi.fn());
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...await importOriginal<typeof import("@workspace/api-client-react")>(),
  useVerifyCertificate: verify,
}));
vi.mock("@/components/layout/TopNav", () => ({ TopNav: () => null }));
vi.mock("@/components/layout/Footer", () => ({ Footer: () => null }));

import Verify from "./verify";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  vi.resetAllMocks();
});

function setup(url = "/verify?cert=first") {
  window.history.replaceState(null, "", url);
  verify.mockReturnValue({
    isLoading: false, isFetching: false, isError: true,
    error: { status: 404 }, data: undefined, refetch: vi.fn(),
  });
  return render(<Verify />);
}

function expectCurrent(cert: string) {
  expect((screen.getByLabelText("Certificate ID") as HTMLInputElement).value).toBe(cert);
  expect(verify.mock.lastCall?.[0]).toEqual({ cert });
  expect(verify.mock.lastCall?.[1].query.enabled).toBe(Boolean(cert));
}

describe("certificate URL navigation with the real router subscription", () => {
  it("loads a direct certificate URL and submits a new encoded ID without losing other URL parts", () => {
    setup("/verify?cert=first&source=invite#details");
    expectCurrent("first");
    fireEvent.change(screen.getByLabelText("Certificate ID"), { target: { value: " second / + & " } });
    fireEvent.submit(screen.getByRole("form", { name: "Verify certificate" }));
    expectCurrent("second / + &");
    const url = new URL(window.location.href);
    expect(url.searchParams.get("cert")).toBe("second / + &");
    expect(url.searchParams.get("source")).toBe("invite");
    expect(url.pathname).toBe("/verify");
    expect(url.hash).toBe("#details");
  });

  it("restores certificate input and query on actual browser Back and Forward", async () => {
    setup();
    fireEvent.change(screen.getByLabelText("Certificate ID"), { target: { value: "second" } });
    fireEvent.submit(screen.getByRole("form", { name: "Verify certificate" }));
    expectCurrent("second");
    act(() => window.history.back());
    await waitFor(() => expectCurrent("first"));
    act(() => window.history.forward());
    await waitFor(() => expectCurrent("second"));
  });

  it("clears the form and result and disables the request when navigation removes cert", () => {
    setup();
    act(() => window.history.pushState(null, "", "/verify"));
    expectCurrent("");
    expect(screen.queryByRole("region", { name: "Certificate verification result" })).toBeNull();
    expect((screen.getByRole("button", { name: "VERIFY" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("responds to query replacement while keeping unsent edits local", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Certificate ID"), { target: { value: "not-submitted" } });
    expect(verify.mock.lastCall?.[0]).toEqual({ cert: "first" });
    act(() => window.history.replaceState(null, "", "/verify?cert=replaced"));
    expectCurrent("replaced");
  });
});
