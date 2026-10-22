// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
const mock = vi.hoisted(() => ({ records: new Map<string, any>(), error: false, pending: false, refetch: vi.fn() }));
vi.mock("@workspace/api-client-react", () => ({
  useGetArtifact: (id: string) => ({ data: mock.records.get(id), isError: mock.error, isPending: mock.pending, refetch: mock.refetch }),
}));
import { F8BundleComparison, f8ComparisonRefs } from "./F8BundleComparison";
const ids = Array.from({ length: 5 }, (_, i) => `${i + 1}1111111-1111-4111-8111-111111111111`);
const [journal, original, corrected, report, mvp] = ids;
const session = "session";
const refs = { remediationArtifactId: journal, originalBundleArtifactId: original, correctedBundleArtifactId: corrected,
  originalReportArtifactId: report, mvpPddArtifactId: mvp };
afterEach(cleanup);
beforeEach(() => {
  mock.records.clear(); mock.error = false; mock.pending = false; mock.refetch.mockReset();
  const data = [
    { id: original, artifactType: "CODEBASE_BUNDLE", artifactContent: { files: [{ path: "index.ts", content: "old <script>" }] } },
    { id: corrected, artifactType: "CODEBASE_BUNDLE", artifactContent: {
      files: [{ path: "index.ts", content: "fixed" }, { path: "added.ts", content: "new" }],
      remediationArtifactId: journal, sourceCodebaseBundleArtifactId: original, sourceDriftReportArtifactId: report, sourceMvpPddArtifactId: mvp,
    } },
    { id: journal, artifactType: "F8_DRIFT_REMEDIATION", artifactContent: {
      sourceCodebaseBundleArtifactId: original, sourceReportArtifactId: report, sourceMvpPddArtifactId: mvp,
    } },
    { id: report, artifactType: "PFP_REPORT", artifactContent: { sourceCodebaseBundleArtifactId: original, sourceMvpPddArtifactId: mvp } },
  ];
  for (const item of data) mock.records.set(item.id, { ...item, sessionId: session });
});
const show = () => render(<F8BundleComparison resultText={JSON.stringify(refs)} sessionId={session} />);
describe("Boomerang F8 evidence comparison", () => {
  it("shows original/corrected lineage and exact added and removed file content", () => {
    show();
    expect(screen.getByRole("region", { name: "F8 bundle comparison" })).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "index.ts" } });
    expect(screen.getByLabelText("Changes in index.ts").textContent).toContain("− old <script>");
    expect(screen.getByLabelText("Changes in index.ts").textContent).toContain("+ fixed");
    expect(document.querySelector("script")).toBeNull();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "added.ts" } });
    expect(screen.getByLabelText("Changes in added.ts").textContent).toContain("+ new");
    expect(screen.getByText(/does not prove executed tests/)).toBeTruthy();
  });
  it("refuses foreign-session and mismatched source evidence", () => {
    mock.records.get(corrected).sessionId = "different";
    const view = show();
    expect(screen.getByRole("alert").textContent).toContain("does not match");
    view.unmount();
    mock.records.get(corrected).sessionId = session;
    mock.records.get(corrected).artifactContent.sourceMvpPddArtifactId = "wrong";
    show();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
  it("shows loading and recoverable errors instead of an empty successful comparison", () => {
    mock.pending = true;
    const view = show();
    expect(screen.getByRole("status")).toBeTruthy();
    view.unmount(); mock.pending = false; mock.error = true;
    show(); fireEvent.click(screen.getByRole("button", { name: "Retry comparison" }));
    expect(mock.refetch).toHaveBeenCalledTimes(4);
  });
  it("does not fetch arbitrary references from unstructured returned text", () => {
    expect(f8ComparisonRefs("manual supporting work")).toBeNull();
    expect(f8ComparisonRefs(JSON.stringify({ ...refs, correctedBundleArtifactId: "../secret" }))).toBeNull();
    render(<F8BundleComparison resultText="not a repair" sessionId={session} />);
    expect(screen.queryByRole("region")).toBeNull();
  });
});
