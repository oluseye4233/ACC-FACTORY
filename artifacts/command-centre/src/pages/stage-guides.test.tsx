// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { StageGuide } from "@workspace/api-client-react";

const lib = vi.fn();
const me = vi.fn();
const ME_ADMIN = { data: { id: "u-admin", role: "ADMIN" }, isLoading: false, isError: false, refetch: vi.fn() };
const generateMutate = vi.fn();
const syncMutate = vi.fn();
const publishMutate = vi.fn();
const saveMutate = vi.fn();
let lastQuery: { enabled: boolean; queryKey: unknown[] } | null = null;
const m = (mutate: unknown) => ({ mutate, isPending: false });

vi.mock("@workspace/api-client-react", () => ({
  getGetStageGuidesQueryKey: () => ["/api/stage-guides"],
  useGetStageGuides: (_p: unknown, o: { query: { enabled: boolean; queryKey: unknown[] } }) => { lastQuery = o.query; return o.query.enabled ? lib() : { data: undefined, isLoading: false, isError: false }; },
  useGetMe: () => me(),
  useSaveStageGuide: () => m(saveMutate),
  useGenerateStageGuide: () => m(generateMutate),
  useSyncStageGuide: () => m(syncMutate),
  usePublishStageGuide: () => m(publishMutate),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@/components/layout/TopNav", () => ({ TopNav: () => null }));
vi.mock("wouter", () => ({ useSearch: () => "", Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

import StageGuidesPage from "./stage-guides";
import { StageGuidePanel } from "@/components/shared/StageGuidePanel";

const UUID = "0f1e2d3c-4b5a-4968-8778-695a4b3c2d1e";
const g = (o: Partial<StageGuide> = {}): StageGuide => ({
  id: "11111111-1111-4111-8111-111111111111", stageKey: "F0", kind: "DEMONSTRATION", title: "Reading the bear case",
  script: "A narrated synthetic worked example of an F0 advisory read for a fictional bakery.", outcome: "A clear read", limitation: "Synthetic",
  version: 2, state: "DRAFT", isTest: false, published: false, embedUrl: null, providerVideoId: null, ...o,
});
const data = (guides: StageGuide[], o: Record<string, unknown> = {}) => ({ data: { configured: true, canManage: false, guides, history: [], ...o }, isLoading: false, isError: false, isSuccess: true, isPlaceholderData: false, isRefetchError: false, refetch: vi.fn() });

beforeEach(() => { vi.clearAllMocks(); me.mockReturnValue(ME_ADMIN); });
afterEach(cleanup);

describe("stage guides", () => {
  it("shows transcript only with no watch control for unpublished guides", () => {
    lib.mockReturnValue(data([g({ embedUrl: `https://share.synthesia.io/embeds/videos/${UUID}` })], { configured: false }));
    render(<StageGuidesPage />);
    expect(screen.getByText(/fictional bakery/)).toBeTruthy();
    expect(screen.queryByTestId(/button-watch/)).toBeNull();
    expect(screen.getByTestId("banner-not-configured").textContent).not.toMatch(/SYNTHESIA_API_KEY/);
  });

  it("hides management from non-admins", () => {
    lib.mockReturnValue(data([g()]));
    render(<StageGuidesPage />);
    expect(screen.queryByTestId("panel-guide-manager")).toBeNull();
  });

  it("loads the embed only after an explicit Watch click", () => {
    lib.mockReturnValue(data([g({ state: "COMPLETE", published: true, embedUrl: `https://share.synthesia.io/embeds/videos/${UUID}` })]));
    render(<StageGuidePanel stageKey="F0" />);
    expect(document.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByTestId("button-watch-F0-DEMONSTRATION-0"));
    const frame = document.querySelector("iframe")!;
    expect(frame.getAttribute("src")).toBe(`https://share.synthesia.io/embeds/videos/${UUID}`);
    expect(frame.getAttribute("src")).not.toMatch(/autoplay/);
    expect(frame.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(screen.getByText(/fictional bakery/)).toBeTruthy();
  });

  it("refuses non-official embed URLs", () => {
    lib.mockReturnValue(data([g({ state: "COMPLETE", published: true, embedUrl: "https://evil.example/x" })]));
    render(<StageGuidePanel stageKey="F0" />);
    expect(screen.queryByTestId(/button-watch/)).toBeNull();
  });

  it("never offers publication of a test render", () => {
    lib.mockReturnValue(data([g({ state: "COMPLETE", isTest: true })], { canManage: true }));
    render(<StageGuidesPage />);
    expect(screen.getByTestId("text-test-unpublishable")).toBeTruthy();
    expect(screen.queryByTestId("button-publish")).toBeNull();
  });

  it("generates a test by default and requires separate credit consent for paid", () => {
    lib.mockReturnValue(data([g()], { canManage: true }));
    render(<StageGuidesPage />);
    const gen = screen.getByTestId("button-generate") as HTMLButtonElement;
    expect(gen.disabled).toBe(true);
    fireEvent.click(screen.getByTestId("checkbox-script-reviewed"));
    fireEvent.click(gen);
    expect(generateMutate.mock.calls[0][0].data).toEqual({ test: true, scriptReviewed: true, creditsAccepted: false });
    fireEvent.click(screen.getByTestId("checkbox-paid-render"));
    expect(gen.disabled).toBe(true);
    fireEvent.click(screen.getByTestId("checkbox-credits-accepted"));
    fireEvent.click(gen);
    expect(generateMutate.mock.calls[1][0].data).toEqual({ test: false, scriptReviewed: true, creditsAccepted: true });
  });

  it("UNKNOWN blocks re-render and recovers only by provider UUID", () => {
    lib.mockReturnValue(data([g({ state: "UNKNOWN" })], { canManage: true }));
    render(<StageGuidesPage />);
    expect((screen.getByTestId("button-generate") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId("checkbox-script-reviewed")).toBeNull();
    const rec = screen.getByTestId("button-recover") as HTMLButtonElement;
    fireEvent.change(screen.getByTestId("input-recover-id"), { target: { value: "not-a-uuid" } });
    expect(rec.disabled).toBe(true);
    fireEvent.change(screen.getByTestId("input-recover-id"), { target: { value: UUID } });
    fireEvent.click(rec);
    expect(syncMutate.mock.calls[0][0].data).toEqual({ providerVideoId: UUID });
    expect(generateMutate).not.toHaveBeenCalled();
  });

  it("FAILED cannot render directly and offers save as new revision with unchanged script", () => {
    lib.mockReturnValue(data([g({ state: "FAILED" })], { canManage: true }));
    render(<StageGuidesPage />);
    expect((screen.getByTestId("button-generate") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId("checkbox-script-reviewed")).toBeNull();
    const save = screen.getByTestId("button-save-script") as HTMLButtonElement;
    expect(save.textContent).toMatch(/Save as new revision/);
    fireEvent.click(save);
    expect(saveMutate.mock.calls[0][0].data).toEqual({ stageKey: "F0", kind: "DEMONSTRATION", script: g().script });
    expect(generateMutate).not.toHaveBeenCalled();
    expect(screen.getByTestId("text-render-caps").textContent).toMatch(/2 renders.*4 renders/);
  });

  it("scopes the cache by account id and waits for identity", () => {
    me.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });
    lib.mockReturnValue(data([g()], { canManage: true }));
    const { rerender } = render(<StageGuidesPage />);
    expect(lastQuery!.enabled).toBe(false);
    expect(lib).not.toHaveBeenCalled();
    expect(screen.queryByTestId("panel-guide-manager")).toBeNull();
    me.mockReturnValue(ME_ADMIN);
    rerender(<StageGuidesPage />);
    expect(lastQuery!.enabled).toBe(true);
    expect(JSON.stringify(lastQuery!.queryKey)).toContain("u-admin");
  });

  it("requires role ADMIN in addition to server canManage", () => {
    me.mockReturnValue({ data: { id: "u-2", role: "MEMBER" }, isLoading: false, isError: false, refetch: vi.fn() });
    lib.mockReturnValue(data([g()], { canManage: true }));
    render(<StageGuidesPage />);
    expect(screen.queryByTestId("panel-guide-manager")).toBeNull();
    expect(screen.queryByTestId("select-revision")).toBeNull();
  });

  it("shows identity error with retry and no admin tools", () => {
    me.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });
    render(<StageGuidesPage />);
    expect(screen.getByTestId("button-retry-identity")).toBeTruthy();
    expect(screen.queryByTestId("panel-guide-manager")).toBeNull();
  });

  it("keeps dirty script edits across background refetch", () => {
    lib.mockReturnValue(data([g()], { canManage: true }));
    const { rerender } = render(<StageGuidesPage />);
    fireEvent.change(screen.getByTestId("input-guide-script"), { target: { value: "edited script that is long enough to save as a new version" } });
    lib.mockReturnValue(data([g({ title: "refetched" })], { canManage: true }));
    rerender(<StageGuidesPage />);
    expect((screen.getByTestId("input-guide-script") as HTMLTextAreaElement).value).toMatch(/^edited script/);
  });
});
