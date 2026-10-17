import { describe, expect, it } from "vitest";
import { authenticatedLearningEntry } from "./learning-entry";

describe("authenticated learning entry", () => {
  for (const session of ["staff", "student"]) {
    it.each(["/learn-register", "/learn-login", "/learn-register/verify-email-address", "/learn-login/factor-one"])(
      `routes a signed-in ${session} from %s to Training rather than 404`,
      (pathname) => expect(authenticatedLearningEntry(pathname, "", true)).toBe("/learn"),
    );
  }
  it("preserves the invitation without accepting an external redirect", () => {
    expect(authenticatedLearningEntry("/learn-register", "?invite=abc%2B123&redirect_url=https://example.com", true))
      .toBe("/learn?invite=abc%2B123");
  });
  it("leaves signed-out registration to the identity provider", () => {
    expect(authenticatedLearningEntry("/learn-register", "?invite=abc", false)).toBeNull();
  });
  it.each(["/learn", "/command", "/learn-register-other"])("does not redirect unrelated page %s", (pathname) => {
    expect(authenticatedLearningEntry(pathname, "", true)).toBeNull();
  });
});
