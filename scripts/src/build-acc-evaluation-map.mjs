import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const out = path.join(root, "generated-artifacts/acc-evaluation-map");
await mkdir(out, { recursive: true });
const date = "28 October 2026";
const colors = {
  advisory: { ink: "#1756a9", pale: "#edf5ff", label: "ADVISORY" },
  enforced: { ink: "#aa2941", pale: "#fff0f2", label: "ENFORCED · SCOPED" },
  review: { ink: "#865600", pale: "#fff7df", label: "REVIEWABLE HOLD" },
  external: { ink: "#6442a2", pale: "#f3efff", label: "EXTERNAL EVIDENCE" },
};
const stages = [
  { stage: "F0", name: "Advisory", type: "advisory", short: ["Review the concept", "Advice is not approval"],
    checks: "Concept guidance and recommendations.",
    blocks: "No universal JCSE/MATHMON score gate here. Ordinary access and request validation still apply.",
    caveat: "Advice does not authorize execution, certification or release." },
  { stage: "F1", name: "Ingestion", type: "advisory", short: ["JCSE + source validation", "Improve weak inputs"],
    checks: "Input acceptance, structured output and a JCSE quality scorecard.",
    blocks: "Invalid/unsupported input or failed server validation can prevent ingestion. A score below 45 is not a universal F1 progression lock.",
    caveat: "Successful ingestion is not evidence that every source claim is true." },
  { stage: "F2", name: "Atomic prompt", type: "advisory", short: ["Atomicity + JCSE", "Clarify the instruction"],
    checks: "Instruction structure and the seven JCSE pillars.",
    blocks: "Required input/output validation applies. Low scores inform correction rather than a universal 45-point stop at every stage.",
    caveat: "A strong prompt is not a runtime-tested application." },
  { stage: "F3", name: "Molecular Agent", type: "advisory", short: ["MA specification", "Governance is installed"],
    checks: "MA birth-package structure and installation of source-bound governance.",
    blocks: "Schema, ownership and stage prerequisites apply. The separate Agent Creator route adds its own score/governance eligibility.",
    caveat: "An MA specification is not a running or independently verified agent." },
  { stage: "F4", name: "Micro PDD", type: "enforced", short: ["Eligible MA source", "Governance validity"],
    checks: "Eligible source selection, governed source integrity and specification conversion.",
    blocks: "Missing/invalid governance or an ineligible source can block conversion; review/remediation is required where applicable.",
    caveat: "GRO SAFE_LIFE is not a guarantee of operational safety." },
  { stage: "F5", name: "SPC / SCAN inputs", type: "enforced", short: ["Structured specification", "Risk-review checkpoint"],
    checks: "SPC construction checkpoints, GRO risk handling and supported source references.",
    blocks: "Required workflow/checkpoint and valid-source conditions apply. Unsupported/private remote references cannot be treated as successfully scanned.",
    caveat: "A supplied URL does not prove its content was fetched or verified." },
  { stage: "F6", name: "ATLAS PDD", type: "enforced", short: ["Eligible F5 artifact only", "PDD / PLAN / SCAN"],
    checks: "Source session/type/stage validity and PDD output structure.",
    blocks: "The source must be an eligible saved F5 artifact, including supported SCAN artifacts; relevant access and view restrictions apply.",
    caveat: "PDD completeness is not proof of implementation correctness." },
  { stage: "F7", name: "MVP PDD", type: "enforced", short: ["FORGE VERIFIED gate", "JCSE ≥45 + MATHMON ≥70"],
    checks: "Server-calculated MATHMON composite and the FORGE VERIFIED score predicate.",
    blocks: "Both thresholds are required for the designation; missing evidence cannot qualify. This is not a universal prohibition on creating an MVP PDD.",
    caveat: "Current inputs are the session's best recorded JCSE and latest MAP, not a fresh independent evaluation of the final artifact." },
  { stage: "F8", name: "CODE ONE+ / Code DJ", type: "review", short: ["PFP drift + code fidelity", "Acknowledgement ≠ repair"],
    checks: "Specification-to-code fidelity, PFP findings and recorded IDE/CI evidence where supplied.",
    blocks: "Critical PFP findings hold further scaffolding unless explicitly acknowledged for reviewed continuation; other source/governance requirements remain.",
    caveat: "Acknowledgement does not clear drift. Current IDE/CI PASS evidence is operator-submitted, not provider-attested." },
  { stage: "F9", name: "Machine floor", type: "external", short: ["Firmware / hardware path", "Software skips this stage"],
    checks: "Controlled hardware configuration and required machine/specialist evidence.",
    blocks: "Physical emission/action requires the qualified machine path and its original safeguards. Preparation alone cannot open it.",
    caveat: "Software bypasses F9; a configuration package is not proof of physical safety." },
  { stage: "F9.5", name: "OSIRIS custody", type: "enforced", short: ["Protected release path", "Artifact hash + custody"],
    checks: "Artifact identity, integrity and custody evidence for applicable signed-release routes.",
    blocks: "Missing, stale or mismatched evidence cannot establish valid custody for a protected release.",
    caveat: "Custody proves identity/history within its scope, not that the code is functionally correct." },
  { stage: "F10", name: "Integration / handoff", type: "external", short: ["Source + authorization", "Receipt ≠ execution"],
    checks: "Source binding, supported destination, authorization/consent and matching delivery evidence.",
    blocks: "Missing permissions or configured adapters block the relevant handoff. Protected promotion requires its additional qualified evidence.",
    caveat: "A native export or accepted receipt does not prove deployment, execution or correct behaviour." },
  { stage: "F11", name: "Hosting / refinement", type: "external", short: ["Target-specific evidence", "No inferred deployment"],
    checks: "Hosting workflow prerequisites, provider/target evidence and permitted transitions.",
    blocks: "Relevant authorization, qualified integrations and transition evidence are required; unavailable capabilities remain closed.",
    caveat: "A prepared hosting plan is not proof that an external service is running." },
  { stage: "F12", name: "Delivery target", type: "external", short: ["Prepare vs execute", "Qualified release only"],
    checks: "Authorized delivery/deployment prerequisites and evidence for the actual selected target.",
    blocks: "Real execution requires its qualified provider path and matching evidence. Preparation cannot substitute for release authority.",
    caveat: "Do not infer full F12 activation from the existence of a package, plan or UI control." },
];
const esc = v => String(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const svgText = (x, y, value, size = 18, fill = "#344655", weight = 400) =>
  `<text x="${x}" y="${y}" font-family="Arial,Helvetica,sans-serif" font-size="${size}" fill="${fill}" font-weight="${weight}">${esc(value)}</text>`;
const pieces = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 1570" role="img" aria-labelledby="title description"><title id="title">ACC evaluation map across F0–F12</title><desc id="description">Fourteen stage cards distinguish advisory scoring, enforced scoped requirements, reviewable drift holds and external qualification. Low scores return through remediation and re-ingestion; no automatic certification or release.</desc><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="none" stroke="#82909d" stroke-width="1.4"/></marker></defs><rect width="1440" height="1570" fill="#f7faf9"/>`,
  svgText(64, 56, "ATANDA  /  ARK HARNESS", 19, "#176346", 700),
  svgText(64, 109, "ACC evaluation & gate map", 44, "#142d26", 700),
  svgText(64, 145, `Implementation-based review · ${date} · not a live-production audit`, 19),
  svgText(64, 177, "Colour describes the check type—not whether a stage is active. Read stages left to right, then down.", 17),
];
Object.values(colors).forEach((c, i) => {
  pieces.push(`<rect x="${64 + i * 332}" y="202" width="310" height="39" rx="8" fill="${c.pale}" stroke="${c.ink}"/>`,
    svgText(80 + i * 332, 227, c.label, 16, c.ink, 700));
});
stages.forEach((s, i) => {
  const col = i % 4, row = Math.floor(i / 4), x = 64 + col * 332, y = 272 + row * 250, c = colors[s.type];
  pieces.push(`<rect x="${x}" y="${y}" width="310" height="210" rx="14" fill="white" stroke="#d5dfda"/><rect x="${x}" y="${y}" width="310" height="8" rx="4" fill="${c.ink}"/>`,
    svgText(x + 20, y + 46, s.stage, 29, "#142d26", 700),
    svgText(x + 20, y + 78, s.name, s.name.length > 20 ? 18 : 21, "#142d26", 700),
    svgText(x + 20, y + 115, s.short[0], 17),
    svgText(x + 20, y + 142, s.short[1], 17),
    svgText(x + 20, y + 181, c.label, 14, c.ink, 700));
  if (col < 3 && i < stages.length - 1) pieces.push(`<path d="M${x + 314} ${y + 106}h14" fill="none" stroke="#82909d" stroke-width="2" marker-end="url(#arrow)"/>`);
  if (col === 3 && i < 12) pieces.push(`<path d="M${x + 155} ${y + 214}v17H219v15" fill="none" stroke="#82909d" stroke-width="1.5" marker-end="url(#arrow)"/>`);
});
pieces.push(
  `<rect x="728" y="1022" width="642" height="210" rx="14" fill="#eaf3ee" stroke="#b8d3c1"/>`,
  svgText(750, 1062, "Cross-stage evidence rules", 24, "#176346", 700),
  svgText(750, 1099, "XVL contract checks apply only where supported.", 19),
  svgText(750, 1130, "Internal PASS ≠ independent PASS ≠ release approval.", 19),
  svgText(750, 1161, "Missing evidence stays NOT RUN / INCONCLUSIVE.", 19),
  svgText(750, 1192, "Software and Agent Creator follow eligible route rules.", 19),
  `<rect x="64" y="1270" width="1306" height="153" rx="14" fill="#edf5ff" stroke="#9cb8d7"/>`,
  svgText(86, 1306, "REMEDIATION LOOP", 20, "#1756a9", 700),
  svgText(86, 1340, "Low score / failed check → exact artifact + findings → Boomerang / SPC Player → corrected revision", 22),
  svgText(86, 1374, "Score-driven rework → F1 re-ingestion → re-evaluation → eligible return / continuation", 22),
  svgText(86, 1403, "Upgraded 1, Upgraded 2… retain lineage; a new name or return action does not clear a failed gate.", 18),
  svgText(64, 1472, "INTERNAL SERVICES", 19, "#176346", 700),
  svgText(64, 1505, "Agent Creator: score + governance eligibility. IMPRIMA: editorial checks where run; publication controls remain separate.", 18),
  svgText(64, 1538, "This map documents existing checks. It adds no gates, changes no entitlements and makes no runtime-safety guarantee.", 17),
  "</svg>",
);
const svg = pieces.join("\n");
const sources = [
  "artifacts/api-server/src/lib/mathmon.ts",
  "artifacts/api-server/src/lib/scorecards.ts",
  "artifacts/api-server/src/lib/artifact-governance.ts",
  "artifacts/api-server/src/engines/f1.ts through f7.ts",
  "artifacts/api-server/src/engines/f8codedj.ts",
  "artifacts/api-server/src/lib/xvl-verification.ts",
  "artifacts/api-server/src/lib/artifact-operations/internal-evaluation.ts",
  "artifacts/api-server/src/lib/boomerang-remediation.ts",
  "artifacts/api-server/src/lib/platform-services.ts",
];
const rows = stages.map(s => `<tr><th scope="row">${s.stage}<br><small>${esc(s.name)}</small></th><td><span class="tag" style="color:${colors[s.type].ink};background:${colors[s.type].pale}">${colors[s.type].label}</span><p>${esc(s.checks)}</p></td><td>${esc(s.blocks)}</td><td>${esc(s.caveat)}</td></tr>`).join("");
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ACC — F-stage evaluation and gate map</title>
<style>*{box-sizing:border-box}body{margin:0;background:#eef3f0;color:#1d3028;font:16px/1.6 Arial,Helvetica,sans-serif}main{max-width:1440px;margin:32px auto;padding:28px;background:white;border:1px solid #d7e0da;border-radius:18px}h1,h2{line-height:1.2}h1{font-size:36px}h2{margin-top:38px;color:#176346}.eyebrow{letter-spacing:.14em;font-size:12px;color:#176346;font-weight:700}.scope,.note{padding:18px 22px;border-left:4px solid #176346;background:#edf5ef}.note{border-color:#aa2941;background:#fff1f3}svg{width:100%;height:auto;display:block}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;min-width:920px}th,td{text-align:left;vertical-align:top;padding:16px;border-bottom:1px solid #d8e2dc}thead{background:#153d2d;color:white}tbody th{width:14%}td{width:28%}small{font-weight:400}.tag{font-size:11px;padding:5px 8px;display:inline-block;font-weight:700;border-radius:5px}p{margin:.6em 0}li{margin:.55em 0}code{overflow-wrap:anywhere;font-size:13px}footer{border-top:1px solid #d8e2dc;margin-top:36px;padding-top:18px;font-size:13px;color:#52625a}@media print{body{background:white;font-size:10pt}main{margin:0;border:0;padding:0}.map{break-after:page}table{min-width:0;font-size:9pt}tr{break-inside:avoid}h2{break-after:avoid}th,td{padding:8px}svg{max-height:250mm}.scope,.note{break-inside:avoid}}</style>
<main><div class="eyebrow">ATANDA / ARK HARNESS</div><h1>ACC — F-stage evaluation and gate map</h1>
<p>Reviewed ${date}. This report maps the current implementation; it is <strong>not an assertion that every production gate or external integration is live.</strong></p>
<div class="scope"><strong>How to read it:</strong> Blue = advisory assessment. Red = an enforced requirement within a stated scope. Amber = a reviewed-continuation hold. Violet = external/provider/specialist evidence required for the protected action. Colours do not represent stage availability. Ordering is a reference, not a new mandatory route: software skips F9 and eligible native/Agent Creator paths keep their existing rules.</div>
<section class="map" aria-label="Visual map">${svg}</section>
<h2>Stage-by-stage: what is evaluated and what blocks</h2><div class="scroll"><table><thead><tr><th>Stage</th><th>Evaluation</th><th>Effect on progression</th><th>Evidence limitation</th></tr></thead><tbody>${rows}</tbody></table></div>
<h2>Thresholds and their actual scope</h2>
<ul><li><strong>JCSE: 45/50.</strong> Seven pillars: System 7, Role 7, Instruction 8, Example 7, Constraint 7, Format 7 and Data 7. Scorecards provide gaps and corrective actions; the number alone does not prove functioning code.</li>
<li><strong>MATHMON: 70/100.</strong> Server-recomputed composite = 40% mathematical coherence + 35% applicability + 25% predictive reliability. These remain assessments, not independent empirical proof.</li>
<li><strong>FORGE VERIFIED:</strong> both thresholds are required. Missing scores cannot qualify. This designation does not certify runtime safety, performance or economic outcomes.</li></ul>
<div class="note"><strong>Important F7 provenance limitation:</strong> the current path reads the session's best recorded JCSE and latest MATHMON applicability profile (MAP). It is not a fresh independent assessment of the final MVP PDD. Do not describe every stage or final artifact as independently re-scored.</div>
<h2>Checks that extend across stages</h2>
<ul><li><strong>GRO / ZPOS / Honesty Gate:</strong> required governance structure and disclosures. GREY requires review; RED blocks ordinary external handoff. Installed criteria do not prove those criteria passed.</li>
<li><strong>XVL:</strong> the available JSON-contract path evaluates supported rules against an exact artifact and a contract registered before generation. Hash binding protects the evidence snapshot. This deterministic adapter is not blanket independent/runtime verification across F0–F12.</li>
<li><strong>VTE:</strong> records verification failures and their resolution. Applicable protected operations remain closed when required evidence or failure resolution is absent.</li>
<li><strong>Operational prerequisites:</strong> ownership, permissions, valid source types, quotas and server validation may block requests independently of quality scoring. They are not additional proof of artifact quality.</li></ul>
<h2>Internal and supporting functions</h2>
<ul><li><strong>Agent Creator:</strong> internal model-assessed JCSE/MATHMON and applicable governance eligibility control the eligible creation/fast-track path. Passing scores alone do not prove third-party execution or an independently qualified release.</li>
<li><strong>IMPRIMA:</strong> source binding, recorded scores and KLARITY/SOCRATES editorial findings where actually run. KLARITY PASS can record adapter completion rather than a quality threshold; SOCRATES is internal claims review, not independent truth verification.</li>
<li><strong>Internal preparation reports:</strong> use PASS, FAIL, INCONCLUSIVE and per-check NOT_RUN. Absent scores are not borrowed from unrelated artifacts. These reports do not authorize protected release; their internal assessment explicitly retains <code>releaseAllowed: false</code>.</li>
<li><strong>Publication controls:</strong> permission to publish/download is separate from independent verification, certification, deployment and legal ownership of the content.</li></ul>
<h2>The correction and return loop</h2>
<ol><li>Identify the exact saved artifact and its recorded findings. A JCSE below 45 or MATHMON below 70 can trigger a rework recommendation.</li><li>Use the applicable Boomerang/SPC Player or stage-specific remediation route, preserving the source and departure context.</li><li>For score-driven SPC Player rework, return the synthesized result through F1 ingestion for fresh evaluation. F8 drift remediation can use its dedicated immediate re-check path where eligible.</li><li>Return/adopt the corrected artifact through the reviewed stage workflow. Upgraded 1, Upgraded 2 and subsequent revisions preserve lineage; the naming or navigation action is not a PASS.</li><li>Re-evaluate and continue only when the checks for the selected route are satisfied. Never convert missing evidence, acknowledged drift or an accepted delivery receipt into release approval.</li></ol>
<h2>Four limitations to keep visible</h2><ol><li>F7 uses session-level score provenance, as described above.</li><li>F8 permits explicit acknowledgement of critical PFP findings for continued scaffolding; acknowledgement is not correction.</li><li>Current recorded F8 IDE/CI PASS evidence is operator-submitted rather than independently provider-attested.</li><li>One passing deterministic contract or an internal PASS does not establish full independent-profile acceptance.</li></ol>
<h2>Implementation sources</h2><ul>${sources.map(s => `<li><code>${esc(s)}</code></li>`).join("")}</ul>
<footer>ACC — ATANDA Command Centre · Prepared ${date}. Documentation only: no production settings, evaluation thresholds, access rights or release safeguards were changed.</footer></main></html>`;
const md = `# ACC — F-stage evaluation and gate map\n\nReviewed ${date}. Implementation-based, not a live-production audit.\n\nLegend: advisory / enforced within scope / reviewable hold / external evidence. Colours in the accompanying visual describe check types, not active status.\n\n| Stage | Evaluation | What can block | Limitation |\n|---|---|---|---|\n${stages.map(s => `| ${s.stage} — ${s.name} | ${s.checks} | ${s.blocks} | ${s.caveat} |`).join("\n")}\n\n## Shared rules\n\n- JCSE ≥45/50 and MATHMON ≥70/100 are both required for FORGE VERIFIED, not universal stop rules for every draft.\n- F7 currently uses the session's best recorded JCSE and latest MAP, not a fresh independent final-artifact evaluation.\n- Missing evidence is not PASS. Internal PASS is not independent verification or release authorization.\n- F8 acknowledgement allows reviewed continuation, not drift clearance; current IDE/CI PASS evidence is operator-submitted.\n- Supported XVL JSON contracts are registered before generation and hash-bound; full independent verification is not blanket coverage across all stages.\n- Software skips F9; native preparation and Agent Creator keep route-specific eligibility. This document creates no new gates.\n- Low-score SPC Player remediation requires F1 re-ingestion and re-evaluation. Use exact artifact/lineage and reviewed adoption; Upgraded N is not a passing verdict.\n- Applicable dedicated F8 drift remediation can re-check immediately; it must not fabricate successful findings.\n\nFor the complete supporting-function explanation, sources and visual, open ACC-evaluation-and-gate-map.html.\n`;
await Promise.all([
  writeFile(path.join(out, "ACC-evaluation-visual-map.svg"), svg),
  writeFile(path.join(out, "ACC-evaluation-and-gate-map.html"), html),
  writeFile(path.join(out, "ACC-evaluation-and-gate-map.md"), md),
  writeFile(path.join(out, "map-data.json"), JSON.stringify({ date, stages }, null, 2)),
]);
console.log(`Generated visual map and report in ${path.relative(root, out)}`);
