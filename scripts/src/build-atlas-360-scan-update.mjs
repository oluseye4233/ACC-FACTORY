// Documentation-only export: public read-only probes and local source inspection.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createTheme, NAVY, ACCENT, SOFT, PHASE_COLOURS } from "./lib/atlas-pdf-theme.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(root, "lib/export/package.json"));
const PDFDocument = require("pdfkit");
const deployment = JSON.parse(process.argv[2] || "{}");
if (!deployment.success || !deployment.primaryUrl) {
  throw new Error("Pass fresh getDeploymentInfo metadata as the first JSON argument.");
}
const base = new URL(deployment.primaryUrl);
if (base.protocol !== "https:" || base.username || base.password || base.search) {
  throw new Error("Expected an HTTPS published origin without credentials or query.");
}
const edition = process.env.ATLAS_SCAN_EDITION || "2026-10-27";
if (!/^\d{4}-\d{2}-\d{2}$/.test(edition)) throw new Error("Invalid report edition.");
const editionLabel = new Date(`${edition}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const slug = `ATANDA_Command_Centre_ATLAS_360_SCAN_Living_PDD_${edition}`;
const input = path.join(root, "docs", `${slug}.md`);
const output = path.join(root, `generated-artifacts/atlas-360-scan-${edition}`);
fs.mkdirSync(output, { recursive: true });
const markdown = fs.readFileSync(input, "utf8");
if (!markdown.startsWith("# ATANDA Command Centre — ")) throw new Error("Project-first report title is required.");
if ((markdown.match(/^\| ATL-\d{3} \/ P/gm) || []).length !== 45) throw new Error("Expected 45 atomic worksheet items.");
if ((markdown.match(/^## SCAN STAGE [1-8] —/gm) || []).length !== 8) throw new Error("Expected eight SCAN stages.");

const reuseEvidence = process.argv.includes("--reuse-evidence");
const prior = reuseEvidence ? JSON.parse(fs.readFileSync(path.join(output, "evidence.json"), "utf8")) : null;
const observations = prior ? prior.observations : [];
for (const route of prior ? [] : ["/api/healthz", "/api/readyz", "/api/sphinx/catalog"]) {
  const observedAt = new Date().toISOString();
  try {
    const response = await fetch(new URL(route, base), { signal: AbortSignal.timeout(15000), redirect: "error" });
    const body = await response.json();
    const summary = route.endsWith("healthz") ? { status: body.status }
      : route.endsWith("readyz") ? {
        database: body.database, ai: body.ai, buildReady: body.buildReady,
        message: body.message, deferred: body.deferred,
      } : { publicOpen: body.publicOpen, itemCount: Array.isArray(body.items) ? body.items.length : null };
    observations.push({ route, observedAt, http: response.status, summary });
  } catch (error) {
    observations.push({ route, observedAt, http: null, error: error.name || "ProbeError" });
  }
}
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const sourceFiles = [
  path.relative(root, input),
  "artifacts/command-centre/src/App.tsx",
  "artifacts/command-centre/src/pages/landing.tsx",
  "artifacts/command-centre/src/components/marketing/MarketingShell.tsx",
  "artifacts/command-centre/src/components/workspaces/F5ScanLinks.tsx",
  "artifacts/command-centre/src/components/workspaces/F6DraftPdd.tsx",
  "artifacts/api-server/src/engines/f4.ts",
  "artifacts/api-server/src/engines/f5-scan.ts",
  "artifacts/api-server/src/engines/f6.ts",
  "artifacts/api-server/src/engines/f8codedj.ts",
  "artifacts/api-server/src/engines/prompts.ts",
  "artifacts/api-server/src/engines/shared.ts",
  "artifacts/api-server/src/lib/scan-link-evidence.ts",
  "artifacts/api-server/src/lib/artifact-operations/context.ts",
  "lib/api-spec/openapi.yaml",
  "docs/upgrade-program/artifact-title-invariant.md",
  "replit/AGENT_RULES.md",
  "scripts/src/build-atlas-360-scan-update.mjs",
  "scripts/db/startup-lock.mjs",
  "artifacts/command-centre/src/components/shared/StageOptionalTools.tsx",
  "artifacts/command-centre/src/lib/stage-origin.ts",
  "artifacts/command-centre/src/components/boomerang/ReturnedUpgrade.tsx",
  "artifacts/command-centre/src/components/boomerang/BoomerangCaseCard.tsx",
  "artifacts/command-centre/src/components/marketing/ForgeInviteApplication.tsx",
  "artifacts/command-centre/src/pages/spc-player/detail.tsx",
  "artifacts/command-centre/src/pages/f0.tsx",
];
const sources = sourceFiles.map(file => ({ file, sha256: hash(fs.readFileSync(path.join(root, file))) }));
const app = fs.readFileSync(path.join(root, "artifacts/command-centre/src/App.tsx"), "utf8");
const routes = [...new Set([...app.matchAll(/<Route path="([^"]+)"/g)].map(match => match[1]))].sort();
const evidence = {
  reportTitle: "ATANDA Command Centre — ATLAS 360 SCAN Living PDD",
  generatedAt: new Date().toISOString(),
  reportingEdition: edition,
  workspaceHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  liveRevisionParity: "UNVERIFIED",
  deployment,
  observations,
  sources,
  routes,
  limitations: [
    "No production SQL, authenticated production acceptance, independent certification or paid model calls.",
    "Consult the edition's development-evidence section for dated test outcomes; this exporter does not run tests.",
    "Startup ARK RLS verification is not an exhaustive public artifact-operations request-path audit.",
    "ART-TITLE-001 is specified, not universally runtime-enforced.",
  ],
};
const doc = new PDFDocument({
  size: "A4", bufferPages: true,
  margins: { top: 48, bottom: 54, left: 45, right: 45 },
  info: {
    Title: evidence.reportTitle, Author: "ATANDA",
    Subject: "Current codebase, eight-stage assurance scan, four-part PDD and live/pending site map",
    Keywords: "ATANDA, ARK, ATLAS 360 SCAN, Living PDD, CODE ONE+, evidence",
  },
});
const pdfPath = path.join(output, `${slug}.pdf`);
const stream = fs.createWriteStream(pdfPath);
doc.pipe(stream);
const t = createTheme(doc);
const clean = text => String(text).replace(/`/g, "").replace(/\*\*/g, "").replace(/→/g, " -> ").replace(/≥/g, ">=").replace(/≤/g, "<=");
doc.rect(0, 0, doc.page.width, 165).fill(NAVY);
doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(12).text("ATANDA", 45, 48);
doc.fontSize(30).text("Command Centre", 45, 82);
doc.fillColor("#e1eef0").fontSize(13).text("ARK Harness / ACC-FACTORY", 45, 127);
doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(29).text("ATLAS 360 SCAN", 45, 220);
doc.fillColor(NAVY).fontSize(23).text("Living PromptWare Design Document", 45, 264, { width: 490 });
doc.y = 343;
t.lead(`${editionLabel} | Evidence-grounded current-state update`);
t.p("Eight SCAN stages, four ATLAS parts, 45 atomic work items, current route inventory and an evidence-linked completion plan.");
t.p("Incorporates the retained F production floor, integrated CODE ONE + conversion, bottom-centred supporting tools, origin-bound artifact returns and FORGE invitation applications.");
t.h2("Decision in brief");
const latestReadiness = observations.find(item => item.route === "/api/readyz");
t.p(latestReadiness?.http === 200 && latestReadiness?.summary?.database === "available"
  ? "Public health and database readiness respond successfully. This is bounded operational evidence, not full-feature acceptance. Complete regression clearance, independent verification and full F12 operation remain unestablished."
  : "Public readiness has not established current database availability. Review the dated observations before asserting operational readiness. Independent/governed capabilities remain incomplete.");
t.p("This report is not an independent certification, production-security attestation or authorization to open protected gates.");
doc.fillColor(SOFT).fontSize(9).text("Project-first title: ATANDA Command Centre — ATLAS 360 SCAN Living PDD", 45, 719, { width: 490 });
doc.addPage();

function table(headers, rows, widths) {
  doc.x = doc.page.margins.left;
  t.table(headers, rows, widths);
  // Positioned cell text changes PDFKit's horizontal cursor.
  doc.x = doc.page.margins.left;
}

function renderMarkdown(text) {
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim();
    if (!line) { index++; continue; }
    doc.x = doc.page.margins.left;
    if (line.startsWith("|")) {
      const cells = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        const row = lines[index++].trim().slice(1, -1).split("|").map(cell => clean(cell.trim()));
        if (!row.every(cell => /^[-: ]+$/.test(cell))) cells.push(row);
      }
      const [headers, ...rows] = cells;
      const widths = headers.length === 3 ? [0.20, 0.51, 0.29] : headers.map(() => 1 / headers.length);
      if (headers[0] === "ID / priority") widths.splice(0, 3, 0.18, 0.67, 0.15);
      table(headers, rows, widths); doc.moveDown(0.6); continue;
    }
    if (line.startsWith("# ")) {
      if (line.startsWith("# PART ") || line.startsWith("# ADDENDUM ")) {
        doc.addPage();
        t.h3(line.slice(2).split(" — ")[0]);
        t.h1(clean(line.split(" — ").slice(1).join(" — ")));
      } else { t.h1(clean(line.slice(2))); }
      doc.outline.addItem(clean(line.slice(2))); index++; continue;
    }
    if (line.startsWith("## ")) { t.h2(clean(line.slice(3))); index++; continue; }
    if (line.startsWith("### ")) {
      const heading = clean(line.slice(4));
      const colour = heading.startsWith("IMPRIMA —")
        ? PHASE_COLOURS.VIOLET
        : heading.startsWith("SHORT SPRINTS —") ? PHASE_COLOURS.ORANGE : null;
      if (colour) {
        t.pageGuard(240);
        const x = doc.page.margins.left;
        const y = doc.y + 6;
        doc.save().fillColor(colour).rect(x, y, 5, 32).fill().restore();
        doc.font("Helvetica-Bold").fontSize(13).fillColor(colour)
          .text(heading, x + 14, y + 7, {
            width: doc.page.width - doc.page.margins.right - x - 14,
          });
        doc.y = y + 43;
        doc.x = x;
      } else {
        t.h3(heading);
      }
      index++; continue;
    }
    if (/^(- |\d+\. )/.test(line)) {
      const items = [];
      while (index < lines.length && /^(- |\d+\. )/.test(lines[index].trim())) {
        items.push(clean(lines[index++].trim().replace(/^(- |\d+\. )/, "")));
      }
      t.bullets(items); continue;
    }
    const paragraph = [];
    while (index < lines.length && lines[index].trim() && !/^(#|\||- |\d+\. )/.test(lines[index].trim())) {
      paragraph.push(lines[index++].trim());
    }
    t.p(clean(paragraph.join(" ")));
  }
}
renderMarkdown(markdown);
t.h1("Addendum A.1 — Generated route inventory");
t.p("Extracted from current frontend source. All paths below are SOURCE PRESENT; authorization, stage qualification and authenticated live acceptance are not established by this inventory.");
const category = route => {
  if (route.includes("learn-login") || route.includes("learn-register")) return "Student entry / eligibility";
  if (/^\/admin/.test(route)) return "Administrator permission";
  if (/convener|teach\/cohorts/.test(route)) return "Convener / cohort permission";
  if (/session|ingest|cartridge/.test(route)) return "Production workspace / stage gates";
  if (/spc-player|boomerang|exemplars/.test(route)) return "Supporting work / ownership";
  if (/learn|quests|ascension/.test(route)) return "Learning / credential rules";
  if (/operations|f10|f0/.test(route)) return "Operations / target gates";
  return "Account / public routing policy";
};
table(["Path", "Access or qualification boundary"], routes.map(route => [route, category(route)]), [0.53, 0.47]);
t.h1("Addendum C — Fresh observation and source manifest");
t.p(`Generated: ${evidence.generatedAt}. Published origin: ${base.origin}. Public observation dates are UTC; the edition date is ${editionLabel}. A successful build does not identify the exact serving source revision.`);
table(["Endpoint / time", "Fresh result"], observations.map(item => [
  `${item.route}\n${item.observedAt}`, `HTTP ${item.http ?? "unknown"}: ${JSON.stringify(item.summary ?? { error: item.error })}`,
]), [0.36, 0.64]);
t.p(`Reviewed workspace HEAD: ${evidence.workspaceHead}. The uncommitted working tree is distinguished by the source hashes in the companion evidence JSON. Exact production revision parity remains unverified.`);
table(["Source file", "SHA-256 prefix"], sources.map(source => [source.file, source.sha256.slice(0, 20)]), [0.72, 0.28]);
t.p("Full hashes, public response summaries, deployment metadata and route inventory are retained in the accompanying evidence manifest. No credentials, connection strings or private user records are included.");

const range = doc.bufferedPageRange();
const pageCount = range.count;
for (let index = range.start; index < range.start + range.count; index++) {
  doc.switchToPage(index);
  const bottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  const y = doc.page.height - 30;
  doc.save().strokeColor("#d9dfe7").lineWidth(0.5).moveTo(45, y - 9).lineTo(doc.page.width - 45, y - 9).stroke().restore();
  doc.fillColor(SOFT).font("Helvetica").fontSize(8).text(`ATANDA / ARK — ATLAS 360 SCAN — ${editionLabel}`, 45, y, { width: 420, lineBreak: false });
  doc.text(`${index + 1} / ${pageCount}`, doc.page.width - 97, y, { width: 52, align: "right", lineBreak: false });
  doc.page.margins.bottom = bottom;
}
doc.end();
await new Promise((resolve, reject) => { stream.on("finish", resolve); stream.on("error", reject); });
evidence.pdf = { file: path.basename(pdfPath), pageCount, sha256: hash(fs.readFileSync(pdfPath)) };
fs.copyFileSync(input, path.join(output, `${slug}.md`));
fs.writeFileSync(path.join(output, "evidence.json"), JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify({ pdf: path.relative(root, pdfPath), pages: pageCount, bytes: fs.statSync(pdfPath).size, publicProbes: observations.map(item => ({ route: item.route, http: item.http })) }, null, 2));
