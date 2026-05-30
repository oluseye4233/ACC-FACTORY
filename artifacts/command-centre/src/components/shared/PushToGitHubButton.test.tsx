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

describe("PushToGitHubButton — push error toasts", () => {
  // Same mocked ApiError shape the thin `api` wrapper throws: a `code` body
  // plus a message. `instanceof ApiError` inside the component resolves against
  // this mocked class, so the code-specific catch branches fire.
  function apiError(code: string, message = `${code} happened`) {
    return new ApiError(503, { code }, message);
  }

  // Drive the simplest push: open the dialog (defaults to "create" mode with a
  // pre-filled repo name, so the confirm button is enabled) and click confirm,
  // which calls push("create") and hits the pre-seeded failing apiPost.
  async function triggerCreatePush() {
    fireEvent.click(screen.getByTestId("f8-github-push"));
    fireEvent.click(await screen.findByTestId("f8-github-confirm"));
  }

  it("maps GITHUB_NOT_CONNECTED to the 'GitHub not connected' toast", async () => {
    apiPost.mockRejectedValue(apiError("GITHUB_NOT_CONNECTED"));

    render(<PushToGitHubButton bundle={makeBundle("artifact-1234abcd")} />);
    await triggerCreatePush();

    // Both connection codes share a fixed guidance description, ignoring the
    // ApiError message entirely.
    await waitFor(() =>
      expect(toastMock).toHaveBeenLastCalledWith({
        variant: "destructive",
        title: "GitHub not connected",
        description:
          "Connect your GitHub in Account → Connected Services, then retry.",
      }),
    );
  });

  it("maps GITHUB_BAD_TOKEN to the 'GitHub not connected' toast", async () => {
    apiPost.mockRejectedValue(apiError("GITHUB_BAD_TOKEN"));

    render(<PushToGitHubButton bundle={makeBundle("artifact-1234abcd")} />);
    await triggerCreatePush();

    await waitFor(() =>
      expect(toastMock).toHaveBeenLastCalledWith({
        variant: "destructive",
        title: "GitHub not connected",
        description:
          "Connect your GitHub in Account → Connected Services, then retry.",
      }),
    );
  });

  it("maps GITHUB_REPO_EXISTS to the 'Repo name taken' toast", async () => {
    apiPost.mockRejectedValue(apiError("GITHUB_REPO_EXISTS"));

    render(<PushToGitHubButton bundle={makeBundle("artifact-1234abcd")} />);
    await triggerCreatePush();

    // Static description; the ApiError message is not surfaced here.
    await waitFor(() =>
      expect(toastMock).toHaveBeenLastCalledWith({
        variant: "destructive",
        title: "Repo name taken",
        description:
          "That repo already exists on the connected account. Pick another name.",
      }),
    );
  });

  it("maps GITHUB_REPO_NOT_FOUND to the 'Repo not found' toast", async () => {
    // This branch surfaces the ApiError message as the description, so pin a
    // specific message and assert it rides through.
    apiPost.mockRejectedValue(
      apiError("GITHUB_REPO_NOT_FOUND", "octocat/ghost is gone"),
    );

    render(<PushToGitHubButton bundle={makeBundle("artifact-1234abcd")} />);
    await triggerCreatePush();

    await waitFor(() =>
      expect(toastMock).toHaveBeenLastCalledWith({
        variant: "destructive",
        title: "Repo not found",
        description: "octocat/ghost is gone",
      }),
    );
  });

  it("maps GITHUB_REPO_NOT_AUTHORIZED to the 'Repo not authorized' toast", async () => {
    apiPost.mockRejectedValue(
      apiError("GITHUB_REPO_NOT_AUTHORIZED", "token can't touch octocat/secret"),
    );

    render(<PushToGitHubButton bundle={makeBundle("artifact-1234abcd")} />);
    await triggerCreatePush();

    await waitFor(() =>
      expect(toastMock).toHaveBeenLastCalledWith({
        variant: "destructive",
        title: "Repo not authorized",
        description: "token can't touch octocat/secret",
      }),
    );
  });

  it("falls back to the generic 'PUSH FAILED' toast for any other error code", async () => {
    // An unrecognised code takes the catch-all branch, which surfaces the
    // ApiError message as the description.
    apiPost.mockRejectedValue(
      apiError("SOMETHING_ELSE", "unexpected backend failure"),
    );

    render(<PushToGitHubButton bundle={makeBundle("artifact-1234abcd")} />);
    await triggerCreatePush();

    await waitFor(() =>
      expect(toastMock).toHaveBeenLastCalledWith({
        variant: "destructive",
        title: "PUSH FAILED",
        description: "unexpected backend failure",
      }),
    );
  });

  it("uses the generic 'PUSH FAILED' toast for a non-ApiError failure", async () => {
    // A non-ApiError (e.g. a network blip) falls through to the static copy.
    apiPost.mockRejectedValue(new Error("network down"));

    render(<PushToGitHubButton bundle={makeBundle("artifact-1234abcd")} />);
    await triggerCreatePush();

    await waitFor(() =>
      expect(toastMock).toHaveBeenLastCalledWith({
        variant: "destructive",
        title: "PUSH FAILED",
        description: "Could not push to GitHub.",
      }),
    );
  });
});

describe("PushToGitHubButton — push success toasts", () => {
  // A successful push returns a PushResult. Only repoFullName is read by the
  // success-toast mapping, so a thin object is enough; pullRequestUrl is added
  // for the PR branch so the result view also renders the PR link.
  function pushResult(repoFullName: string, extra?: Record<string, unknown>) {
    return {
      repoFullName,
      htmlUrl: `https://github.com/${repoFullName}`,
      replitImportUrl: `https://replit.com/import/${repoFullName}`,
      ...extra,
    };
  }

  // Pointer persisted on an already-pushed bundle: supplying `existing` puts the
  // component straight into its "result" view, where the update/PR path lives.
  const EXISTING_REPO = "octocat/linked-app";
  function existingPointer() {
    return {
      fullName: EXISTING_REPO,
      htmlUrl: `https://github.com/${EXISTING_REPO}`,
      replitImportUrl: `https://replit.com/import/${EXISTING_REPO}`,
    };
  }

  it("create mode fires the 'CREATED & PUSHED' toast", async () => {
    apiPost.mockResolvedValue(pushResult("octocat/new-app", { created: true }));

    render(<PushToGitHubButton bundle={makeBundle("artifact-1234abcd")} />);
    // Default "create" mode with a pre-filled name: confirm calls push("create").
    fireEvent.click(screen.getByTestId("f8-github-push"));
    fireEvent.click(await screen.findByTestId("f8-github-confirm"));

    await waitFor(() =>
      expect(toastMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          title: "CREATED & PUSHED",
          description: expect.stringContaining("octocat/new-app"),
        }),
      ),
    );
  });

  it("existing mode fires the 'PUSHED TO REPO' toast", async () => {
    apiPost.mockResolvedValue(pushResult(PUBLIC_REPO));

    render(<PushToGitHubButton bundle={makeBundle("artifact-1234abcd")} />);
    // Open the picker, pick a repo (sets targetRepo to owner/repo), then confirm
    // — which calls push("existing").
    await openPicker();
    fireEvent.click(screen.getByTestId(`f8-github-repo-option-${PUBLIC_REPO}`));
    fireEvent.click(screen.getByTestId("f8-github-confirm"));

    await waitFor(() =>
      expect(toastMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          title: "PUSHED TO REPO",
          description: expect.stringContaining(PUBLIC_REPO),
        }),
      ),
    );
  });

  it("update mode (PR off) fires the 'PUSHED UPDATE' toast", async () => {
    apiPost.mockResolvedValue(pushResult(EXISTING_REPO, { created: false }));

    render(
      <PushToGitHubButton
        bundle={makeBundle("artifact-1234abcd")}
        existing={existingPointer()}
      />,
    );
    // `existing` opens the dialog straight into the result view. PR toggle is off
    // by default, so the update button calls push("update") with pullRequest=false.
    fireEvent.click(screen.getByTestId("f8-github-push"));
    fireEvent.click(await screen.findByTestId("f8-github-push-update"));

    await waitFor(() =>
      expect(toastMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          title: "PUSHED UPDATE",
          description: expect.stringContaining("New commit on"),
        }),
      ),
    );
  });

  it("update mode (PR on) fires the 'PULL REQUEST OPENED' toast", async () => {
    apiPost.mockResolvedValue(
      pushResult(EXISTING_REPO, {
        created: false,
        pullRequestUrl: `https://github.com/${EXISTING_REPO}/pull/1`,
      }),
    );

    render(
      <PushToGitHubButton
        bundle={makeBundle("artifact-1234abcd")}
        existing={existingPointer()}
      />,
    );
    fireEvent.click(screen.getByTestId("f8-github-push"));
    // Flip the PR switch on, so the update button calls push("update") with
    // pullRequest=true and maps to the PR-opened copy.
    fireEvent.click(await screen.findByTestId("f8-github-pr-mode"));
    fireEvent.click(screen.getByTestId("f8-github-push-update"));

    await waitFor(() =>
      expect(toastMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          title: "PULL REQUEST OPENED",
          description: expect.stringContaining("PR opened on"),
        }),
      ),
    );
  });
});
