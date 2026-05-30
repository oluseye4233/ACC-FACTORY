// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
} from "@testing-library/react";
import type { CodebaseBundle } from "@workspace/api-client-react";

// ---------- jsdom polyfills ----------
// Radix Popover / ToggleGroup and cmdk lean on pointer-capture, scrollIntoView
// and ResizeObserver, none of which jsdom implements. Stub them so the picker
// can open and render its repo list under test.
beforeEach(() => {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
  if (!("ResizeObserver" in globalThis)) {
    (globalThis as unknown as Record<string, unknown>).ResizeObserver =
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
  }
});

// ---------- mocks ----------
// The component reaches the back-end through the thin `api` wrapper and surfaces
// outcomes through `useToast`. Both are mocked so the tests assert on the
// picker's filter behaviour, not real network or toast plumbing.
const toastMock = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

const apiGet = vi.fn();
const apiPost = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
  },
  ApiError: class ApiError extends Error {
    constructor(
      public readonly status: number,
      public readonly body: unknown,
      message: string,
    ) {
      super(message);
    }
  },
}));

import { PushToGitHubButton } from "./PushToGitHubButton";
import { ApiError } from "@/lib/api";

// Minimal bundle — only artifactId/platform are read before a push happens.
function makeBundle(artifactId: string): CodebaseBundle {
  return {
    artifactId,
    platform: "pnpm-monorepo" as CodebaseBundle["platform"],
    manifest: {} as CodebaseBundle["manifest"],
    files: [],
    notes: "",
  };
}

const PUBLIC_REPO = "octocat/public-app";
const PRIVATE_REPO = "octocat/private-app";

function mixedRepos() {
  return {
    repos: [
      {
        fullName: PUBLIC_REPO,
        owner: "octocat",
        name: "public-app",
        private: false,
        defaultBranch: "main",
        htmlUrl: `https://github.com/${PUBLIC_REPO}`,
        pushedAt: null,
      },
      {
        fullName: PRIVATE_REPO,
        owner: "octocat",
        name: "private-app",
        private: true,
        defaultBranch: "main",
        htmlUrl: `https://github.com/${PRIVATE_REPO}`,
        pushedAt: null,
      },
    ],
    page: 1,
    hasMore: false,
  };
}

// Open the dialog, switch to "Use existing repo" (which loads the list), then
// open the repo picker popover. Resolves once both repos are on screen.
async function openPicker() {
  fireEvent.click(screen.getByTestId("f8-github-push"));
  fireEvent.click(await screen.findByTestId("f8-github-mode-existing"));
  // Wait for the repo list to finish loading.
  await waitFor(() => expect(apiGet).toHaveBeenCalled());
  fireEvent.click(await screen.findByTestId("f8-github-repo-picker"));
  await screen.findByTestId(`f8-github-repo-option-${PUBLIC_REPO}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  apiGet.mockResolvedValue(mixedRepos());
});

afterEach(() => {
  cleanup();
});

describe("PushToGitHubButton — visibility filter", () => {
  it("shows both repos under the default 'All' filter", async () => {
    render(<PushToGitHubButton bundle={makeBundle("artifact-1234abcd")} />);
    await openPicker();

    expect(
      screen.getByTestId(`f8-github-repo-option-${PUBLIC_REPO}`),
    ).toBeTruthy();
    expect(
      screen.getByTestId(`f8-github-repo-option-${PRIVATE_REPO}`),
    ).toBeTruthy();
  });

  it("'Public' hides private repos", async () => {
    render(<PushToGitHubButton bundle={makeBundle("artifact-1234abcd")} />);
    await openPicker();

    fireEvent.click(screen.getByTestId("f8-github-visibility-public"));

    await waitFor(() =>
      expect(
        screen.queryByTestId(`f8-github-repo-option-${PRIVATE_REPO}`),
      ).toBeNull(),
    );
    expect(
      screen.getByTestId(`f8-github-repo-option-${PUBLIC_REPO}`),
    ).toBeTruthy();
  });

  it("'Private' hides public repos", async () => {
    render(<PushToGitHubButton bundle={makeBundle("artifact-1234abcd")} />);
    await openPicker();

    fireEvent.click(screen.getByTestId("f8-github-visibility-private"));

    await waitFor(() =>
      expect(
        screen.queryByTestId(`f8-github-repo-option-${PUBLIC_REPO}`),
      ).toBeNull(),
    );
    expect(
      screen.getByTestId(`f8-github-repo-option-${PRIVATE_REPO}`),
    ).toBeTruthy();
  });

  it("'All' restores everything after a narrower filter", async () => {
    render(<PushToGitHubButton bundle={makeBundle("artifact-1234abcd")} />);
    await openPicker();

    fireEvent.click(screen.getByTestId("f8-github-visibility-private"));
    await waitFor(() =>
      expect(
        screen.queryByTestId(`f8-github-repo-option-${PUBLIC_REPO}`),
      ).toBeNull(),
    );

    fireEvent.click(screen.getByTestId("f8-github-visibility-all"));
    expect(
      await screen.findByTestId(`f8-github-repo-option-${PUBLIC_REPO}`),
    ).toBeTruthy();
    expect(
      screen.getByTestId(`f8-github-repo-option-${PRIVATE_REPO}`),
    ).toBeTruthy();
  });

  it("shows the empty state when a filter excludes every repo", async () => {
    // A list with only public repos: selecting "Private" excludes them all.
    apiGet.mockResolvedValue({
      repos: [mixedRepos().repos[0]],
      page: 1,
      hasMore: false,
    });

    render(<PushToGitHubButton bundle={makeBundle("artifact-1234abcd")} />);
    await openPicker();

    fireEvent.click(screen.getByTestId("f8-github-visibility-private"));

    await waitFor(() =>
      expect(
        screen.queryByTestId(`f8-github-repo-option-${PUBLIC_REPO}`),
      ).toBeNull(),
    );
    expect(screen.getByText("No matching repositories.")).toBeTruthy();
  });

  it("resets the filter to 'All' when the dialog is reopened", async () => {
    render(<PushToGitHubButton bundle={makeBundle("artifact-1234abcd")} />);
    await openPicker();

    // Narrow to private, then close the picker popover and the dialog.
    fireEvent.click(screen.getByTestId("f8-github-visibility-private"));
    await waitFor(() =>
      expect(
        screen.queryByTestId(`f8-github-repo-option-${PUBLIC_REPO}`),
      ).toBeNull(),
    );
    fireEvent.click(screen.getByTestId("f8-github-repo-picker")); // close popover
    fireEvent.click(screen.getByRole("button", { name: /close/i })); // close dialog
    await waitFor(() =>
      expect(screen.queryByTestId("f8-github-mode-existing")).toBeNull(),
    );

    // Reopen: the repo list is still cached, so opening the picker again should
    // show both repos because the visibility filter has reset to "All".
    fireEvent.click(screen.getByTestId("f8-github-push"));
    fireEvent.click(await screen.findByTestId("f8-github-mode-existing"));
    fireEvent.click(await screen.findByTestId("f8-github-repo-picker"));

    expect(
      await screen.findByTestId(`f8-github-repo-option-${PUBLIC_REPO}`),
    ).toBeTruthy();
    expect(
      screen.getByTestId(`f8-github-repo-option-${PRIVATE_REPO}`),
    ).toBeTruthy();
  });

  it("resets the filter to 'All' when the bundle changes", async () => {
    const { rerender } = render(
      <PushToGitHubButton bundle={makeBundle("artifact-1234abcd")} />,
    );
    await openPicker();

    fireEvent.click(screen.getByTestId("f8-github-visibility-private"));
    await waitFor(() =>
      expect(
        screen.queryByTestId(`f8-github-repo-option-${PUBLIC_REPO}`),
      ).toBeNull(),
    );
    fireEvent.click(screen.getByTestId("f8-github-repo-picker")); // close popover

    // A new bundle resets the picker (back to create mode + cleared list). Drive
    // back into the existing-repo picker; the reloaded list shows both repos
    // because the visibility filter reset to "All".
    rerender(<PushToGitHubButton bundle={makeBundle("artifact-99887766")} />);
    fireEvent.click(await screen.findByTestId("f8-github-mode-existing"));
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2));
    fireEvent.click(await screen.findByTestId("f8-github-repo-picker"));

    expect(
      await screen.findByTestId(`f8-github-repo-option-${PUBLIC_REPO}`),
    ).toBeTruthy();
    expect(
      screen.getByTestId(`f8-github-repo-option-${PRIVATE_REPO}`),
    ).toBeTruthy();
  });
});

describe("PushToGitHubButton — manual owner/repo fallback", () => {
  // Build a mocked ApiError carrying a `code` body, matching what the thin
  // `api` wrapper throws. `instanceof ApiError` inside the component resolves
  // against this same mocked class, so the code-specific branches fire.
  function apiError(code: string, message = `${code} happened`) {
    return new ApiError(503, { code }, message);
  }

  // Switch into "Use existing repo", which kicks off the list load. The caller
  // pre-seeds apiGet to fail so the component drops into manual entry.
  async function openExistingTab() {
    fireEvent.click(screen.getByTestId("f8-github-push"));
    fireEvent.click(await screen.findByTestId("f8-github-mode-existing"));
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
  }

  it("falls back to manual entry with the GITHUB_NOT_CONNECTED guidance", async () => {
    apiGet.mockRejectedValue(apiError("GITHUB_NOT_CONNECTED"));

    render(<PushToGitHubButton bundle={makeBundle("artifact-1234abcd")} />);
    await openExistingTab();

    expect(
      await screen.findByTestId("f8-github-target-repo"),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "GitHub isn't connected. Connect it in Account → Connected Services, or type owner/repo by hand.",
      ),
    ).toBeTruthy();
    // The picker button should be gone while in manual mode.
    expect(screen.queryByTestId("f8-github-repo-picker")).toBeNull();
  });

  it("falls back to manual entry with the GITHUB_BAD_TOKEN guidance", async () => {
    apiGet.mockRejectedValue(apiError("GITHUB_BAD_TOKEN"));

    render(<PushToGitHubButton bundle={makeBundle("artifact-1234abcd")} />);
    await openExistingTab();

    expect(
      await screen.findByTestId("f8-github-target-repo"),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Your GitHub token was rejected. Reconnect it, or type owner/repo by hand.",
      ),
    ).toBeTruthy();
  });

  it("falls back to manual entry with a generic message for any other list error", async () => {
    // A non-ApiError (e.g. a network blip) takes the generic branch.
    apiGet.mockRejectedValue(new Error("network down"));

    render(<PushToGitHubButton bundle={makeBundle("artifact-1234abcd")} />);
    await openExistingTab();

    expect(
      await screen.findByTestId("f8-github-target-repo"),
    ).toBeTruthy();
    expect(
      screen.getByText("Could not list your repos. Type owner/repo by hand."),
    ).toBeTruthy();
  });

  it("'Pick from list' returns to the picker and retriggers a list load", async () => {
    // First load fails (manual fallback); the retry from "Pick from list"
    // succeeds and shows the picker again.
    apiGet
      .mockRejectedValueOnce(apiError("GITHUB_NOT_CONNECTED"))
      .mockResolvedValueOnce(mixedRepos());

    render(<PushToGitHubButton bundle={makeBundle("artifact-1234abcd")} />);
    await openExistingTab();

    // In manual mode after the failed load.
    await screen.findByTestId("f8-github-target-repo");

    fireEvent.click(screen.getByTestId("f8-github-pick-from-list"));

    // Back to the picker, and a second list load fired.
    expect(await screen.findByTestId("f8-github-repo-picker")).toBeTruthy();
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId("f8-github-target-repo")).toBeNull();
  });

  it("'Enter manually' switches into manual mode from a loaded list", async () => {
    // Default mock resolves a good list, so the picker loads normally.
    render(<PushToGitHubButton bundle={makeBundle("artifact-1234abcd")} />);
    fireEvent.click(screen.getByTestId("f8-github-push"));
    fireEvent.click(await screen.findByTestId("f8-github-mode-existing"));
    await waitFor(() => expect(apiGet).toHaveBeenCalled());

    // The picker (not manual entry) is shown after a successful load.
    expect(await screen.findByTestId("f8-github-repo-picker")).toBeTruthy();
    expect(screen.queryByTestId("f8-github-target-repo")).toBeNull();

    fireEvent.click(screen.getByTestId("f8-github-enter-manually"));

    expect(
      await screen.findByTestId("f8-github-target-repo"),
    ).toBeTruthy();
    expect(screen.queryByTestId("f8-github-repo-picker")).toBeNull();
  });
});
