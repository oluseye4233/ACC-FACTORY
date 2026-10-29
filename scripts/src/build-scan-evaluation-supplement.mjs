// Refreshes the SCAN delivery with a clearly scoped current-evidence supplement.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createTheme, NAVY, ACCENT } from "./lib/atlas-pdf-theme.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(root, "lib/export/package.json"));
const PDFDocument = require("pdfkit");
const out = path.join(root, "generated-artifacts/atlas-360-scan-2026-10-28");
fs.mkdirSync(out, { recursive: true });
const doc = new PDFDocument({
  size: "A4", bufferPages: true,
  margins: { top: 52, bottom: 54, left: 52, right: 52 },
  info: { Title: "ATANDA Command Centre - ATLAS 360 SCAN current evidence update", Author: "ATANDA" },
});
const output = fs.createWriteStream(path.join(out, "evaluation-supplement.pdf"));
doc.pipe(output);
const t = createTheme(doc);
function heading(title) {
  doc.x = 52;
  t.h1(title);
}
heading("ATLAS 360 SCAN");
t.lead("ATANDA Command Centre / ARK Harness");
t.h2("Living PDD - updated 28 October 2026");
t.p("Current-evidence update, followed by the existing four-part PDD and the evaluation map. Read this update first: it supersedes conflicting evaluation and shared-video statements in the retained report.");
t.h2("Evidence and limitations");
t.p("This is a repository-grounded design and assurance report, not an independent certification or a fresh production audit. Prior production observations in the retained report keep their original observation dates. This refresh does not establish that the latest workspace revision is published.");
t.p("No paid model calls, provider video generation, production database changes, deployments or security-policy changes were performed to prepare this PDF. No new JCSE score, certification or completion percentage is asserted.");
t.h2("What changed");
t.bullets([
  "F0-F12 evaluation responsibilities are now mapped, including F9.5 custody, advisory assessments, enforced checks and externally qualified operations.",
  "F7 score provenance is identified as a remaining fix: current designation uses the best recorded session JCSE and latest MATHMON MAP.",
  "Shared Synthesia stage guides are implemented locally, with transcripts, administrator review and explicit publication controls. Provider generation and published videos remain unverified.",
  "The existing production floor remains valid. This report proposes no extra user-facing stages and does not bypass protected release requirements.",
]);
t.h2("How to use this document");
t.p("Start with the update and acceptance priorities. Use the retained four-part PDD for the broader platform scope, implementation worksheet and site map. Use the final evaluation pages to identify what a check actually proves before treating it as a release decision.");

doc.addPage();
heading("Evaluation findings");
t.h2("JCSE and MATHMON");
t.p("JCSE assesses seven specification pillars, totalling 50 points. MATHMON weights mathematical coherence at 40%, applicability at 35% and predictive reliability at 25%. FORGE VERIFIED requires both JCSE >=45/50 and MATHMON >=70/100. These are not universal stop conditions for every draft or stage.");
t.h2("F7 score-provenance gap - unresolved");
t.p("The current F7 engine reads sessionMaxJcse(), sessionBestJcseScorecards() and loadLatestMap(). It derives the generated MVP PDD designation from those records. This is not a fresh independent assessment of the exact final MVP PDD bytes.");
t.p("Recommended correction: bind qualification evidence to the intended artifact/version and its governed source lineage. Missing or stale evidence must remain explicit. Preserve established Quest and cohort eligibility rules; do not silently revoke historical awards or manufacture replacement scores. This correction has not been implemented by this report.");
t.h2("Governance and drift");
t.p("Installed GRO, ZPOS and Honesty Gate criteria do not themselves prove a passing evaluation. Missing or mismatched governance binding and blocked risk states prevent relevant handoffs. At F8, explicit drift acknowledgement can permit reviewed scaffolding continuation; it does not repair drift or convert findings to PASS.");
t.p("Eligible dedicated F8 remediation can re-check drift immediately. Low-score Boomerang/SPC Player remediation requires F1 re-ingestion and re-evaluation. An Upgraded N title or a return button is navigation and lineage, not proof of clearance.");
t.h2("Independent evidence");
t.p("Supported XVL JSON contracts require prior registration and hash binding. This adapter is not blanket independent runtime verification across the platform. Internal editorial PASS cannot authorize externally protected release. Current F8 IDE/CI PASS records are operator-submitted, not provider-attested.");

doc.addPage();
heading("Activation and next steps");
t.h2("Shared stage guides");
t.p("The local integration supplies explainer and narrated demonstration transcripts for F0-F12, including F9.5. Administrators can save a version, request a test or consented paid render, reconcile status, review the completed video and explicitly publish it. Test videos cannot be published.");
t.p("Subscriber views do not automatically create videos. Shared guides are teaching material, not private project renders, screen recordings, Quest requirements or production gates. API-key setup, actual provider generation and production availability are not confirmed by this refresh.");
t.h2("Remaining boundaries");
t.bullets([
  "F9: software skips the machine floor; physical action still requires the qualified hardware and safety path.",
  "F9.5: custody verifies identity and integrity within its scope, not functional correctness.",
  "F10-F11: supported handoff and hosting preparation are distinct from observed third-party execution.",
  "F12: an actual deployment requires target-specific authorization, provider capability and matching evidence.",
  "Agent Creator: internal model assessment and a prepared fast-track package do not demonstrate that an external agent is running.",
  "IMPRIMA Portal: controlled publication is not independent content verification, legal registration or guaranteed copyright protection.",
]);
t.h2("Recommended acceptance order");
t.bullets([
  "1. Correct F7 provenance with exact version binding and focused regressions, preserving current eligibility policy.",
  "2. Resolve outstanding provider replay-fixture failures before claiming a green full regression suite. Do not record paid responses without authorization.",
  "3. Confirm subscriber-owned Agent Creator and IMPRIMA publication journeys against the intended release revision, including failure and permission paths.",
  "4. Qualify one supported target end-to-end through F10-F12 with evidence of actual external execution, rather than broad activation claims.",
  "5. Configure and review one shared stage guide, then verify the chosen release revision after publishing.",
]);
t.p("No whole-platform percentage is reported: a complete audited denominator and current production acceptance evidence are not available.");

doc.addPage();
heading("F-stage evaluation map");
const map = JSON.parse(fs.readFileSync(path.join(root, "generated-artifacts/acc-evaluation-map/map-data.json"), "utf8"));
const stages = Array.isArray(map) ? map : map.stages;
if (!Array.isArray(stages) || stages.length !== 14) throw new Error("Expected 14 evaluation stages");
for (const stage of stages) {
  t.h2(`${stage.stage} - ${stage.name}`);
  t.p(`Evaluates: ${stage.checks}`);
  t.p(`Progression boundary: ${stage.blocks}`);
  t.p(`Limit: ${stage.caveat}`);
}
t.h2("Source basis");
t.bullets([
  "artifacts/api-server/src/engines/f7.ts; lib/mathmon.ts; lib/scorecards.ts",
  "artifacts/api-server/src/lib/artifact-governance.ts; lib/xvl-verification.ts",
  "artifacts/api-server/src/engines/f8codedj.ts; engines/f8-remediation.ts",
  "artifacts/api-server/src/lib/artifact-operations/internal-evaluation.ts",
  "artifacts/api-server/src/lib/agent-creator.ts; lib/boomerang-remediation.ts",
  "artifacts/api-server/src/lib/platform-services.ts; lib/stage-guides.ts; lib/synthesia.ts",
  "docs/synthesia-stage-guides.md; generated-artifacts/acc-evaluation-map/",
]);
const pages = doc.bufferedPageRange();
for (let i = 0; i < pages.count; i++) {
  doc.switchToPage(i);
  doc.fillColor(ACCENT).font("Helvetica").fontSize(8).text(
    `ATANDA | ATLAS 360 SCAN | Current-evidence update | 28 October 2026 | ${i + 1}`,
    52, 811, { width: 490, lineBreak: false },
  );
}
doc.end();
await new Promise((resolve, reject) => { output.on("finish", resolve); output.on("error", reject); });
console.log(`Created ${pages.count}-page supplement in ${out}`);
