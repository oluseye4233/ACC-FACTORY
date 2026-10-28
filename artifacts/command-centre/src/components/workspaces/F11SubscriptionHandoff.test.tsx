// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const sourcesState = { data: [] as any[], isLoading: false, isError: false, refetch: vi.fn() };
vi.mock("@workspace/api-client-react", () => ({
  useListF10Sources: () => sourcesState,
  useDownloadF10Export: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@workspace/artifact-naming", () => ({ buildArtifactFilename: () => "x.zip" }));

import { F11SubscriptionHandoff, selectVerifiedBundle } from "./F11SubscriptionHandoff";

const src = (id: string, extra: any = {}) => ({ id, type: "VERIFIED_CODEBASE_BUNDLE", artifactType: "VERIFIED_CODEBASE_BUNDLE", outputKind: "CODE_DJ", createdAt: "2025-01-0" + id.length + "T00:00:00Z", ...extra });

describe("selectVerifiedBundle", () => {
  it("never substitutes a different bundle for the preferred one", () => {
    const sources = [src("a", { verificationStatus: "VERIFIED" }), src("b", { verificationStatus: "UNVERIFIED" })];
    expect(selectVerifiedBundle(sources as any, [], "b")).toBeNull();
    expect(selectVerifiedBundle(sources as any, [{ id: "a", artifactType: "VERIFIED_CODEBASE_BUNDLE", verificationStatus: "VERIFIED" }] as any, "a")?.id).toBe("a");
  });
  it("falls back to harness verification status", () => {
    expect(selectVerifiedBundle([src("c")] as any, [{ id: "c", artifactType: "VERIFIED_CODEBASE_BUNDLE", verificationStatus: "VERIFIED" }] as any)?.id).toBe("c");
    expect(selectVerifiedBundle([src("c")] as any, [])).toBeNull();
  });
  it("resolves the selected original bundle to its verified child, never an unrelated session", () => {
    const artifacts = [
      { id: "original", artifactType: "CODEBASE_BUNDLE" },
      { id: "child", parentArtifactId: "original", artifactType: "VERIFIED_CODEBASE_BUNDLE", verificationStatus: "VERIFIED" },
    ];
    expect(selectVerifiedBundle([src("child")] as any, artifacts as any, "original")?.id).toBe("child");
    expect(selectVerifiedBundle([src("unrelated", { verificationStatus: "VERIFIED" })] as any, artifacts as any, "original")).toBeNull();
  });
});

describe("F11SubscriptionHandoff", () => {
  it("explains pending verification without download control", () => {
    sourcesState.data = [];
    render(<F11SubscriptionHandoff artifacts={[]} preferredSourceId="bundle-123456789" />);
    expect(screen.getByText(/no other bundle is substituted/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /download/i })).toBeNull();
    expect(screen.getByText(/does not complete any H stage/i)).toBeTruthy();
  });
  it("routes the verified bundle to the portal by exact artifact ID", () => {
    sourcesState.data = [src("v", { verificationStatus: "VERIFIED" })];
    render(<F11SubscriptionHandoff artifacts={[{ id: "v", artifactType: "VERIFIED_CODEBASE_BUNDLE", verificationStatus: "VERIFIED" }] as any} preferredSourceId="v" />);
    expect(screen.queryByRole("button", { name: /download/i })).toBeNull();
    const href = () => decodeURIComponent(screen.getAllByTestId("link-f11-portal")[0].getAttribute("href") ?? "");
    expect(href()).toContain("/imprima-portal?sourceId=v&sourceType=F10_EXPORT");
    expect(href()).toContain('"target":"TypeScript/Node"');
    fireEvent.change(screen.getAllByTestId("select-f11-package")[0], { target: { value: "REPLIT" } });
    expect(href()).toContain('"family":"VIBE_APP"');
  });
});
