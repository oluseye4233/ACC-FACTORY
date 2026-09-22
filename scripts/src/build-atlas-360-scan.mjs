import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import {
  createTheme,
  NAVY,
  ACCENT,
  SOFT,
  GOLD,
  PHASE_COLOURS,
} from "./lib/atlas-pdf-theme.mjs";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const docsDir = path.join(repoRoot, "docs");
const exportsDir = path.join(repoRoot, "exports");
const outputName = "ATLAS_360_SCAN_ATANDA_Command_Centre_2026-09-21.pdf";
const outputPath = path.join(docsDir, outputName);
const exportPath = path.join(exportsDir, outputName);

fs.mkdirSync(docsDir, { recursive: true });
fs.mkdirSync(exportsDir, { recursive: true });

const doc = new PDFDocument({
  size: "A4",
  bufferPages: true,
  margins: { top: 54, bottom: 52, left: 54, right: 54 },
  info: {
    Title: "ATLAS 360 SCAN — ATANDA Command Centre",
    Author: "ATANDA Command Centre",
    Subject: "Repository-grounded engineering status report",
    Keywords: "ATLAS 360, SCAN, ATANDA, Command Centre, codebase status",
  },
});
const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);
const t = createTheme(doc);

function footer(pageNumber) {
  const page = doc.page;
  const y = page.height - 32;
  doc.save()
    .strokeColor("#d1d5db")
    .lineWidth(0.5)
    .moveTo(page.margins.left, y - 8)
    .lineTo(page.width - page.margins.right, y - 8)
    .stroke()
    .restore();
  doc.fillColor("#6b7280")
    .font("Helvetica")
    .fontSize(8)
    .text("ATLAS 360 SCAN  ·  ATANDA Command Centre", page.margins.left, y, {
      width: 280,
    });
  doc.text(`Draft status report  ·  21 September 2026  ·  ${pageNumber}`, 0, y, {
    align: "right",
    width: page.width - page.margins.right,
  });
}

// Cover
doc.rect(0, 0, doc.page.width, doc.page.height).fill("#f8fafc");
doc.save().fillColor(NAVY).rect(0, 0, doc.page.width, 168).fill().restore();
doc.save().fillColor(ACCENT).rect(0, 168, doc.page.width, 9).fill().restore();
doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(11)
  .text("ATLAS 360  /  SCAN", 54, 54, { characterSpacing: 2 });
doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(31)
  .text("ATANDA", 54, 92);
doc.fillColor("#d9f0f2").font("Helvetica").fontSize(16)
  .text("Command Centre", 54, 130);

doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(26)
  .text("Current Codebase Status", 54, 238, { width: 480 });
doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(13)
  .text("Repository-grounded engineering scan", 54, 279);
doc.fillColor("#374151").font("Helvetica").fontSize(11)
  .text(
    "A draft status report describing what is implemented, what is verified, what remains operationally unverified, and where the next evidence should come from.",
    54,
    319,
    { width: 465, lineGap: 4 },
  );

doc.save().fillColor("#e7f3f4").roundedRect(54, 412, 487, 104, 8).fill().restore();
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(10)
  .text("SCAN BASIS", 72, 434, { characterSpacing: 1.5 });
doc.fillColor("#374151").font("Helvetica").fontSize(10.5)
  .text(
    "Static repository inspection plus the current workspace typecheck and test runs. This is an engineering scan, not a certification, audit, production-readiness attestation, or traction report.",
    72,
    456,
    { width: 450, lineGap: 3 },
  );

doc.fillColor("#6b7280").font("Helvetica").fontSize(9)
  .text("Prepared 21 September 2026  ·  Internal working draft", 54, 728);

// Part 1
t.partHeader("PART 01", "Scan summary", PHASE_COLOURS.BLUE);
t.h1("What the repository shows");
t.lead(
  "ATANDA Command Centre is a substantial internal staff-tool monorepo with a working typed application surface, a tested API service, and a broad engine/workflow model. The strongest current evidence is code-level health; the weakest evidence is external and production operation.",
);
t.h2("Executive finding");
t.p(
  "The repository is in an implemented, actively exercised state rather than an empty prototype. The workspace currently carries a React/Vite Command Centre, an Express/Drizzle/Postgres API, generated OpenAPI client/server contracts, scripts, a mockup sandbox, scheduled jobs, Clerk authentication, Stripe integration seams, and AI integration adapters.",
);
t.p(
  "The present scan supports confidence that the codebase can typecheck and that its primary automated suites are passing. It does not support claims about production uptime, deployed configuration, security certification, real customer usage, payment activation, or the availability of external providers.",
);
t.h2("Evidence at a glance");
t.table(
  ["Signal", "Observed result", "Interpretation"],
  [
    ["Workspace typecheck", "PASS across 4 scoped packages", "No current TypeScript diagnostics in the checked workspace packages."],
    ["Command Centre tests", "15 files / 116 tests passed", "Frontend behavior has a meaningful automated baseline."],
    ["API server tests", "51 files / 416 tests passed", "The larger service surface is actively tested."],
    ["Repository scale", "≈959 source files / ≈119,870 physical source lines", "This is a large system; change impact and operations matter."],
    ["API and data surface", "127 OpenAPI paths / 43 schema files / 32 route files", "Contracts, persistence, and route coverage are broad."],
  ],
  [0.23, 0.27, 0.50],
);
t.h2("Status vocabulary used in this report");
t.kv([
  ["Verified", "Directly supported by repository inspection or the current workspace checks."],
  ["Implemented", "Present in code, without claiming that its live dependencies or deployment are healthy."],
  ["Risk", "A condition that can create operational, security, product, or evidence uncertainty."],
  ["Unavailable evidence", "Not provable from this repository snapshot and not inferred from code presence."],
]);

// Part 2
t.partHeader("PART 02", "System shape", PHASE_COLOURS.GREEN);
t.h1("Architecture and product surface");
t.p(
  "The current shape is a pnpm monorepo organized around a web Command Centre and API-backed engine workflows. It is designed for internal staff operation: the user interface exposes stage-oriented workspaces while the server owns authentication, authorization, persistence, provider calls, billing seams, background work, and domain rules.",
);
t.h2("Observed system boundaries");
t.table(
  ["Boundary", "Current reading", "Scan status"],
  [
    ["Command Centre", "React/Vite staff interface with F1–F8 stage surfaces and shared UI behavior.", "Implemented; typechecked and tested."],
    ["API server", "Express service with Drizzle/Postgres persistence, route handlers, provider adapters, and background concerns.", "Implemented; typechecked and tested."],
    ["Contracts", "OpenAPI-driven API surface with generated client/server artifacts.", "Broad; contract drift remains an ongoing engineering risk."],
    ["Identity", "Clerk-based authentication and staff-oriented access model.", "Code path present; live tenant/config not verified."],
    ["Commercial seams", "Stripe integration and subscription/credit controls exist behind reversible feature decisions.", "Code path present; live billing behavior not verified."],
    ["AI providers", "Replit-managed AI integration adapters are represented in the workspace.", "Code path present; provider availability and quotas not verified."],
    ["Operations", "Scheduled jobs, deployment workflows, GitHub sync, and preview services are configured in the workspace.", "Configured here; production execution not verified."],
  ],
  [0.20, 0.55, 0.25],
);
t.h2("ATLAS phase/status matrix");
t.p(
  "This matrix is a scan overlay to organize evidence, not a product certification. It describes the repository’s visible implementation posture at the time of the scan.",
);
t.phaseBlock({
  colourName: "RED",
  header: "Foundation",
  duration: "present",
  status: "Implemented",
  deliverables: ["Monorepo structure", "Typed packages", "Shared scripts and workspace workflows"],
  exit: "Repository can be installed, typechecked, and exercised in the current workspace.",
});
t.phaseBlock({
  colourName: "ORANGE",
  header: "Identity and access",
  duration: "present",
  status: "Implemented / live evidence pending",
  deliverables: ["Clerk auth integration", "Staff access paths", "Server-side authorization checks"],
  exit: "Production tenant, roles, and failure paths are verified against the deployed environment.",
});
t.phaseBlock({
  colourName: "YELLOW",
  header: "Core engine surfaces",
  duration: "present",
  status: "Implemented",
  deliverables: ["F1–F8 stage workspaces", "Engine orchestration", "Stage gating and output flows"],
  exit: "Representative journeys are verified end-to-end with production-like dependencies.",
});
t.phaseBlock({
  colourName: "GREEN",
  header: "Persistence and delivery",
  duration: "present",
  status: "Implemented / operational evidence pending",
  deliverables: ["Drizzle/Postgres schema", "OpenAPI routes", "Background and delivery seams"],
  exit: "Migration, retry, alert, and delivery behavior is observed under deployed operating conditions.",
});

// Part 3
t.partHeader("PART 03", "Evidence and risk", PHASE_COLOURS.ORANGE);
t.h1("What is proven, and what is not");
t.h2("Verified in the current workspace");
t.bullets([
  "The repository typechecks across the checked libraries, API server, Command Centre, mockup sandbox, and scripts.",
  "The Command Centre suite passes 15 test files and 116 tests.",
  "The API server suite passes 51 test files and 416 tests.",
  "The codebase has a broad, structured surface: approximately 959 source files, 119,870 physical source lines, 127 OpenAPI paths, 43 database schema files, and 32 API route files.",
  "The shared ATLAS PDF theme is available and is used by this report, keeping the visual system consistent with existing ATLAS documents.",
]);
t.h2("Implemented but not established as live evidence");
t.bullets([
  "Clerk authentication and staff authorization are represented in code; this scan does not verify production tenant settings, role assignments, or real login completion.",
  "Stripe and subscription/credit logic are represented; this scan does not verify live-mode products, webhook delivery, payment outcomes, or reconciliation.",
  "Provider and AI integrations are represented; this scan does not verify credentials, quotas, rate limits, latency, or provider-side availability.",
  "Scheduled jobs and deployment workflows are configured in the workspace; this scan does not verify production scheduling, private/public deployment behavior, or alert delivery.",
  "Database migrations and persistence paths are represented; this scan does not establish production schema parity, backup posture, restore time, or data quality.",
]);
t.h2("Unavailable from this scan");
t.table(
  ["Evidence category", "Why it remains open", "Next evidence"],
  [
    ["Production health", "No production telemetry or deployment run was used for this report.", "Deployed smoke run plus error/latency baseline."],
    ["Security assurance", "Passing tests and typechecks are not a security assessment.", "Threat model, dependency/SAST review, and focused authorization tests."],
    ["Business traction", "Repository contents do not prove users, revenue, conversion, or retention.", "Product analytics and verified business reporting."],
    ["External integrations", "Code paths do not prove current credentials or provider behavior.", "Controlled integration checks with redacted results."],
    ["Operational resilience", "Retry code is not the same as observed recovery.", "Failure injection, queue/retry metrics, and incident evidence."],
  ],
  [0.23, 0.43, 0.34],
);

// Part 4
t.partHeader("PART 04", "Priority actions", PHASE_COLOURS.VIOLET);
t.h1("Recommended next evidence");
t.lead(
  "The highest-value next step is not more repository scale. It is closing the gap between implemented code and observed operation.",
);
t.h2("Priority 1 — establish a production evidence pack");
t.p(
  "Capture a repeatable, redacted smoke run covering staff sign-in, one representative stage journey, persistence, provider calls, and the principal delivery path. Record deployment revision, environment, timestamps, outcome, and links to the relevant logs.",
);
t.h2("Priority 2 — prove the control surfaces");
t.bullets([
  "Run focused authorization checks for staff-only routes, stage unlocks, and server-side enforcement.",
  "Verify webhook signatures, idempotency, retry behavior, and failure alerting with controlled test events.",
  "Confirm migration parity and a documented rollback/restore procedure against the deployed database.",
]);
t.h2("Priority 3 — keep the evidence current");
t.bullets([
  "Keep typecheck and test results attached to the change or release that they describe.",
  "Track external integration checks separately from unit tests so provider outages are not confused with code regressions.",
  "Use the existing stage cockpit and ATLAS overlays as communication aids, while keeping certification claims tied to explicit evidence.",
]);
t.h2("Scan conclusion");
doc.save().fillColor("#f2f7f8").roundedRect(54, doc.y, 487, 126, 8).fill().restore();
const conclusionY = doc.y + 17;
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(13)
  .text("Conclusion: implemented and test-backed, operationally open", 72, conclusionY);
doc.fillColor("#374151").font("Helvetica").fontSize(10.5)
  .text(
    "The repository supports a credible engineering-status claim: ATANDA Command Centre is a substantial, typed, tested internal platform with broad product and service surfaces. The responsible next claim requires production evidence, security review, and verified external integrations. This draft intentionally stops at the boundary of what the repository can prove.",
    72,
    conclusionY + 27,
    { width: 450, lineGap: 3.5 },
  );
doc.y = conclusionY + 99;
t.hr();
doc.fillColor(SOFT).font("Helvetica-Oblique").fontSize(9)
  .text("End of draft scan  ·  Source basis: repository snapshot and current workspace verification", {
    lineGap: 2,
  });

const pageRange = doc.bufferedPageRange();
for (let i = pageRange.start; i < pageRange.start + pageRange.count; i += 1) {
  doc.switchToPage(i);
  footer(i + 1);
}

doc.end();

await new Promise((resolve, reject) => {
  stream.once("finish", resolve);
  stream.once("error", reject);
});
fs.copyFileSync(outputPath, exportPath);
console.log(`Wrote ${outputPath}`);
console.log(`Copied ${exportPath}`);