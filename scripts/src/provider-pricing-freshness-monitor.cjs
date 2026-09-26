async function monitorProviderPricingFreshness({
  github,
  context,
  core,
  now = () => Date.now(),
  staleAfterDays = 10,
  staleAfterMs = staleAfterDays * 24 * 60 * 60 * 1000,
}) {
  if (
    !Number.isFinite(staleAfterDays) ||
    staleAfterDays <= 0 ||
    !Number.isFinite(staleAfterMs) ||
    staleAfterMs <= 0
  ) {
    throw new Error("Provider pricing freshness window is invalid.");
  }

  const { owner, repo } = context.repo;
  const { data: repository } = await github.rest.repos.get({ owner, repo });
  const defaultBranch = repository.default_branch;
  const workflowId = "provider-pricing.yml";

  let page = 1;
  let latestSuccess = null;
  while (!latestSuccess) {
    const { data } = await github.rest.actions.listWorkflowRuns({
      owner,
      repo,
      workflow_id: workflowId,
      branch: defaultBranch,
      status: "completed",
      per_page: 100,
      page,
    });
    latestSuccess =
      data.workflow_runs.find((run) => run.conclusion === "success") || null;
    if (
      latestSuccess ||
      data.workflow_runs.length === 0 ||
      page * 100 >= data.total_count
    ) {
      break;
    }
    page += 1;
  }

  const lastSuccessMs = latestSuccess
    ? Date.parse(latestSuccess.updated_at)
    : null;
  const isStale = !latestSuccess || now() - lastSuccessMs > staleAfterMs;
  const label = "provider-pricing-stale";
  let labelExists = true;
  try {
    await github.rest.issues.getLabel({ owner, repo, name: label });
  } catch (error) {
    if (error.status !== 404) throw error;
    labelExists = false;
  }

  if (isStale && !labelExists) {
    await github.rest.issues.createLabel({
      owner,
      repo,
      name: label,
      color: "B60205",
      description: "Scheduled provider pricing check has not succeeded recently",
    });
    labelExists = true;
  }

  if (!labelExists) {
    core.info(
      "No stale pricing alert exists and the latest successful run is within the freshness window.",
    );
    return;
  }

  const matching = await github.paginate(github.rest.issues.listForRepo, {
    owner,
    repo,
    state: "open",
    labels: label,
    per_page: 100,
  });
  const alerts = matching.filter((issue) => !issue.pull_request);
  const monitorUrl = `${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`;
  const priorSuccessMarker = alerts[0]?.body?.match(
    /<!-- provider-pricing-last-success:([^\s|]+)\|([^\s]+) -->/,
  );
  const lastSuccessInfo = latestSuccess
    ? { completedAt: latestSuccess.updated_at, url: latestSuccess.html_url }
    : priorSuccessMarker
      ? { completedAt: priorSuccessMarker[1], url: priorSuccessMarker[2] }
      : null;

  if (!isStale) {
    for (const issue of alerts) {
      await github.rest.issues.createComment({
        owner,
        repo,
        issue_number: issue.number,
        body: `The scheduled provider pricing workflow completed successfully within the ${staleAfterDays}-day freshness window. This stale-run alert is resolved.\n\nLast successful run: ${latestSuccess.html_url}\nMonitoring run: ${monitorUrl}`,
      });
      await github.rest.issues.update({
        owner,
        repo,
        issue_number: issue.number,
        state: "closed",
        state_reason: "completed",
      });
    }
    core.info(`Closed ${alerts.length} stale provider pricing alert(s).`);
    return;
  }

  const lastSuccessDetail = lastSuccessInfo
    ? `Last successful run: ${new Date(lastSuccessInfo.completedAt).toISOString()} — ${lastSuccessInfo.url}`
    : `Last successful run: none found on the default branch (${defaultBranch}).`;
  const body = [
    lastSuccessInfo
      ? `<!-- provider-pricing-last-success:${lastSuccessInfo.completedAt}|${lastSuccessInfo.url} -->`
      : "",
    `The scheduled provider pricing workflow has not completed successfully within the expected ${staleAfterDays}-day window.`,
    "",
    lastSuccessDetail,
    "",
    "**Next steps:**",
    "1. Check whether the Provider pricing review workflow is enabled in GitHub Actions.",
    "2. Review the failed or skipped run, or use **Run workflow** to start a check on the default branch.",
    "3. Confirm a successful run before closing this alert; a successful check will resolve it automatically.",
    "",
    `Monitoring run: ${monitorUrl}`,
  ].join("\n");
  const title = "Provider pricing check is stale";

  if (alerts.length > 0) {
    await github.rest.issues.update({
      owner,
      repo,
      issue_number: alerts[0].number,
      title,
      body,
    });
    core.info(`Updated stale provider pricing alert #${alerts[0].number}.`);
    for (const duplicate of alerts.slice(1)) {
      await github.rest.issues.update({
        owner,
        repo,
        issue_number: duplicate.number,
        state: "closed",
        state_reason: "completed",
      });
    }
  } else {
    const created = await github.rest.issues.create({
      owner,
      repo,
      title,
      body,
      labels: [label],
    });
    core.info(`Created stale provider pricing alert #${created.data.number}.`);
  }
}

module.exports = { monitorProviderPricingFreshness };