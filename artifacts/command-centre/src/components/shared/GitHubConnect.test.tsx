// @vitest-environment jsdom
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
} from "@testing-library/react";

// ---------- mocks ----------
// The component talks to the back-end through the thin `api` wrapper and surfaces
// every outcome through `useToast`. Both are mocked so the tests assert on the
// component's behaviour, not on real network or DOM toast plumbing.
const toastMock = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiDelete = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
    delete: (...args: unknown[]) => apiDelete(...args),
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

import { GitHubConnect } from "./GitHubConnect";

const originalLocation = window.location;

beforeEach(() => {
  vi.clearAllMocks();
  // Reset to a clean URL so the OAuth-return effect is a no-op by default.
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  cleanup();
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
});

describe("GitHubConnect — not connected", () => {
  it("shows the one-click OAuth button when oauthAvailable is true", async () => {
    apiGet.mockResolvedValue({ connected: false, oauthAvailable: true });

    render(<GitHubConnect />);

    expect(await screen.findByTestId("github-connect-oauth")).toBeTruthy();
    // The manual token field stays hidden until the user opts in.
    expect(screen.queryByTestId("github-token-input")).toBeNull();
  });

  it("navigates to the OAuth start endpoint when the button is clicked", async () => {
    apiGet.mockResolvedValue({ connected: false, oauthAvailable: true });

    let assignedHref = "";
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: {
        search: "",
        pathname: "/",
        get href() {
          return assignedHref;
        },
        set href(v: string) {
          assignedHref = v;
        },
      },
    });

    render(<GitHubConnect />);

    fireEvent.click(await screen.findByTestId("github-connect-oauth"));

    expect(assignedHref).toBe("/api/integrations/github/oauth/start?scope=repo");
  });

  it("toggles the paste-a-token fallback open and closed", async () => {
    apiGet.mockResolvedValue({ connected: false, oauthAvailable: true });

    render(<GitHubConnect />);

    const toggle = await screen.findByTestId("github-paste-toggle");
    expect(screen.queryByTestId("github-token-input")).toBeNull();

    fireEvent.click(toggle);
    expect(screen.getByTestId("github-token-input")).toBeTruthy();

    fireEvent.click(toggle);
    expect(screen.queryByTestId("github-token-input")).toBeNull();
  });

  it("shows the token field directly when OAuth is unavailable", async () => {
    apiGet.mockResolvedValue({ connected: false, oauthAvailable: false });

    render(<GitHubConnect />);

    expect(await screen.findByTestId("github-token-input")).toBeTruthy();
    // No OAuth affordances when the server can't do the one-click flow.
    expect(screen.queryByTestId("github-connect-oauth")).toBeNull();
    expect(screen.queryByTestId("github-paste-toggle")).toBeNull();
  });

  it("posts the pasted token and reports success", async () => {
    apiGet.mockResolvedValue({ connected: false, oauthAvailable: false });
    apiPost.mockResolvedValue({ connected: true, login: "octocat" });

    render(<GitHubConnect />);

    const input = await screen.findByTestId("github-token-input");
    const connect = screen.getByTestId("github-connect");
    // Button is disabled until a non-empty token is entered.
    expect((connect as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(input, { target: { value: "  ghp_testtoken  " } });
    expect((connect as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(connect);

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith("/api/integrations/github", {
        token: "ghp_testtoken",
      }),
    );
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "GitHub connected" }),
      ),
    );
  });

  it("reports a destructive toast when the token connect fails", async () => {
    apiGet.mockResolvedValue({ connected: false, oauthAvailable: false });
    apiPost.mockRejectedValue(new Error("nope"));

    render(<GitHubConnect />);

    const input = await screen.findByTestId("github-token-input");
    fireEvent.change(input, { target: { value: "ghp_bad" } });
    fireEvent.click(screen.getByTestId("github-connect"));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Could not connect GitHub",
          variant: "destructive",
        }),
      ),
    );
  });
});

describe("GitHubConnect — connected", () => {
  it("renders the connected card and disconnects on click", async () => {
    apiGet.mockResolvedValue({
      connected: true,
      login: "octocat",
      lastUsedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      oauthAvailable: true,
    });
    apiDelete.mockResolvedValue({ connected: false });

    render(<GitHubConnect />);

    expect(await screen.findByTestId("github-connected")).toBeTruthy();

    fireEvent.click(screen.getByTestId("github-disconnect"));

    await waitFor(() =>
      expect(apiDelete).toHaveBeenCalledWith("/api/integrations/github"),
    );
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "GitHub disconnected" }),
      ),
    );
  });
});

describe("GitHubConnect — OAuth return query", () => {
  it("shows a success toast and strips ?github=connected", async () => {
    apiGet.mockResolvedValue({ connected: false, oauthAvailable: true });
    window.history.replaceState({}, "", "/account?github=connected");

    render(<GitHubConnect />);

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "GitHub connected" }),
      ),
    );
    // A success toast is not destructive.
    expect(toastMock.mock.calls[0]![0].variant).toBeUndefined();
    expect(window.location.search).toBe("");
  });

  it("shows a destructive toast for ?github=denied and opens the paste fallback", async () => {
    apiGet.mockResolvedValue({ connected: false, oauthAvailable: true });
    window.history.replaceState({}, "", "/account?github=denied");

    render(<GitHubConnect />);

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "GitHub authorization cancelled",
          variant: "destructive",
        }),
      ),
    );
    // A failed return-trip auto-opens the manual token entry.
    expect(await screen.findByTestId("github-token-input")).toBeTruthy();
    expect(window.location.search).toBe("");
  });

  it("shows a destructive toast for ?github=error", async () => {
    apiGet.mockResolvedValue({ connected: false, oauthAvailable: true });
    window.history.replaceState({}, "", "/account?github=error");

    render(<GitHubConnect />);

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Could not connect GitHub",
          variant: "destructive",
        }),
      ),
    );
    expect(window.location.search).toBe("");
  });

  it("shows a destructive toast for ?github=oauth_unavailable", async () => {
    apiGet.mockResolvedValue({ connected: false, oauthAvailable: true });
    window.history.replaceState({}, "", "/account?github=oauth_unavailable");

    render(<GitHubConnect />);

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "One-click connect is unavailable",
          variant: "destructive",
        }),
      ),
    );
    expect(await screen.findByTestId("github-token-input")).toBeTruthy();
    expect(window.location.search).toBe("");
  });

  it("ignores an unrelated query string and emits no toast", async () => {
    apiGet.mockResolvedValue({ connected: false, oauthAvailable: true });
    window.history.replaceState({}, "", "/account?foo=bar");

    render(<GitHubConnect />);

    await screen.findByTestId("github-connect-oauth");
    expect(toastMock).not.toHaveBeenCalled();
    // An unrelated query is left untouched.
    expect(window.location.search).toBe("?foo=bar");
  });
});
