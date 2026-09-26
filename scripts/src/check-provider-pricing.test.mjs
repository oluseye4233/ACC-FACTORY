import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";

import { inspectSources } from "./check-provider-pricing.mjs";

const require = createRequire(import.meta.url);
const {
  syncProviderPricingReviewIssue,
} = require("./provider-pricing-issue-lifecycle.cjs");

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
