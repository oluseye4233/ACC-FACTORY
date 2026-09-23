// Generates the current repository-grounded ATLAS 360 SCAN PDD.

import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import {
  createTheme,
  NAVY,
  ACCENT,
  SOFT,
  PHASE_COLOURS,
} from "./lib/atlas-pdf-theme.mjs";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const docsDir = path.join(repoRoot, "docs");
const exportsDir = path.join(repoRoot, "exports");
const outputName = "ATLAS_360_SCAN_ATANDA_Command_Centre_2026-09-23.pdf";
const outputPath = path.join(docsDir, outputName);
const exportPath = path.join(exportsDir, outputName);

fs.mkdirSync(docsDir, { recursive: true });
fs.mkdirSync(exportsDir, { recursive: true });

const doc = new PDFDocument({
  size: "A4",
  bufferPages: true,
  margins: { top: 54, bottom: 52, left: 54, right: 54 },
  info: {
    Title: "ATLAS 360 SCAN PDD — ATANDA Command Centre — Current State",
    Author: "ATANDA Command Centre",
    Subject: "Current repository-grounded assurance scan",
    Keywords: "ATLAS 360, SCAN, PDD, ATANDA, Command Centre, assurance",
  },
});
const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);
const t = createTheme(doc);

function cover() {
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
    .text("Current State PDD", 54, 238, { width: 480 });
  doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(13)
    .text("Repository-grounded assurance scan", 54, 279);
  doc.fillColor("#374151").font("Helvetica").fontSize(11)
    .text(
      "A current-state scan of the ACC product surface, F-process implementation, evidence posture, and remaining operational boundaries.",
      54, 319, { width: 465, lineGap: 4 },
    );
  doc.save().fillColor("#e7f3f4").roundedRect(54, 412, 487, 116, 8).fill().restore();
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(10)
    .text("SCAN BASIS", 72, 434, { characterSpacing: 1.5 });
  doc.fillColor("#374151").font("Helvetica").fontSize(10.5)
    .text(
      "Repository inspection, current generated contracts, focused F8/F9 tests, Command Centre UI tests, typecheck, and workflow startup. This is an assurance PDD, not a certification, security audit, production-readiness attestation, or traction report.",
      72, 456, { width: 450, lineGap: 3 },
    );
  doc.fillColor(SOFT).font("Helvetica").fontSize(9)
    .text("Prepared 23 September 2026 · America/Chicago · Current working draft", 54, 728);
}

function footer(i) {
  const y = doc.page.height - 32;
  doc.save().strokeColor("#d1d5db").lineWidth(0.5)
    .moveTo(doc.page.margins.left, y - 8)
    .lineTo(doc.page.width - doc.page.margins.right, y - 8)
    .stroke().restore();
  doc.fillColor("#6b7280").font("Helvetica").fontSize(8)
    .text("ATLAS 360 SCAN  ·  ATANDA Command Centre", doc.page.margins.left, y, { width: 280 });
  doc.text(`Current state draft  ·  23 September 2026  ·  ${i}`, 0, y, {
    align: "right", width: doc.page.width - doc.page.margins.right,
  });
}

cover();

t.partHeader("PART 01", "Scan summary", PHASE_COLOURS.BLUE);
t.h1("Current reading");
t.lead(
  "ATANDA Command Centre is an implemented, typed, tested internal operations platform whose strongest evidence is its code and workspace verification; its weakest evidence remains external operation and provider readiness.",
);
t.p(
  "The current product surface includes the staff-gated Command Centre, persistent sessions and artifacts, the F1–F7 PromptWare rail, ATLAS 360 PLAN/SCAN views, F8 Code ORACLE, F9 MECHA Machine Floor, F9.5 OSIRIS custody, F10 release/colonization controls, F11 Host Connector, acquisition tools, Exemplar and SPC Player workflows, cost/activity views, and administrative operations surfaces.",
);
t.h2("Evidence at this scan");
t.table(
  ["Signal", "Current observation", "Reading"],
  [
    ["Workspace typecheck", "PASS across checked workspace packages", "No current TypeScript diagnostics in the checked packages."],
    ["Command Centre focused suite", "17 files / 146 tests passed", "The UI and session routing have an active automated baseline."],
    ["API F8/F9 focused suite", "3 files / 12 tests passed", "The current code-generation, Machine Floor, and F9→F10 path has focused regression coverage."],
    ["Serving workflows", "API and web workflows restarted successfully", "Development services built and listened after the current changes."],
    ["Contract surface", "OpenAPI-generated client and Zod artifacts include hardware profile fields", "Contract-first changes are reflected in generated consumers."],
  ],
  [0.22, 0.38, 0.40],
);
t.h2("Honesty gate");
t.kv([
  ["Verified", "Directly supported by repository inspection or the current workspace checks."],
  ["Implemented", "Present in code, without claiming that live dependencies or production settings are healthy."],
  ["Reference baseline", "A design aid or profile that does not establish certification."],
  ["Open evidence", "A claim that needs deployment, external gate, provider, security, or operational proof."],
]);

t.partHeader("PART 02", "System shape and F-process posture", PHASE_COLOURS.GREEN);
t.h1("What ACC currently contains");
t.p(
  "The current architecture is a pnpm monorepo with a React/Vite Command Centre, an Express/Drizzle/Postgres API, generated OpenAPI clients and Zod schemas, scripts, a mockup sandbox, background jobs, and integration seams. The product is operated as an internal staff tool while dormant SaaS paths remain behind reversible feature decisions.",
);
t.h2("F-process implementation matrix");
t.table(
  ["Stage", "Current implementation", "Evidence posture"],
  [
    ["F0 / F0.5", "Advisory, intake, monitoring, and structured diagnostic surfaces.", "Implemented; live external advisory outcomes are not inferred."],
    ["F1–F5", "Prompt diagnostic, Atomic Prompt, CELL, Micro PDD, and SPC workflows.", "Implemented and persisted through session artifacts."],
    ["F6", "ATLAS PDD generation plus PLAN/SCAN side-steps.", "Implemented; overlays are not certification by themselves."],
    ["F7", "SPARTAN MVP PDD/PWDD compression and public verification lineage.", "Server-side certification gates are enforced."],
    ["F8", "Code ORACLE / Code DJ codebase bundle generation from certified sources.", "Uncertified input is refused; PFP drift gate applies."],
    ["F9", "MECHA seven-phase Machine Floor with signed artifact or refusal.", "Physical/firmware path is fail-closed and requires external evidence."],
    ["F9.5", "OSIRIS custody and attestation seam.", "Custody is separate from build, mutation, and certification."],
    ["F10", "Connector, release, export, deployment, and colonization controls.", "Provider/connector readiness remains an external evidence boundary."],
    ["F11", "Host Connector handoff for certified projects.", "Host planning is separate from physical artifact certification."],
  ],
  [0.18, 0.48, 0.34],
);
t.h2("Current firmware profile addition");
t.p(
  "F8 and F9 now carry a controlled hardware configuration for Firmware bundles. The reference catalog includes Industrial MCU / actuator controller, Robotics real-time control loop, and Connected appliance fleet controller. The profile customizes Code DJ scaffolding and is persisted into F9 evidence and the signed artifact; it does not replace external functional-safety, security, or deployment gates.",
);

t.partHeader("PART 03", "Product surface and evidence", PHASE_COLOURS.ORANGE);
t.h1("Implemented surface versus open proof");
t.h2("Implemented and exercised");
t.bullets([
  "Staff access, signed session handling, session creation, artifact persistence, and owner-scoped route checks.",
  "Manual sessions, ingested documents, cartridges, Exemplar browsing/forking/contribution, Prompts, Quests, Ascension, Account, Activity, and Costs surfaces.",
  "OpenAPI-driven API contract generation and typed web consumers.",
  "F1–F7 sequential stage behavior with certified source gating before F8.",
  "F8 Software/Firmware routing, firmware hardware-profile selection, persisted profile lineage, and PFP drift handling.",
  "F9 seven-phase evaluation, refusal contracts, idempotency, signatures, OSIRIS custody fields, and F10-required attestation data.",
  "F10 release/export/destination/provider and colonization data structures, plus F11 host handoff surfaces.",
  "SPC Player plan-only execution and explicitly authorized webhook delivery path.",
  "Company-wide LLM cost budget, provider/token telemetry, activity history, and operational background workers.",
]);
t.h2("Implemented but not established as live evidence");
t.bullets([
  "Clerk tenant configuration, role setup, and production authentication completion.",
  "Stripe live-mode products, webhook delivery, payment outcomes, and reconciliation.",
  "AI provider credentials, quotas, latency, rate limits, and provider-side availability.",
  "Scheduled jobs, cron reachability, email delivery, deployment health, and production alerting.",
  "Production database parity, backup/restore behavior, retention, and live data quality.",
  "External F9 gate evidence, qualified SAVANT/analyzer adapters, and real appliance or robotics connector execution.",
]);
t.h2("What the scan intentionally does not claim");
t.table(
  ["Claim", "Why it remains open", "Evidence required"],
  [
    ["Certification", "Code and profiles do not establish legal or functional-safety certification.", "Named external reviewers, certificates, test records, and traceable scope."],
    ["Production readiness", "A passing workspace check does not prove deployed behavior.", "Deployment smoke run, telemetry, error/latency baseline, and rollback evidence."],
    ["Live colonization", "F10 physical targets fail closed when qualified adapters are unavailable.", "Validated F9 attestation plus connector, analyzer, SAVANT, consent, and provider evidence."],
    ["Security assurance", "Tests are not a threat model or independent security assessment.", "Threat model, SAST/dependency review, authorization tests, and remediation record."],
    ["Business outcomes", "Repository contents do not prove users, revenue, conversion, or ROI.", "Redacted analytics and verified business reporting."],
  ],
  [0.25, 0.40, 0.35],
);

t.partHeader("PART 04", "ATLAS assurance phases", PHASE_COLOURS.VIOLET);
t.h1("Phase/status interpretation");
t.lead(
  "This SCAN uses ATLAS phases as an evidence organization method. A phase marked implemented is not automatically certified or production-ready.",
);
t.phaseBlock({
  colourName: "RED",
  header: "Foundation and access",
  duration: "present",
  status: "Implemented / live configuration pending",
  deliverables: ["Monorepo packages", "Staff gate and signed sessions", "Owner-scoped persistence"],
  exit: "A deployed smoke run confirms access, attribution, authorization, and failure behavior.",
});
t.phaseBlock({
  colourName: "ORANGE",
  header: "PromptWare production rail",
  duration: "present",
  status: "Implemented / artifact evidence available",
  deliverables: ["F1–F7 sessions", "Persisted artifacts", "Certified MVP PDD/PWDD lineage"],
  exit: "Representative sessions prove source-to-certification continuity under the current access posture.",
});
t.phaseBlock({
  colourName: "YELLOW",
  header: "Code and host handoff",
  duration: "present",
  status: "Implemented / external build outcomes pending",
  deliverables: ["F8 bundles", "PFP drift checks", "F11 host handoff"],
  exit: "A representative certified project is built, reviewed, and handed to a host with recorded results.",
});
t.phaseBlock({
  colourName: "GREEN",
  header: "Machine, custody, and release",
  duration: "present",
  status: "Implemented / qualified external adapters pending",
  deliverables: ["F9 signed/refused artifact", "OSIRIS custody fields", "F10 release/colonization gates"],
  exit: "External gates and connector/analyzer/SAVANT adapters produce a verified end-to-end release receipt.",
});
t.phaseBlock({
  colourName: "BLUE",
  header: "Operations and cost control",
  duration: "present",
  status: "Implemented / production observation pending",
  deliverables: ["LLM cost ledger", "Activity and operations views", "Background sweeps and alerts"],
  exit: "Production telemetry demonstrates cost caps, retries, alerting, recovery, and migration health.",
});

t.partHeader("PART 05", "Priority evidence plan", PHASE_COLOURS.RED);
t.h1("What should be proven next");
t.h2("Priority 1 — run a production-shaped representative journey");
t.p(
  "Choose one software project and one firmware/appliance project. Capture staff sign-in, F1–F7 artifact lineage, F8 generation, PFP review, F9 refusal or emission, F10 gate state, and F11 handoff. Record deployment revision, timestamps, environment, results, and redacted logs.",
);
t.h2("Priority 2 — qualify the physical release boundary");
t.bullets([
  "Name the target hardware and preserve the matching F8/F9 profile ID.",
  "Provide external safety, security, UCG, MM, ARES, PCE, and OSIRIS evidence where applicable.",
  "Wire and independently test the connector analyzer and SAVANT adapters.",
  "Start with sense-only or staging validation before enabling release or remote control.",
]);
t.h2("Priority 3 — establish operational evidence");
t.bullets([
  "Verify production schema parity, migration status, backup, restore, and rollback.",
  "Exercise provider switching, cost caps, rate limits, webhook signatures, retries, and alert recovery.",
  "Run focused authorization and threat-model checks against staff-only, owner-scoped, admin, release, and export routes.",
  "Keep the ATLAS SCAN current after changes to access, persistence, integrations, stage gating, or deployment posture.",
]);
t.h2("Current conclusion");
doc.save().fillColor("#f2f7f8").roundedRect(54, doc.y, 487, 126, 8).fill().restore();
const conclusionY = doc.y + 17;
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(13)
  .text("Conclusion: implemented, tested, and intentionally fail-closed", 72, conclusionY);
doc.fillColor("#374151").font("Helvetica").fontSize(10.5)
  .text(
    "The current repository supports a credible implementation and workspace-verification claim for ACC. The F-process, firmware-profile flow, and physical-target release boundaries are represented in code. The next responsible claim requires production evidence, qualified external gates, and verified connectors rather than additional inference from source presence.",
    72, conclusionY + 27, { width: 450, lineGap: 3.5 },
  );
doc.y = conclusionY + 99;
t.hr();
doc.fillColor(SOFT).font("Helvetica-Oblique").fontSize(9)
  .text("End of current-state SCAN PDD · Source basis: repository snapshot and workspace verification", { lineGap: 2 });

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