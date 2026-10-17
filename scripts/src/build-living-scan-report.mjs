// Builds the dated, repository-grounded living SCAN report. No model/DB/API writes.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createTheme, NAVY, ACCENT, SOFT } from "./lib/atlas-pdf-theme.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const requireExport = createRequire(path.join(root, "lib/export/package.json"));
const PDFDocument = requireExport("pdfkit");
const source = "docs/ATLAS_360_SCAN_Living_PDD_2026-10-17.md";
const out = path.join(root, "generated-artifacts/atlas-360-scan");
fs.mkdirSync(out, { recursive: true });
const markdown = fs.readFileSync(path.join(root, source), "utf8");
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const text = s => s.replace(/\*\*/g, "").replace(/`/g, "").replace(/→/g, "->");
const app = fs.readFileSync(path.join(root, "artifacts/command-centre/src/App.tsx"), "utf8");
const routes = [...new Set([...app.matchAll(/<Route path="([^"]+)"/g)].map(m => m[1]))];
const progress = JSON.parse(fs.readFileSync(path.join(root, "docs/upgrade-program/progress.json"), "utf8"));
const frozenSources = [
  source, "artifacts/command-centre/src/App.tsx",
  "artifacts/api-server/src/routes/index.ts",
  "artifacts/api-server/src/routes/health.ts",
  "artifacts/api-server/src/lib/launch-readiness.ts",
  "artifacts/api-server/src/lib/artifact-operations/database-protection.ts",
  "artifacts/api-server/src/routes/artifact-operations.ts",
  "artifacts/api-server/src/engines/pdd-view.ts",
  "docs/upgrade-program/progress.json",
  "docs/upgrade-program/SPARTAN-artifact-preparation-release.md",
];
const stages = [...markdown.matchAll(/^# SCAN STAGE (\d) — (.+)$/gm)].map((m, i, all) => {
  const end = all[i + 1]?.index ?? markdown.indexOf("# PART 1");
  const body = markdown.slice(m.index + m[0].length, end).trim();
  return { stage: Number(m[1]), name: m[2], evidence: [body], assessment: ({
    1: "Frozen source and limited production observations; no certification.",
    2: "Existing product, stack and release gates retained.",
    3: "Implemented, preparation and governed lanes mapped separately.",
    4: "Public baseline observed; protected full operation blocked.",
    5: "New successful publish supersedes older failure and table-absence observations.",
    6: "SQL guards and genuine verifier/provider execution remain activation gaps.",
    7: "Conditional limited-release baseline; not all-feature approval.",
    8: "Evidence-driven monitoring and maintenance; no runtime changes.",
  })[i + 1], actions: ["Apply the scoped acceptance conditions in this stage and the atomic worksheet."] };
});
if (stages.length !== 8 || stages[0].name !== "Freeze-stage Evidence Manifest")
  throw new Error("Invalid eight-stage SCAN document");
if ([...markdown.matchAll(/^\| A\d\d \|/gm)].length !== 45)
  throw new Error("Expected exactly 45 atomic worksheet rows");
if (routes.some(route => !markdown.includes("`" + route + "`")))
  throw new Error("Report route inventory is incomplete");
const pdfPath = path.join(out, "ATLAS_360_SCAN_Living_PDD_2026-10-17.pdf");
const doc = new PDFDocument({
  size: "A4", bufferPages: true,
  margins: { top: 48, bottom: 50, left: 44, right: 44 },
  info: { Title: "ATLAS 360 SCAN Living PDD — ATANDA — 17 October 2026",
    Author: "ATANDA Command Centre", Subject: "Current-state codebase assurance and site-map addendum" },
});
const stream = fs.createWriteStream(pdfPath);
doc.pipe(stream);
const t = createTheme(doc);
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(13).text("ATANDA / COMMAND CENTRE");
doc.moveDown(2);
doc.fillColor(ACCENT).fontSize(30).text("ATLAS 360 SCAN");
doc.fillColor(NAVY).fontSize(25).text("Living PDD");
doc.fontSize(16).text("Current codebase + live / pending site map");
doc.moveDown(1.5);
t.p("17 October 2026 | Evidence-grounded current-state report");
t.p("Published baseline healthy. Governed full operations remain conditional.");
doc.moveDown(1);
t.kv([["Source baseline", "ad265fcea73835783dae6490cb90cd3da4168fae"],
  ["Published target", "https://command-center.atanda.ai"],
  ["Assurance class", "Analyst scan; not independent certification"],
  ["Navigation", "Eight SCAN stages, four ATLAS parts, three addenda"]]);
doc.moveDown(1);
t.p("LIVE observations, deployed code, local verification and pending activation are deliberately distinguished throughout.");
doc.addPage();
const lines = markdown.split("\n");
let table = [], block = [], inCode = false;
function flushTable() {
  if (!table.length) return;
  const rows = table.filter(l => !/^\|\s*[-:]+/.test(l)).map(l => l.split("|").slice(1, -1).map(c => text(c.trim())));
  if (rows.length > 1) t.table(rows[0], rows.slice(1));
  table = [];
}
function flushBlock() {
  if (block.length) {
    const paragraph = text(block.join(" "));
    doc.font("Helvetica").fontSize(10.5);
    const height = doc.heightOfString(paragraph, {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      lineGap: 3,
    });
    if (doc.y + height + 18 > doc.page.height - doc.page.margins.bottom) doc.addPage();
    t.p(paragraph);
    block = [];
  }
}
for (const line of lines) {
  if (line.startsWith("```")) {
    flushBlock(); flushTable(); inCode = !inCode; continue;
  }
  if (inCode) {
    t.pageGuard(65);
    doc.fillColor(NAVY).font("Courier").fontSize(8).text(line, { lineGap: 1 });
    continue;
  }
  if (line.startsWith("|")) { flushBlock(); table.push(line); continue; }
  flushTable();
  if (!line.trim()) { flushBlock(); continue; }
  if (line.startsWith("# ")) {
    flushBlock();
    if (line.startsWith("# SCAN STAGE") || line.startsWith("# PART") || line.startsWith("# ADDENDUM")) doc.addPage();
    t.h1(text(line.slice(2))); continue;
  }
  if (line.startsWith("## ")) { flushBlock(); t.h2(text(line.slice(3))); continue; }
  if (/^[-*] /.test(line)) { flushBlock(); t.bullets([text(line.slice(2))]); continue; }
  if (/^\d+\. /.test(line)) { flushBlock(); t.p(text(line)); continue; }
  block.push(line);
}
flushBlock(); flushTable();
// Add footers after content: avoid pageAdded recursion in the shared theme.
const range = doc.bufferedPageRange();
for (let i = range.start; i < range.start + range.count; i++) {
  doc.switchToPage(i);
  const bottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.fillColor(SOFT).font("Helvetica").fontSize(8).text(
    `ATANDA | ATLAS 360 SCAN | 17 Oct 2026 | ${i + 1} / ${range.count}`,
    44, doc.page.height - 30, { width: doc.page.width - 88, align: "center", lineBreak: false });
  doc.page.margins.bottom = bottom;
}
doc.end();
await new Promise((resolve, reject) => { stream.on("finish", resolve); stream.on("error", reject); });
fs.copyFileSync(path.join(root, source), path.join(out, path.basename(source)));
const manifest = {
  title: "ATLAS 360 SCAN Living PDD — ATANDA Command Centre",
  generatedAt: new Date().toISOString(),
  evidenceDate: "2026-10-17",
  evidenceWindowUtc: "14:52–14:57",
  applicationFreeze: "ad265fcea73835783dae6490cb90cd3da4168fae",
  workspaceHeadAtRender: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  deployment: { id: "f4343ca5-a545-4574-a34d-948d0926f789", status: "success", completedAt: "2026-10-17T14:31:07.032Z", url: "https://command-center.atanda.ai" },
  publicObservations: {
    healthz: { http: 200, status: "ok" },
    health: { http: 200, db: "ok", engines: "ok", caveat: "Configuration/reachability only" },
    readiness: { http: 200, database: "available", ai: "configured", buildReady: true },
    anonymousSession: { http: 200, authenticated: false },
    sphinx: { http: 200, publicOpen: false, items: [] },
    anonymousPreparationReads: { imprima: 401, shortSprints: 401 },
    clientAsset: { path: "/assets/index-B6U19k7J.js", sha256: "38093616de5498bad9364df88b4df3ca1df3ccb3252ec4d106821fc5c76140e9" },
  },
  databaseObservations: {
    mode: "read-only production catalogs",
    tables: ["imprima_jobs", "imprima_files", "short_sprint_runs", "artifact_operation_events", "sprint_verifier_authorities"],
    allTablesExist: true, allRlsEnabled: true, allForceRlsDisabled: true,
    requiredRestrictedRolePresent: false,
    policiesWithBothPredicatesPerTable: 0,
    imprimaNonInternalTriggers: [],
    fullWorkflowReady: false,
  },
  ledger: { invariants: progress.invariants.length, prompts: progress.prompts.length,
    invariantLiveStates: [...new Set(progress.invariants.map(x => x.liveActivity))] },
  routes,
  sourceHashes: frozenSources.map(file => ({ file, sha256: hash(fs.readFileSync(path.join(root, file))) })),
  outputs: [{ file: path.basename(pdfPath), sha256: hash(fs.readFileSync(pdfPath)) },
    { file: path.basename(source), sha256: hash(Buffer.from(markdown)) }],
  caveat: "Frozen observations are not automatically refreshed. Update report and frozen data after collecting new evidence.",
};
fs.writeFileSync(path.join(out, "evidence-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
fs.writeFileSync(path.join(out, "atlas-360-scan.json"), JSON.stringify({
  schemaVersion: "atlas-360-scan-v1", view: "SCAN", title: manifest.title, stages,
}, null, 2) + "\n");
console.log(JSON.stringify({ pdfPath, pages: range.count, routes: routes.length, atomicPrompts: 45, outputDir: out }));
