import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";

import { inspectSources } from "./check-provider-pricing.mjs";

const require = createRequire(import.meta.url);
const {
  syncProviderPricingReviewIssue,
} = require("./provider-pricing-issue-lifecycle.cjs");
const {
  monitorProviderPricingFreshness,
} = require("./provider-pricing-freshness-monitor.cjs");

function source(id, overrides = {}) {
  return {
    id,
    provider: id,
    url: `https://example.com/${id}`,
    modelIds: [`${id}-model`],
    sha256: "0".repeat(64),
    ...overrides,
  };
}

function htmlResponse(url, html, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    text: async () => html,
  };
}

function fingerprint(normalizedText) {
  return createHash("sha256").update(normalizedText, "utf8").digest("hex");
}

test("source inspection reports matching, changed, and unavailable sources independently", async () => {
  const matchingHtml = "<html><body>model-a pricing $1</body></html>";
  const changedHtml = "<html><body>model-b pricing $2</body></html>";
  const sources = [
    source("matching", {
      modelIds: ["model-a"],
      sha256: fingerprint("model-a pricing $1"),
    }),
    source("changed", {
      modelIds: ["model-b"],
      sha256: fingerprint("model-b pricing $1"),
    }),
    source("unavailable"),
  ];

  const results = await inspectSources(sources, async (url) => {
    if (url.endsWith("/matching")) return htmlResponse(url, matchingHtml);
    if (url.endsWith("/changed")) return htmlResponse(url, changedHtml);
    throw new Error("provider timed out");
  });

  assert.deepEqual(
    results.map(({ status }) => status),
    ["ok", "changed", "unavailable"],
  );
  assert.equal(results[1].currentHash, fingerprint("model-b pricing $2"));
  assert.match(results[2].error, /provider timed out/);
});

test("a missing configured model mention is a source change, not a source outage", async () => {
  const modelSource = source("model-removal", {
    modelIds: ["retired-model"],
  });

  const [result] = await inspectSources([modelSource], async (url) =>
    htmlResponse(url, "<html><body>Current pricing table</body></html>"),
  );

  assert.equal(result.status, "changed");
  assert.deepEqual(result.missingModels, ["retired-model"]);
  assert.equal(result.error, undefined);
});

test("non-success HTTP responses are reported as unavailable", async () => {
  const [result] = await inspectSources([source("http-error")], async (url) =>
    htmlResponse(url, "temporarily unavailable", 503),
  );

  assert.equal(result.status, "unavailable");
  assert.match(result.error, /HTTP 503/);
});

function issue(number, overrides = {}) {
  return {
    number,
    title: "Provider pricing sources need review",
    body: "Previous report",
    state: "open",
    labels: [{ name: "provider-pricing-review" }],
    ...overrides,
  };
}

function mockGitHub(initialIssues = []) {
  const issues = initialIssues;
  const comments = [];
  const calls = [];
  const labels = new Set(
    issues.flatMap((item) => item.labels.map(({ name }) => name)),
  );
  let nextIssueNumber = Math.max(0, ...issues.map(({ number }) => number)) + 1;
  const issueApi = {
    getLabel: async ({ name }) => {
      calls.push({ method: "getLabel", name });
      if (!labels.has(name)) {
        const error = new Error("Not Found");
        error.status = 404;
        throw error;
      }
    },
    createLabel: async (input) => {
      calls.push({ method: "createLabel", input });
      labels.add(input.name);
    },
    listForRepo: async (input) => {
      calls.push({ method: "listForRepo", input });
      return {
        data: issues.filter(
          (item) =>
            item.state === input.state &&
            item.labels.some(({ name }) => name === input.labels),
        ),
      };
    },
    createComment: async (input) => {
      calls.push({ method: "createComment", input });
      comments.push(input);
    },
    update: async (input) => {
      calls.push({ method: "update", input });
      const existing = issues.find(
        ({ number }) => number === input.issue_number,
      );
      Object.assign(existing, input);
      return { data: existing };
    },
    create: async (input) => {
      calls.push({ method: "create", input });
      const created = issue(nextIssueNumber++, {
        title: input.title,
        body: input.body,
        labels: input.labels.map((name) => ({ name })),
      });
      issues.push(created);
      return { data: created };
    },
  };

  return {
    issues,
    comments,
    calls,
    github: {
      rest: { issues: issueApi },
      paginate: async (method, input) => (await method(input)).data,
    },
  };
}

function workflowContext(runId) {
  return {
    repo: { owner: "example-owner", repo: "example-repo" },
    serverUrl: "https://github.com",
    runId,
    eventName: "schedule",
  };
}

function checkEnv(result, report = { sources: [] }) {
  return {
    CHECK_RESULT: result,
    CHECK_REPORT: Buffer.from(JSON.stringify(report), "utf8").toString(
      "base64",
    ),
  };
}

function testCore() {
  return {
    failures: [],
    setFailed(message) {
      this.failures.push(message);
    },
    info() {},
  };
}

function freshnessContext(runId) {
  return {
    repo: { owner: "example-owner", repo: "example-repo" },
    serverUrl: "https://github.com",
    runId,
  };
}

function mockFreshnessGitHub({ issues = [], runs = [] } = {}) {
  const mock = mockGitHub(issues);
  const calls = mock.calls;
  mock.github.rest.repos = {
    get: async (input) => {
      calls.push({ method: "getRepository", input });
      return { data: { default_branch: "main" } };
    },
  };
  mock.github.rest.actions = {
    listWorkflowRuns: async (input) => {
      calls.push({ method: "listWorkflowRuns", input });
      const pageRuns = runs[input.page - 1] || [];
      return {
        data: {
          workflow_runs: pageRuns,
          total_count: runs.reduce((count, page) => count + page.length, 0),
        },
      };
    },
  };
  return mock;
}

function pricingRun(conclusion, updatedAt, id = 1) {
  return {
    id,
    conclusion,
    updated_at: updatedAt,
    html_url: `https://github.com/example-owner/example-repo/actions/runs/${id}`,
  };
}

test("repeated pricing failures refresh one alert and a clean reviewed run closes it", async () => {
  const mock = mockGitHub();
  const core = testCore();
  const unavailableReport = {
    sources: [
      {
        id: "provider-a",
        provider: "Provider A",
        url: "https://example.com/pricing",
        status: "unavailable",
        error: "temporary outage",
        modelIds: ["model-a"],
      },
    ],
  };

  await syncProviderPricingReviewIssue({
    github: mock.github,
    context: workflowContext(101),
    core,
    env: checkEnv("needs_review", unavailableReport),
  });
  const [alert] = mock.issues;
  assert.ok(alert);
  const alertNumber = alert.number;
  assert.match(alert.body, /actions\/runs\/101/);

  await syncProviderPricingReviewIssue({
    github: mock.github,
    context: workflowContext(102),
    core,
    env: checkEnv("needs_review", unavailableReport),
  });
  assert.equal(mock.issues.length, 1);
  assert.equal(alert.number, alertNumber);
  assert.equal(alert.state, "open");
  assert.match(alert.body, /actions\/runs\/102/);
  assert.doesNotMatch(alert.body, /actions\/runs\/101/);

  await syncProviderPricingReviewIssue({
    github: mock.github,
    context: workflowContext(103),
    core,
    env: checkEnv("ok"),
  });
  assert.equal(alert.state, "closed");
  assert.ok(
    mock.comments.some(
      ({ issue_number, body }) =>
        issue_number === alertNumber &&
        /No production prices were changed/.test(body) &&
        /actions\/runs\/103/.test(body),
    ),
  );
  assert.equal(
    mock.calls.filter(({ method }) => method === "create").length,
    1,
  );
  assert.deepEqual(core.failures, []);
});

test("freshness monitor creates an alert when no successful pricing run exists", async () => {
  const mock = mockFreshnessGitHub({
    runs: [[pricingRun("failure", "2026-09-20T12:00:00.000Z")]],
  });

  await monitorProviderPricingFreshness({
    github: mock.github,
    context: freshnessContext(301),
    core: testCore(),
    now: () => Date.parse("2026-09-26T12:00:00.000Z"),
  });

  assert.equal(mock.issues.length, 1);
  assert.equal(mock.issues[0].state, "open");
  assert.match(mock.issues[0].body, /Last successful run: none found on the default branch \(main\)/);
  assert.equal(
    mock.calls.filter(({ method }) => method === "create").length,
    1,
  );
});

test("freshness monitor includes an over-age successful run in the alert", async () => {
  const oldRun = pricingRun("success", "2026-09-01T12:00:00.000Z", 302);
  const mock = mockFreshnessGitHub({ runs: [[oldRun]] });

  await monitorProviderPricingFreshness({
    github: mock.github,
    context: freshnessContext(303),
    core: testCore(),
    now: () => Date.parse("2026-09-26T12:00:00.000Z"),
  });

  assert.match(mock.issues[0].body, /Last successful run: 2026-09-01T12:00:00.000Z/);
  assert.match(mock.issues[0].body, new RegExp(oldRun.html_url));
  assert.match(mock.issues[0].body, /provider-pricing-last-success:/);
});

test("freshness monitor applies the cadence-derived stale window", async () => {
  const runFiveDaysAgo = pricingRun(
    "success",
    "2026-09-21T12:00:00.000Z",
    303,
  );
  const mock = mockFreshnessGitHub({ runs: [[runFiveDaysAgo]] });

  await monitorProviderPricingFreshness({
    github: mock.github,
    context: freshnessContext(304),
    core: testCore(),
    now: () => Date.parse("2026-09-26T12:00:00.000Z"),
    staleAfterDays: 4,
    staleAfterMs: 4 * 24 * 60 * 60 * 1000,
  });

  assert.match(mock.issues[0].body, /expected 4-day window/);
  assert.equal(mock.issues[0].state, "open");
});

test("freshness monitor searches older run pages for the last successful check", async () => {
  const newestRuns = Array.from({ length: 100 }, (_, index) =>
    pricingRun("failure", "2026-09-25T12:00:00.000Z", 400 + index),
  );
  const oldSuccess = pricingRun(
    "success",
    "2026-09-01T12:00:00.000Z",
    500,
  );
  const mock = mockFreshnessGitHub({ runs: [newestRuns, [oldSuccess]] });

  await monitorProviderPricingFreshness({
    github: mock.github,
    context: freshnessContext(501),
    core: testCore(),
    now: () => Date.parse("2026-09-26T12:00:00.000Z"),
  });

  assert.equal(
    mock.calls.filter(({ method }) => method === "listWorkflowRuns").length,
    2,
  );
  assert.match(mock.issues[0].body, new RegExp(oldSuccess.html_url));
});

test("repeated freshness checks update the same alert and recovery closes it", async () => {
  const oldRun = pricingRun("success", "2026-09-01T12:00:00.000Z", 304);
  const mock = mockFreshnessGitHub({ runs: [[oldRun]] });
  const core = testCore();

  await monitorProviderPricingFreshness({
    github: mock.github,
    context: freshnessContext(305),
    core,
    now: () => Date.parse("2026-09-26T12:00:00.000Z"),
  });
  const [alert] = mock.issues;
  const alertNumber = alert.number;

  await monitorProviderPricingFreshness({
    github: mock.github,
    context: freshnessContext(306),
    core,
    now: () => Date.parse("2026-09-26T12:00:00.000Z"),
  });
  assert.equal(mock.issues.length, 1);
  assert.equal(alert.number, alertNumber);
  assert.equal(alert.state, "open");
  assert.match(alert.body, /actions\/runs\/306/);
  assert.equal(
    mock.calls.filter(({ method }) => method === "create").length,
    1,
  );

  mock.github.rest.actions.listWorkflowRuns = async (input) => {
    mock.calls.push({ method: "listWorkflowRuns", input });
    return {
      data: {
        workflow_runs: [
          pricingRun("success", "2026-09-25T12:00:00.000Z", 307),
        ],
        total_count: 1,
      },
    };
  };
  await monitorProviderPricingFreshness({
    github: mock.github,
    context: freshnessContext(308),
    core,
    now: () => Date.parse("2026-09-26T12:00:00.000Z"),
  });

  assert.equal(alert.state, "closed");
  assert.ok(
    mock.comments.some(
      ({ issue_number, body }) =>
        issue_number === alertNumber &&
        /This stale-run alert is resolved/.test(body) &&
        /actions\/runs\/307/.test(body),
    ),
  );
  assert.deepEqual(core.failures, []);
});

test("freshness monitor preserves the last-success link after Actions expires the run", async () => {
  const completedAt = "2026-09-01T12:00:00.000Z";
  const lastRunUrl =
    "https://github.com/example-owner/example-repo/actions/runs/309";
  const staleAlert = issue(21, {
    title: "Provider pricing check is stale",
    body: [
      `<!-- provider-pricing-last-success:${completedAt}|${lastRunUrl} -->`,
      "Previous stale alert body",
    ].join("\n"),
    labels: [{ name: "provider-pricing-stale" }],
  });
  const mock = mockFreshnessGitHub({ issues: [staleAlert], runs: [[]] });

  await monitorProviderPricingFreshness({
    github: mock.github,
    context: freshnessContext(310),
    core: testCore(),
    now: () => Date.parse("2026-09-26T12:00:00.000Z"),
  });

  assert.equal(staleAlert.state, "open");
  assert.match(staleAlert.body, new RegExp(lastRunUrl));
  assert.match(staleAlert.body, new RegExp(completedAt));
  assert.equal(
    mock.calls.filter(({ method }) => method === "listWorkflowRuns").length,
    1,
  );
});

test("a successful pricing check closes a stale-run alert", async () => {
  const staleAlert = issue(15, {
    title: "Provider pricing check is stale",
    labels: [{ name: "provider-pricing-stale" }],
  });
  const mock = mockGitHub([staleAlert]);
  const core = testCore();

  await syncProviderPricingReviewIssue({
    github: mock.github,
    context: workflowContext(104),
    core,
    env: checkEnv("ok"),
  });

  assert.equal(staleAlert.state, "closed");
  assert.ok(
    mock.comments.some(
      ({ issue_number, body }) =>
        issue_number === staleAlert.number &&
        /resolving this stale-run alert/.test(body) &&
        /actions\/runs\/104/.test(body),
    ),
  );
  assert.equal(
    mock.calls.filter(
      ({ method, input }) =>
        method === "update" &&
        input.issue_number === staleAlert.number &&
        input.state === "closed",
    ).length,
    1,
  );
  assert.deepEqual(core.failures, []);
});

test("existing duplicate alerts consolidate around the same issue on later failures", async () => {
  const mock = mockGitHub([issue(12), issue(7)]);
  const core = testCore();
  const report = {
    sources: [
      {
        id: "provider-b",
        provider: "Provider B",
        url: "https://example.com/provider-b",
        status: "changed",
        currentHash: "new-fingerprint",
        reviewedHash: "old-fingerprint",
        modelIds: ["model-b"],
        addedModels: ["model-b-new"],
        retiredModels: ["model-b-retired"],
        addedModelRates: [
          {
            modelId: "model-b-new",
            field: "inputPerMTok",
            current: 2,
            formattedCurrent: "2 USD",
          },
        ],
        rateChanges: [
          {
            modelId: "model-b",
            field: "inputPerMTok",
            previous: 1,
            current: 1.5,
            formattedPrevious: "1 USD",
            formattedCurrent: "1.5 USD",
          },
        ],
      },
    ],
  };

  await syncProviderPricingReviewIssue({
    github: mock.github,
    context: workflowContext(201),
    core,
    env: checkEnv("needs_review", report),
  });
  assert.equal(mock.issues.find(({ number }) => number === 7).state, "open");
  assert.equal(mock.issues.find(({ number }) => number === 12).state, "closed");
  assert.match(
    mock.issues.find(({ number }) => number === 7).body,
    /actions\/runs\/201/,
  );
  assert.match(
    mock.issues.find(({ number }) => number === 7).body,
    /Newly listed models: model-b-new/,
  );
  assert.match(
    mock.issues.find(({ number }) => number === 7).body,
    /Retired models: model-b-retired/,
  );
  assert.match(
    mock.issues.find(({ number }) => number === 7).body,
    /Rate change: model-b inputPerMTok: 1 USD -> 1.5 USD/,
  );

  await syncProviderPricingReviewIssue({
    github: mock.github,
    context: workflowContext(202),
    core,
    env: checkEnv("needs_review", report),
  });
  assert.equal(mock.issues.length, 2);
  assert.equal(mock.issues.find(({ number }) => number === 7).state, "open");
  assert.equal(mock.issues.find(({ number }) => number === 12).state, "closed");
  assert.match(
    mock.issues.find(({ number }) => number === 7).body,
    /actions\/runs\/202/,
  );
  assert.equal(
    mock.calls.filter(({ method }) => method === "create").length,
    0,
  );
  assert.deepEqual(core.failures, []);
});
