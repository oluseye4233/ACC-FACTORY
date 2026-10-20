// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const state = vi.hoisted(() => ({
  pathname: "/command",
  search: "",
  student: false,
  authenticated: true,
  navigate: vi.fn(),
}));
vi.mock("wouter", () => ({
  useLocation: () => [state.pathname, state.navigate],
  useSearch: () => state.search,
  Link: ({ href, children, onClick, ...props }: ComponentProps<"a">) => (
    <a {...props} href={href} onClick={event => { event.preventDefault(); onClick?.(event); }}>{children}</a>
  ),
}));
vi.mock("@/lib/staff-session", () => ({
  useStaffSession: () => ({ authenticated: state.authenticated, role: "ADMIN", student: state.student }),
  useLogout: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/components/learning-auth", () => ({ StudentSignOut: () => <button>Student sign out</button> }));
vi.mock("./ThemeToggle", () => ({ ThemeToggle: () => <button>Theme</button> }));
vi.mock("./CompanySpendMeter", () => ({
  CompanySpendMeter: () => <span data-testid="company-spend-meter" />,
  CompanySpendBanner: () => <span data-testid="company-spend-banner" />,
}));

import { TopNav } from "./TopNav";

afterEach(() => {
  cleanup();
  state.pathname = "/command";
  state.search = "";
  state.student = false;
  state.authenticated = true;
  vi.clearAllMocks();
});

describe("keyboard and current-page navigation", () => {
  it("offers skip navigation first and focuses the main landmark on Enter", async () => {
    const user = userEvent.setup();
    render(<><TopNav /><main><h1>Dashboard</h1></main></>);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Skip to main content" }));
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("main"));
    expect(screen.getByRole("main").tabIndex).toBe(-1);
  });

  it("marks exactly the correct operations view as current", () => {
    state.pathname = "/operations";
    state.search = "kind=short-sprints";
    render(<TopNav />);
    const navigation = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(navigation).getByRole("link", { name: "Short Sprints" }).getAttribute("aria-current")).toBe("page");
    expect(within(navigation).getByRole("link", { name: "IMPRIMA" }).hasAttribute("aria-current")).toBe(false);
  });

  it("uses real links and marks the current destination in the mobile menu", async () => {
    state.pathname = "/quests";
    render(<TopNav />);
    fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    const mobile = screen.getByRole("navigation", { name: "Mobile navigation" });
    expect(within(mobile).getByRole("link", { name: "Quests" }).getAttribute("aria-current")).toBe("page");
    const guide = within(mobile).getByRole("link", { name: "Guide" });
    expect(guide.getAttribute("href")).toBe("/guide");
    fireEvent.click(guide);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("preserves student navigation restrictions", () => {
    state.student = true;
    render(<TopNav />);
    const navigation = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(navigation).queryByRole("link", { name: "IMPRIMA" })).toBeNull();
    expect(within(navigation).queryByRole("link", { name: "Admin" })).toBeNull();
    expect(within(navigation).getByRole("link", { name: "Training" })).toBeTruthy();
    expect(screen.queryByTestId("company-spend-meter")).toBeNull();
    expect(screen.queryByTestId("company-spend-banner")).toBeNull();
  });

  it("does not mount staff spend queries or logout controls for public visitors", () => {
    state.authenticated = false;
    state.pathname = "/verify";
    render(<TopNav />);
    expect(screen.queryByTestId("company-spend-meter")).toBeNull();
    expect(screen.queryByTestId("company-spend-banner")).toBeNull();
    expect(screen.queryByRole("button", { name: "LOG OUT" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Student sign out" })).toBeNull();
    expect(screen.getByRole("link", { name: "Staff sign-in" }).getAttribute("href")).toBe("/");
    const navigation = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(navigation).getByRole("link", { name: "Verify a certificate" }).getAttribute("aria-current")).toBe("page");
    expect(within(navigation).queryByRole("link", { name: "Costs" })).toBeNull();
    expect(within(navigation).queryByRole("link", { name: "Admin" })).toBeNull();
  });

  it("retains company spend views and logout for authenticated staff", () => {
    render(<TopNav />);
    expect(screen.getByTestId("company-spend-meter")).toBeTruthy();
    expect(screen.getByTestId("company-spend-banner")).toBeTruthy();
    expect(screen.getByRole("button", { name: "LOG OUT" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Staff sign-in" })).toBeNull();
  });
});
