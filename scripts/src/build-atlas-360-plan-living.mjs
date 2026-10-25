// Render the editable PLAN baseline; collect only public, bounded status evidence.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createTheme, NAVY, SOFT, PHASE_COLOURS } from "./lib/atlas-pdf-theme.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(root, "lib/export/package.json"));
const PDFDocument = require("pdfkit");
const sourcePath = "docs/ATLAS_360_PLAN_Living_PDD_2026-10-24.md";
const name = "ATLAS_360_PLAN_Living_PDD_2026-10-25";
const out = path.join(root, "generated-artifacts/atlas-360-plan");
fs.mkdirSync(out, { recursive: true });
const text = fs.readFileSync(path.join(root, sourcePath), "utf8");
const title = "ATLAS 360 PLAN | ATANDA Command Centre";
const productionId = "JNGL-PDD-ATANDA-2026-1025-PLAN";
const assembled = new Date();
const localStamp = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago", dateStyle: "long", timeStyle: "long",
}).format(assembled);
const files = [
  sourcePath,
  "attached_assets/ATLAS_360_PLAN_v3_0_0_ALBERT_Integration_1788458927280.pdf",
  "attached_assets/0_ATLAS_360_PLAN_SOCRATES_Training_Manual_v2_0_Addendum_1792082448694.docx",
  "artifacts/command-centre/src/App.tsx",
  "artifacts/command-centre/src/pages/cartridge.tsx",
  "artifacts/command-centre/src/components/cartridge/LibrarySourcePicker.tsx",
  "docs/imprima-short-sprints-internal.md",
  "docs/convener-dashboard.md",
  "artifacts/api-server/src/lib/launch-readiness.ts",
  "artifacts/api-server/src/routes/artifact-operations.ts",
  "artifacts/api-server/src/lib/forge-lifetime.ts",
  "artifacts/api-server/src/routes/learning.ts",
  "artifacts/api-server/src/routes/exemplar-marketplace.ts",
  "artifacts/api-server/src/routes/integrations.ts",
  "artifacts/command-centre/src/pages/landing.tsx",
  "artifacts/command-centre/src/components/exemplars/UploadBar.tsx",
  "scripts/src/lib/atlas-pdf-theme.mjs",
  ...(fs.existsSync(path.join(out, "marketplace-observed-2026-10-25.png"))
    ? ["generated-artifacts/atlas-360-plan/marketplace-observed-2026-10-25.png"] : []),
];
const hashes = files.map((file) => ({
  file,
  sha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex"),
}));
// The operator supplies the URL obtained from deployment metadata, never an inferred domain.
const base = process.argv[2];
if (!base || !/^https:\/\/[^/]+\/?$/.test(base)) {
  throw new Error("Pass the confirmed HTTPS production origin as the first argument.");
}
const probes = [];
for (const route of ["/api/healthz", "/api/readyz", "/api/sphinx/catalog", "/", "/pricing", "/guide", "/cartridge", "/convener"]) {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(new URL(route, base), { signal: AbortSignal.timeout(15000) });
    const body = route.startsWith("/api/") ? await response.json() : undefined;
    if (!route.startsWith("/api/")) await response.body?.cancel();
    probes.push({ route, checkedAt, status: response.status, ...(body ? { body } : {}), scope: "public response only; no authenticated journey" });
  } catch (error) {
    probes.push({ route, checkedAt, error: error.name, scope: "probe failed; no successful result inferred" });
  }
}
const marketplaceUrl = "https://atanda.ai/marketplace";
const checkedAt = new Date().toISOString();
try {
  const response = await fetch(marketplaceUrl, { signal: AbortSignal.timeout(15000) });
  const html = await response.text();
  probes.push({
    route: marketplaceUrl, checkedAt, status: response.status,
    rawHtmlUploadDestinationPresent: /https:\/\/command-center\.atanda\.ai\/exemplars/.test(html),
    scope: "raw HTML only, not client-rendered DOM; see document's separate rendered-page observations and available screenshot evidence; no authenticated upload or synchronization tested",
  });
} catch (error) {
  probes.push({ route: marketplaceUrl, checkedAt, error: error.name, scope: "probe failed; no integration result inferred" });
}
const manifest = {
  documentId: productionId, assembledAt: assembled.toISOString(), localStamp,
  repositoryRevision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  sourcePath, productionOrigin: base, hashes, probes,
  monitoringActivated: false, certified: false,
};
const pdfPath = path.join(out, `${name}.pdf`);
const doc = new PDFDocument({
  size: "A4", bufferPages: true,
  margins: { top: 48, bottom: 76, left: 48, right: 48 },
  info: { Title: title, Author: "Replit Agent — methodology-based draft for human principal review", Subject: "Evidence-bounded living PDD and implementation plan", CreationDate: assembled },
});
const stream = fs.createWriteStream(pdfPath);
doc.pipe(stream);
const theme = createTheme(doc);
const left = doc.page.margins.left;
const width = doc.page.width - left - doc.page.margins.right;
const toc = [];
// Theme helpers retain an explicit last-cell x; restore document flow after each block.
function block(fn) { doc.x = left; fn(); doc.x = left; }
const lines = text.split("\n");
const firstPart = lines.findIndex((line) => line.startsWith("# Part 0"));
const coverLines = lines.slice(3, firstPart).filter(Boolean);
doc.rect(0, 0, doc.page.width, 16).fill(NAVY);
doc.y = 72;
block(() => theme.h3("ATANDA / ARK HARNESS"));
block(() => theme.h1("ATLAS 360 PLAN"));
block(() => theme.lead("Living PromptWare Design Document"));
block(() => theme.h2("ATANDA Command Centre"));
block(() => theme.p("An evidence-bounded platform baseline, implementation plan and activation register."));
block(() => theme.hr());
for (const line of coverLines) block(() => theme.p(line.replace(/\*\*/g, "")));
block(() => theme.p(`Final assembly: ${assembled.toISOString()} / ${localStamp}`));
doc.addPage();
const tocPage = doc.bufferedPageRange().count - 1;
// Reserve one contents page. Fill it after actual page numbers are known.
doc.addPage();
for (let i = firstPart; i < lines.length;) {
  const line = lines[i].trim();
  if (!line) { i++; continue; }
  if (line.startsWith("# ")) {
    if (i !== firstPart) doc.addPage();
    const heading = line.slice(2);
    toc.push({ heading, page: doc.bufferedPageRange().count });
    block(() => theme.h1(heading));
    i++;
  } else if (line.startsWith("## ")) {
    const phase = line.match(/^## Phase ([1-5])/);
    if (phase) {
      theme.pageGuard(160);
      const color = [PHASE_COLOURS.RED, PHASE_COLOURS.YELLOW, PHASE_COLOURS.GREEN, PHASE_COLOURS.BLUE, PHASE_COLOURS.INDIGO][Number(phase[1]) - 1];
      doc.save().fillColor(color).rect(left - 10, doc.y, 4, 18).fill().restore();
    }
    block(() => theme.h2(line.slice(3)));
    i++;
  } else if (line.startsWith("|")) {
    const rows = [];
    while (i < lines.length && lines[i].trim().startsWith("|")) {
      rows.push(lines[i].trim().slice(1, -1).split("|").map((s) => s.trim()));
      i++;
    }
    const headers = rows.shift();
    const body = rows.filter((r) => !r.every((cell) => /^[-:\s]+$/.test(cell)));
    // Table rows remain smaller than a page; theme measures row heights.
    block(() => theme.table(headers, body, headers.length === 3 ? [0.26, 0.39, 0.35] : undefined));
  } else if (line.startsWith("- ")) {
    const items = [];
    while (i < lines.length && lines[i].trim().startsWith("- ")) {
      items.push(lines[i].trim().slice(2));
      i++;
    }
    block(() => theme.bullets(items));
  } else {
    const paragraph = [];
    while (i < lines.length && lines[i].trim() && !/^(#|\||- )/.test(lines[i].trim())) {
      paragraph.push(lines[i].trim());
      i++;
    }
    block(() => theme.p(paragraph.join(" ")));
  }
}
doc.switchToPage(tocPage);
doc.x = left;
doc.y = 55;
block(() => theme.h1("Contents"));
block(() => theme.p("Read the evidence labels before interpreting any activation statement."));
for (const entry of toc) {
  block(() => theme.p(`${entry.heading}  ................................  ${entry.page}`));
}
block(() => theme.hr());
block(() => theme.p(`Assembly: ${localStamp}\nRepository: ${manifest.repositoryRevision}\nThis is a dated document, not an automatically synchronized live service.`));
const range = doc.bufferedPageRange();
for (let page = range.start; page < range.start + range.count; page++) {
  doc.switchToPage(page);
  // Positioned footers must not participate in normal pagination.
  const oldBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.fillColor(SOFT).font("Helvetica").fontSize(6.2);
  const footer = `${title} | ${productionId} | Page ${page + 1} / ${range.count}\nHuman principal: Oluseye Shay Amusa (approval pending) | Prepared: Replit Agent | Roster: Part 3\n${assembled.toISOString()} / America/Chicago | JCSE unscored; not certified | GRO HUMAN_IN_LOOP | Honesty Tier 0`;
  doc.text(footer, left, doc.page.height - 49, { width, lineGap: 1, lineBreak: false });
  doc.page.margins.bottom = oldBottom;
}
doc.end();
await new Promise((resolve, reject) => { stream.on("finish", resolve); stream.on("error", reject); });
manifest.pages = range.count;
manifest.pdfSha256 = crypto.createHash("sha256").update(fs.readFileSync(pdfPath)).digest("hex");
fs.writeFileSync(path.join(out, `${name}.evidence.json`), JSON.stringify(manifest, null, 2) + "\n");
fs.copyFileSync(path.join(root, sourcePath), path.join(out, `${name}.md`));
console.log(JSON.stringify({ pdfPath: path.relative(root, pdfPath), pages: range.count, evidence: probes, assembledAt: manifest.assembledAt }, null, 2));
