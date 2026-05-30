import { useEffect, useState } from "react";
import type {
  CodebaseBundle,
  HarnessArtifact,
  PfpReport,
} from "@workspace/api-client-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/hooks/use-toast";
import { buildExportFiles, SUPPORTED_IDES } from "@/lib/codeDjExport";
import {
  Github,
  ExternalLink,
  Loader2,
  Check,
  ChevronsUpDown,
  Lock,
} from "lucide-react";

interface PushResult {
  repoFullName: string;
  htmlUrl: string;
  replitImportUrl: string;
  created?: boolean;
  pullRequestUrl?: string;
}

interface ExistingRepo {
  fullName: string;
  htmlUrl: string;
  replitImportUrl: string;
  pushedAt?: string;
}

interface PushableRepo {
  fullName: string;
  owner: string;
  name: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  pushedAt: string | null;
}

interface ListReposResponse {
  repos: PushableRepo[];
  page: number;
  hasMore: boolean;
}

interface Props {
  bundle: CodebaseBundle;
  source?: HarnessArtifact;
  pfp?: PfpReport;
  /** Pointer persisted on the bundle artifact if it was already pushed. */
  existing?: ExistingRepo | null;
}

function defaultRepoName(bundle: CodebaseBundle): string {
  return `code-dj-${bundle.artifactId.slice(0, 8)}-${bundle.platform}`;
}

// Compact "last pushed" relative time (e.g. "3d ago") for the picker rows.
function relativePushedAt(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diffMs = Date.now() - then;
  if (diffMs < 0) return "just now";
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const month = Math.floor(day / 30);
  const year = Math.floor(day / 365);
  if (year >= 1) return `${year}y ago`;
  if (month >= 1) return `${month}mo ago`;
  if (day >= 1) return `${day}d ago`;
  if (hr >= 1) return `${hr}h ago`;
  if (min >= 1) return `${min}m ago`;
  return "just now";
}

export function PushToGitHubButton({ bundle, source, pfp, existing }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [repoName, setRepoName] = useState(defaultRepoName(bundle));
  const [targetRepo, setTargetRepo] = useState("");
  const [targetMode, setTargetMode] = useState<"create" | "existing">("create");
  const [isPrivate, setIsPrivate] = useState(true);
  const [asPullRequest, setAsPullRequest] = useState(false);
  const [pending, setPending] = useState(false);
  // Searchable picker of repos the connected token can push to.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [repos, setRepos] = useState<PushableRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [reposHasMore, setReposHasMore] = useState(false);
  const [reposLoaded, setReposLoaded] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  // Client-side visibility filter over the already-loaded repo list.
  const [visibilityFilter, setVisibilityFilter] = useState<
    "all" | "public" | "private"
  >("all");
  const [result, setResult] = useState<PushResult | null>(
    existing
      ? {
          repoFullName: existing.fullName,
          htmlUrl: existing.htmlUrl,
          replitImportUrl: existing.replitImportUrl,
        }
      : null,
  );

  // Reset the suggested name whenever a new bundle is targeted.
  useEffect(() => {
    setRepoName(defaultRepoName(bundle));
    setTargetRepo("");
    setTargetMode("create");
    setManualEntry(false);
    setRepos([]);
    setReposLoaded(false);
    setReposError(null);
    setReposHasMore(false);
    setVisibilityFilter("all");
    setResult(
      existing
        ? {
            repoFullName: existing.fullName,
            htmlUrl: existing.htmlUrl,
            replitImportUrl: existing.replitImportUrl,
          }
        : null,
    );
  }, [bundle.artifactId, existing]);

  // Load the repos this user's connected token can push to. Called when the
  // "Use existing repo" tab is first opened; falls back to manual entry if the
  // list can't be fetched (e.g. token rejected) so the user is never blocked.
  const loadRepos = async () => {
    setReposLoading(true);
    setReposError(null);
    try {
      const r = await api.get<ListReposResponse>(
        "/api/integrations/github/repos",
      );
      setRepos(r.repos);
      setReposHasMore(r.hasMore);
      setReposLoaded(true);
    } catch (e) {
      const body =
        e instanceof ApiError ? (e.body as { code?: string } | null) : null;
      const msg =
        body?.code === "GITHUB_NOT_CONNECTED"
          ? "GitHub isn't connected. Connect it in Account → Connected Services, or type owner/repo by hand."
          : body?.code === "GITHUB_BAD_TOKEN"
            ? "Your GitHub token was rejected. Reconnect it, or type owner/repo by hand."
            : e instanceof ApiError
              ? e.message
              : "Could not list your repos. Type owner/repo by hand.";
      setReposError(msg);
      setManualEntry(true);
    } finally {
      setReposLoading(false);
    }
  };

  // Fetch the repo list the first time the "existing" tab is shown.
  useEffect(() => {
    if (targetMode === "existing" && !reposLoaded && !reposLoading && !manualEntry) {
      void loadRepos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetMode]);

  // Apply the client-side visibility filter over the already-loaded repos.
  const visibleRepos = repos.filter((repo) =>
    visibilityFilter === "all"
      ? true
      : visibilityFilter === "private"
        ? repo.private
        : !repo.private,
  );

  const push = async (mode: "create" | "update" | "existing") => {
    setPending(true);
    try {
      // Reuse the shared CODE DJ export generator so the GitHub repo carries
      // byte-identical files to the ZIP: scaffold tree + AGENTS.md + per-IDE
      // adapter files. Doctrine stays identical across delivery channels.
      const files = buildExportFiles(bundle, source, pfp);
      const pullRequest = mode === "update" && asPullRequest;
      const r = await api.post<PushResult>(
        "/api/integrations/github/push-codebase",
        {
          artifactId: bundle.artifactId,
          // "create" carries a repo name to mint; "existing" carries the
          // owner/repo of a repo the user already made (the only path a
          // narrowly-scoped fine-grained token can push through).
          ...(mode === "existing"
            ? { targetRepo: targetRepo.trim() }
            : { repoName: repoName.trim() }),
          private: isPrivate,
          mode,
          pullRequest,
          files,
        },
      );
      setResult(r);
      toast({
        title:
          mode === "create"
            ? "CREATED & PUSHED"
            : mode === "existing"
              ? "PUSHED TO REPO"
              : pullRequest
                ? "PULL REQUEST OPENED"
                : "PUSHED UPDATE",
        description:
          mode === "create"
            ? `${r.repoFullName} — ${SUPPORTED_IDES.length} IDE adapters rode along`
            : mode === "existing"
              ? `Pushed onto ${r.repoFullName} — ${SUPPORTED_IDES.length} IDE adapters rode along`
              : pullRequest
                ? `PR opened on ${r.repoFullName} — review the diff before merging`
                : `New commit on ${r.repoFullName} — ${SUPPORTED_IDES.length} IDE adapters refreshed`,
      });
    } catch (e) {
      const body = e instanceof ApiError ? (e.body as { code?: string } | null) : null;
      if (body?.code === "GITHUB_NOT_CONNECTED" || body?.code === "GITHUB_BAD_TOKEN") {
        toast({
          variant: "destructive",
          title: "GitHub not connected",
          description:
            "Connect your GitHub in Account → Connected Services, then retry.",
        });
        return;
      }
      if (body?.code === "GITHUB_REPO_EXISTS") {
        toast({
          variant: "destructive",
          title: "Repo name taken",
          description: "That repo already exists on the connected account. Pick another name.",
        });
        return;
      }
      if (body?.code === "GITHUB_REPO_NOT_FOUND") {
        toast({
          variant: "destructive",
          title: "Repo not found",
          description:
            e instanceof ApiError
              ? e.message
              : "No such repository, or your GitHub token can't see it. Create it on GitHub (or add it to the token's selected repos), then retry.",
        });
        return;
      }
      if (body?.code === "GITHUB_REPO_NOT_AUTHORIZED") {
        toast({
          variant: "destructive",
          title: "Repo not authorized",
          description:
            e instanceof ApiError
              ? e.message
              : "Your GitHub token doesn't cover this repository. Widen its access in Account → Connected Services.",
        });
        return;
      }
      toast({
        variant: "destructive",
        title: "PUSH FAILED",
        description: e instanceof ApiError ? e.message : "Could not push to GitHub.",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        data-testid="f8-github-push"
        className="gap-2 font-mono text-xs"
      >
        <Github className="h-3.5 w-3.5" />
        {result ? "ON GITHUB" : "PUSH TO GITHUB"}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (pending) return;
          // Reset the client-side visibility filter each time the dialog
          // closes so reopening it always starts on "All".
          if (!o) setVisibilityFilter("all");
          setOpen(o);
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wider flex items-center gap-2">
              <Github className="h-4 w-4" />
              Push codebase to GitHub
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {result
                ? "This bundle is linked to a GitHub repo. Commit the regenerated scaffold straight onto the default branch, or open a pull request to review the diff before it goes live."
                : targetMode === "existing"
                  ? "Pushes the CODE DJ scaffold (plus AGENTS.md and per-IDE adapter files) onto a repo you already created. Use this if your GitHub token only covers selected repos and can't create new ones."
                  : "Creates a new repo seeded with the CODE DJ scaffold plus AGENTS.md and per-IDE adapter files, so any IDE can clone and keep building in fidelity to the certified spec."}
            </DialogDescription>
          </DialogHeader>

          {result ? (
            <div className="space-y-3 py-2">
              <div className="font-mono text-xs text-muted-foreground">
                {result.created === false
                  ? "Pushed an update to "
                  : result.created === true
                    ? "Created and pushed to "
                    : "Linked to "}
                <span className="text-foreground font-bold">{result.repoFullName}</span>.
              </div>
              <div className="flex flex-col gap-2">
                <a
                  href={result.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-xs text-primary hover:underline"
                  data-testid="f8-github-repo-link"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View repo on GitHub
                </a>
                <a
                  href={result.replitImportUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-xs text-primary hover:underline"
                  data-testid="f8-github-replit-link"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open in Replit
                </a>
                {result.pullRequestUrl ? (
                  <a
                    href={result.pullRequestUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 font-mono text-xs text-primary hover:underline"
                    data-testid="f8-github-pr-link"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Review pull request
                  </a>
                ) : null}
              </div>

              <div className="flex items-center justify-between border-t border-border/50 pt-3">
                <div>
                  <Label className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Open as pull request
                  </Label>
                  <p className="font-mono text-[10px] text-muted-foreground/70">
                    {asPullRequest
                      ? "Pushes to a new branch and opens a PR to review before merging."
                      : "Commits straight onto the default branch."}
                  </p>
                </div>
                <Switch
                  checked={asPullRequest}
                  onCheckedChange={setAsPullRequest}
                  disabled={pending}
                  data-testid="f8-github-pr-mode"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={targetMode === "create" ? "default" : "outline"}
                  onClick={() => setTargetMode("create")}
                  disabled={pending}
                  className="font-mono text-[10px] uppercase tracking-wider"
                  data-testid="f8-github-mode-create"
                >
                  Create new repo
                </Button>
                <Button
                  type="button"
                  variant={targetMode === "existing" ? "default" : "outline"}
                  onClick={() => setTargetMode("existing")}
                  disabled={pending}
                  className="font-mono text-[10px] uppercase tracking-wider"
                  data-testid="f8-github-mode-existing"
                >
                  Use existing repo
                </Button>
              </div>

              {targetMode === "existing" ? (
                <div className="space-y-1.5">
                  <Label className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Existing repository
                  </Label>

                  {manualEntry ? (
                    <>
                      <Input
                        id="gh-target-repo"
                        value={targetRepo}
                        onChange={(e) => setTargetRepo(e.target.value)}
                        placeholder="my-org/my-existing-app"
                        maxLength={140}
                        className="font-mono text-xs"
                        data-testid="f8-github-target-repo"
                      />
                      <div className="flex items-center justify-between">
                        <p className="font-mono text-[10px] text-muted-foreground/70">
                          {reposError ??
                            "Type the repo as owner/repo. It must exist and be covered by your token."}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setManualEntry(false);
                            setReposError(null);
                            if (!reposLoaded) void loadRepos();
                          }}
                          disabled={pending}
                          className="shrink-0 font-mono text-[10px] text-primary hover:underline disabled:opacity-50"
                          data-testid="f8-github-pick-from-list"
                        >
                          Pick from list
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={pickerOpen}
                            disabled={pending || reposLoading}
                            className="w-full justify-between font-mono text-xs"
                            data-testid="f8-github-repo-picker"
                          >
                            <span className="flex items-center gap-1.5 truncate">
                              {reposLoading ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  Loading your repos…
                                </>
                              ) : targetRepo ? (
                                targetRepo
                              ) : (
                                <span className="text-muted-foreground">
                                  Select a repository…
                                </span>
                              )}
                            </span>
                            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[--radix-popover-trigger-width] p-0"
                          align="start"
                        >
                          <Command
                            filter={(value, search) =>
                              value.toLowerCase().includes(search.toLowerCase())
                                ? 1
                                : 0
                            }
                          >
                            <CommandInput
                              placeholder="Search repositories…"
                              className="font-mono text-xs"
                              data-testid="f8-github-repo-search"
                            />
                            <ToggleGroup
                              type="single"
                              value={visibilityFilter}
                              onValueChange={(v) =>
                                setVisibilityFilter(
                                  (v as "all" | "public" | "private") || "all",
                                )
                              }
                              className="justify-start gap-1 border-b border-border px-2 py-1.5"
                              data-testid="f8-github-visibility-filter"
                            >
                              <ToggleGroupItem
                                value="all"
                                size="sm"
                                className="h-6 px-2 font-mono text-[10px] uppercase tracking-wider"
                                data-testid="f8-github-visibility-all"
                              >
                                All
                              </ToggleGroupItem>
                              <ToggleGroupItem
                                value="public"
                                size="sm"
                                className="h-6 px-2 font-mono text-[10px] uppercase tracking-wider"
                                data-testid="f8-github-visibility-public"
                              >
                                Public
                              </ToggleGroupItem>
                              <ToggleGroupItem
                                value="private"
                                size="sm"
                                className="h-6 px-2 font-mono text-[10px] uppercase tracking-wider"
                                data-testid="f8-github-visibility-private"
                              >
                                Private
                              </ToggleGroupItem>
                            </ToggleGroup>
                            <CommandList>
                              <CommandEmpty className="font-mono text-xs">
                                No matching repositories.
                              </CommandEmpty>
                              <CommandGroup>
                                {visibleRepos.map((repo) => {
                                  const pushed = relativePushedAt(repo.pushedAt);
                                  return (
                                    <CommandItem
                                      key={repo.fullName}
                                      value={repo.fullName}
                                      onSelect={() => {
                                        setTargetRepo(repo.fullName);
                                        setPickerOpen(false);
                                      }}
                                      className="font-mono text-xs items-start"
                                      data-testid={`f8-github-repo-option-${repo.fullName}`}
                                    >
                                      <Check
                                        className={
                                          targetRepo === repo.fullName
                                            ? "mt-0.5 h-3.5 w-3.5 opacity-100"
                                            : "mt-0.5 h-3.5 w-3.5 opacity-0"
                                        }
                                      />
                                      <span className="flex min-w-0 flex-col gap-0.5">
                                        <span className="truncate">{repo.fullName}</span>
                                        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                                          <span>{repo.private ? "Private" : "Public"}</span>
                                          {pushed ? (
                                            <>
                                              <span aria-hidden>·</span>
                                              <span>Updated {pushed}</span>
                                            </>
                                          ) : null}
                                        </span>
                                      </span>
                                      {repo.private ? (
                                        <Lock className="ml-auto mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                                      ) : null}
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>

                      <div className="flex items-center justify-between">
                        <p className="font-mono text-[10px] text-muted-foreground/70">
                          {repos.length === 0 && reposLoaded
                            ? "No pushable repos found on your token."
                            : reposHasMore
                              ? "Showing your most recent repos. Can't find it? Enter it by hand."
                              : "The scaffold is committed onto the repo's default branch."}
                        </p>
                        <button
                          type="button"
                          onClick={() => setManualEntry(true)}
                          disabled={pending}
                          className="shrink-0 font-mono text-[10px] text-primary hover:underline disabled:opacity-50"
                          data-testid="f8-github-enter-manually"
                        >
                          Enter manually
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="gh-repo-name"
                      className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                    >
                      Repository name
                    </Label>
                    <Input
                      id="gh-repo-name"
                      value={repoName}
                      onChange={(e) => setRepoName(e.target.value)}
                      placeholder="my-new-app"
                      maxLength={100}
                      className="font-mono text-xs"
                      data-testid="f8-github-repo-name"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Private repository
                      </Label>
                      <p className="font-mono text-[10px] text-muted-foreground/70">
                        {isPrivate ? "Only the owner can see it." : "Anyone can see it."}
                      </p>
                    </div>
                    <Switch
                      checked={isPrivate}
                      onCheckedChange={setIsPrivate}
                      data-testid="f8-github-private"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            {result ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="font-mono text-xs"
                >
                  Close
                </Button>
                <Button
                  onClick={() => push("update")}
                  disabled={pending}
                  className="font-display tracking-wider gap-2"
                  data-testid="f8-github-push-update"
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Github className="h-4 w-4" />
                  )}
                  {pending
                    ? asPullRequest
                      ? "OPENING PR…"
                      : "PUSHING…"
                    : asPullRequest
                      ? "OPEN PULL REQUEST"
                      : "PUSH UPDATE"}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => push(targetMode)}
                disabled={
                  pending ||
                  (targetMode === "existing"
                    ? !targetRepo.trim().includes("/")
                    : !repoName.trim())
                }
                className="font-display tracking-wider gap-2"
                data-testid="f8-github-confirm"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Github className="h-4 w-4" />
                )}
                {pending
                  ? "PUSHING…"
                  : targetMode === "existing"
                    ? "PUSH TO REPO"
                    : "CREATE & PUSH"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
