async function syncProviderPricingReviewIssue({ github, context, core, env }) {
  const result = env.CHECK_RESULT;
  if (!["ok", "needs_review"].includes(result)) {
    core.setFailed(
      `Pricing check did not produce a result (received: ${result || "none"}).`,
    );
    return;
  }

  const { owner, repo } = context.repo;
  if (result === "ok") {
    const staleLabel = "provider-pricing-stale";
    let staleLabelExists = true;
    try {
      await github.rest.issues.getLabel({ owner, repo, name: staleLabel });
    } catch (error) {
      if (error.status !== 404) throw error;
      staleLabelExists = false;
    }

    if (staleLabelExists) {
      const staleIssues = await github.paginate(github.rest.issues.listForRepo, {
        owner,
        repo,
        state: "open",
        labels: staleLabel,
        per_page: 100,
      });
      for (const issue of staleIssues.filter((item) => !item.pull_request)) {
        await github.rest.issues.createComment({
          owner,
          repo,
          issue_number: issue.number,
          body: `The provider pricing workflow completed a successful check, resolving this stale-run alert.\n\nRun: ${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`,
        });
        await github.rest.issues.update({
          owner,
          repo,
          issue_number: issue.number,
          state: "closed",
          state_reason: "completed",
        });
      }
      core.info(`Closed ${staleIssues.length} stale provider pricing alert(s).`);
    }
  }

  const label = "provider-pricing-review";
  let labelExists = true;
  try {
    await github.rest.issues.getLabel({ owner, repo, name: label });
  } catch (error) {
    if (error.status !== 404) throw error;
    labelExists = false;
  }

  if (result === "ok" && !labelExists) {
    core.info(
      "No provider pricing review label exists; no open alert can need closing.",
    );
    return;
  }
  if (!labelExists) {
    await github.rest.issues.createLabel({
      owner,
      repo,
      name: label,
      color: "D93F0B",
      description: "Official provider pricing source requires human review",
    });
  }

  const matching = await github.paginate(github.rest.issues.listForRepo, {
    owner,
    repo,
    state: "open",
    labels: label,
    per_page: 100,
  });
  const openAlerts = matching
    .filter((issue) => !issue.pull_request)
    .sort((left, right) => left.number - right.number);
  const runUrl = `${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`;

  if (result === "ok") {
    for (const issue of openAlerts) {
      await github.rest.issues.createComment({
        owner,
        repo,
        issue_number: issue.number,
        body: `A successful provider pricing check verified all configured sources against their reviewed fingerprints. No production prices were changed.\n\nRun: ${runUrl}`,
      });
      await github.rest.issues.update({
        owner,
        repo,
        issue_number: issue.number,
        state: "closed",
        state_reason: "completed",
      });
    }
    core.info(
      `Closed ${openAlerts.length} open provider pricing review issue(s).`,
    );
    return;
  }

  let report;
  try {
    report = JSON.parse(
      Buffer.from(env.CHECK_REPORT || "", "base64").toString("utf8"),
    );
  } catch (error) {
    core.setFailed(`Could not read the pricing check report: ${error.message}`);
    return;
  }
  const detail = (report.sources || []).map((source) => {
    const models =
      (source.modelIds || []).join(", ") || "review for new or retired models";
    if (source.status === "changed") {
      const missing = source.missingModels?.length
        ? `\nConfigured model mentions no longer found: ${source.missingModels.join(", ")}.`
        : "";
      return [
        `### Source changed: ${source.id} (${source.provider})`,
        `- Models: ${models}`,
        `- Official source: ${source.url}`,
        `- Reviewed fingerprint: \`${source.reviewedHash || "(none recorded)"}\``,
        `- Current fingerprint: \`${source.currentHash}\`${missing}`,
      ].join("\n");
    }
    return [
      `### Source could not be verified: ${source.id} (${source.provider})`,
      `- Models: ${models}`,
      `- Official source: ${source.url}`,
      `- Error: ${source.error || "Unknown fetch or validation error"}`,
    ].join("\n");
  });
  if (report.fatalError) {
    detail.push(`### Pricing check could not complete\n${report.fatalError}`);
  }

  const body = [
    "The weekly check found official provider pricing sources that need human attention.",
    "",
    ...detail,
    "",
    "**Review guidance:** A changed page fingerprint is a signal to inspect the source; it does not prove that a rate changed. An unavailable source must be verified when the provider site is reachable again.",
    "",
    "**Next steps:**",
    "1. Open each linked official source and review model availability, prices, and billing rules.",
    "2. If a source change is acceptable, update only its reviewed fingerprint with `pnpm --filter @workspace/scripts run check-provider-pricing -- --accept-current` and submit that change for review.",
    "3. Change production prices only in a separate, explicitly reviewed code change.",
    "",
    `Workflow run: ${runUrl}`,
    `Triggered by: ${context.eventName}`,
  ].join("\n");
  const title = "Provider pricing sources need review";
  const issue = openAlerts[0];
  if (issue) {
    await github.rest.issues.update({
      owner,
      repo,
      issue_number: issue.number,
      title,
      body,
    });
    core.info(`Updated provider pricing review issue #${issue.number}.`);
  } else {
    const created = await github.rest.issues.create({
      owner,
      repo,
      title,
      body,
      labels: [label],
    });
    core.info(`Created provider pricing review issue #${created.data.number}.`);
  }

  for (const duplicate of openAlerts.slice(1)) {
    await github.rest.issues.update({
      owner,
      repo,
      issue_number: duplicate.number,
      state: "closed",
      state_reason: "completed",
    });
    core.info(
      `Closed duplicate provider pricing review issue #${duplicate.number}.`,
    );
  }
}

module.exports = { syncProviderPricingReviewIssue };
