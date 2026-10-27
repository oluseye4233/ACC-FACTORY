// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "next-themes";

const mutate = vi.fn();
vi.mock("@workspace/api-client-react", () => ({
  useBillingCheckout: () => ({ mutate, isPending: false }),
  SubscriberTier: { PRACTITIONER: "PRACTITIONER", ARCHITECT: "ARCHITECT" },
  CheckoutInputInterval: { month: "month", year: "year" },
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import Pricing from "./pricing";
import Landing from "./landing";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }),
});

const wrap = (ui: React.ReactNode) => render(<ThemeProvider attribute="class">{ui}</ThemeProvider>);
afterEach(cleanup);

describe("public pricing", () => {
  it("shows original monthly and yearly prices", () => {
    wrap(<Pricing />);
    expect(screen.getByTestId("text-price-practitioner").textContent).toContain("$49");
    expect(screen.getByTestId("text-price-architect").textContent).toContain("$199");
    expect(screen.getByTestId("text-price-institution").textContent).toContain("Custom");
    fireEvent.click(screen.getByTestId("button-interval-yearly"));
    expect(screen.getByTestId("text-price-practitioner").textContent).toContain("$470");
    expect(screen.getByTestId("text-price-architect").textContent).toContain("$1910");
  });

  it("uses request-access mailto and never dispatches checkout while billing is off", () => {
    wrap(<Pricing />);
    for (const id of ["practitioner", "architect", "institution"]) {
      expect(screen.getByTestId(`link-request-${id}`).getAttribute("href")).toMatch(/^mailto:/);
    }
    fireEvent.click(screen.getByTestId("link-request-practitioner"));
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByTestId("link-plan-explorer").getAttribute("href")).toContain("/command");
  });

  it("marks FORGE as free invite-only and avoids invented claims", () => {
    wrap(<Pricing />);
    expect(screen.getByTestId("status-forge").textContent).toMatch(/free \/ invite-only/i);
    expect(screen.getByTestId("link-forge-register").getAttribute("href")).toContain("/learn-register");
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/SOC2|end-to-end encryption|free trial|on-prem|SLA|unlimited/i);
  });
});

describe("landing", () => {
  it("leads with the subscriber story and retains the governed factory identity", () => {
    wrap(<Landing />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Your idea matters. Build it with a clearer way forward.",
    );
    expect(screen.getByText("WELCOME TO OUR GOVERNED SPECIFICATION DRIVEN AI DESIGN LIFE CYCLE FACTORY (GS AI DLC)")).toBeTruthy();
    expect(screen.getByLabelText("ATANDA home")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Koncentric Labs/i);
    expect([...document.querySelectorAll("[data-snap]")].map(section => section.getAttribute("data-snap"))).toEqual(["story", "need", "answer", "proof"]);
    expect(screen.getByTestId("link-landing-proof").getAttribute("href")).toContain("/guide");
    expect(screen.getByTestId("link-landing-plans").getAttribute("href")).toContain("/pricing");
  });
  it.each(["how", "workflow"])("scrolls to #%s after a cross-page lazy mount", (section) => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
    const scroll = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: scroll, configurable: true });
    window.history.replaceState({}, "", `/#${section}`);
    try {
      wrap(<Landing />);
      expect(scroll).toHaveBeenCalledWith({ block: "start", behavior: "instant" });
      expect(scroll.mock.instances[0]).toBe(document.getElementById(section));
    } finally {
      if (descriptor) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", descriptor);
      else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
      window.history.replaceState({}, "", "/");
    }
  });

  it("restores public content with gated workspace links", () => {
    wrap(<Landing />);
    const text = document.body.textContent ?? "";
    for (const s of ["New Session", "Ingestion", "Cartridge + Exemplar", "Boomerang", "IMPRIMA Internal", "SHORT SPRINT Internal", "Sphinx", "not independent certification"]) {
      expect(text).toContain(s);
    }
    expect(screen.getByTestId("link-hero-command").getAttribute("href")).toContain("/command");
    expect(screen.getByTestId("link-hero-pricing").getAttribute("href")).toContain("/pricing");
    expect(document.title).toContain("ATANDA");
    expect(document.querySelector("meta[property=\"og:title\"]")?.getAttribute("content")).toContain("ARK Harness");
    fireEvent.click(screen.getByTestId("button-mobile-nav"));
    expect(screen.getByTestId("link-mobile-command").textContent).toBe("Staff access");
    expect(screen.getByTestId("link-mobile-forge")).toBeTruthy();
  });
});
