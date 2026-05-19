// Generates the ATANDA × F500 Handover Protocol PDF.
// Run with:  node scripts/src/build-f500-handover-protocol.mjs
// Output:    docs/ATANDA_F500_Handover_Protocol.pdf
//
// A two-party operating agreement between the ATANDA Architect organisation
// (producer of SPCs / MA Birth Packages / ATLAS PDDs / SPARTAN-certified
// MVP-PDDs) and a Fortune 500 customer's Microsoft Copilot + Azure platform
// team. The protocol defines what crosses the wall, on what schedule, with
// what governance gate, and with what telemetry round-trip.

import { createRequire } from "node:module";
import { mkdirSync, createWriteStream } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const exportRequire = createRequire(resolve(repoRoot, "lib/export/package.json"));
const PDFDocument = exportRequire("pdfkit");

const OUT_PATH = resolve(repoRoot, "docs/ATANDA_F500_Handover_Protocol.pdf");
mkdirSync(dirname(OUT_PATH), { recursive: true });

const NAVY = "#0b1d3a";
const ACCENT = "#1f7a8c";
const GREY = "#374151";
const SOFT = "#6b7280";
const LIGHT = "#e5e7eb";
const GOLD = "#b8860b";
const MSBLUE = "#0078d4";

const doc = new PDFDocument({
  size: "LETTER",
  margins: { top: 64, bottom: 64, left: 64, right: 64 },
  info: {
    Title: "ATANDA × F500 Handover Protocol — Command Centre → Microsoft Copilot + Azure",
    Author: "ATANDA Command Centre",
    Subject: "Two-party operating agreement for translating ATANDA SPCs / MAs / PDDs into Azure AI Foundry agents surfaced via Microsoft 365 Copilot."
  }
});
doc.pipe(createWriteStream(OUT_PATH));

// ---------- Layout helpers (same kit as the PDD builders) ----------
function pageGuard(reserve = 140) {
  if (doc.y > doc.page.height - reserve) doc.addPage();
}
function hr(color = LIGHT) {
  const y = doc.y + 6;
  doc.save().strokeColor(color).lineWidth(1)
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .stroke().restore();
  doc.moveDown(0.8);
}
function sectionHeader(label, title, accent) {
  doc.addPage();
  const x = doc.page.margins.left;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.save().fillColor(accent).rect(x, doc.y, w, 38).fill().restore();
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(11)
    .text(label, x + 12, doc.y - 30, { characterSpacing: 2 });
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(18)
    .text(title, x + 12, doc.y - 12);
  doc.moveDown(2);
}
function h2(text) {
  pageGuard(160);
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(15).text(text);
  doc.moveDown(0.25);
}
function h3(text) {
  pageGuard(140);
  doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(11)
    .text(text.toUpperCase(), { characterSpacing: 1 });
  doc.moveDown(0.15);
}
function p(text) {
  pageGuard(80);
  doc.fillColor(GREY).font("Helvetica").fontSize(10.5).text(text, { align: "left", lineGap: 2.5 });
  doc.moveDown(0.5);
}
function bullets(items) {
  doc.fillColor(GREY).font("Helvetica").fontSize(10.5);
  for (const item of items) {
    pageGuard(60);
    doc.text(`•  ${item}`, { indent: 8, lineGap: 2.5, paragraphGap: 3 });
  }
  doc.moveDown(0.4);
}
function kv(rows) {
  doc.font("Helvetica").fontSize(10.5);
  for (const [k, v] of rows) {
    pageGuard(60);
    doc.fillColor(NAVY).font("Helvetica-Bold").text(`${k}:  `, { continued: true, lineGap: 2.5 });
    doc.fillColor(GREY).font("Helvetica").text(v, { lineGap: 2.5 });
  }
  doc.moveDown(0.5);
}
function code(block) {
  pageGuard(120);
  const x = doc.page.margins.left;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const text = block.trim();
  const lines = text.split("\n").length;
  const lineHeight = 12;
  const padding = 10;
  const boxHeight = lines * lineHeight + padding * 2;
  if (doc.y + boxHeight > doc.page.height - doc.page.margins.bottom) doc.addPage();
  const startY = doc.y;
  doc.save().fillColor("#f3f4f6").rect(x, startY, w, boxHeight).fill().restore();
  doc.fillColor("#1f2937").font("Courier").fontSize(9)
    .text(text, x + padding, startY + padding, { width: w - padding * 2, lineGap: 2 });
  doc.y = startY + boxHeight + 8;
  doc.moveDown(0.4);
}
function calloutBox(title, body, accent = GOLD) {
  pageGuard(160);
  const x = doc.page.margins.left;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const startY = doc.y;
  doc.fillColor(accent).font("Helvetica-Bold").fontSize(10)
    .text(title.toUpperCase(), x + 12, startY, { characterSpacing: 1.5 });
  doc.moveDown(0.25);
  doc.fillColor(GREY).font("Helvetica").fontSize(10.5)
    .text(body, x + 12, doc.y, { width: w - 18, lineGap: 2.5 });
  const endY = doc.y;
  doc.save().fillColor(accent).rect(x, startY, 4, endY - startY).fill().restore();
  doc.moveDown(0.8);
}
function table(headers, rows, colWidths) {
  pageGuard(180);
  const x = doc.page.margins.left;
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  // Header band
  doc.save().fillColor(NAVY).rect(x, doc.y, totalW, 20).fill().restore();
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9.5);
  let cx = x;
  headers.forEach((h, i) => {
    doc.text(h, cx + 6, doc.y + 5, { width: colWidths[i] - 10 });
    cx += colWidths[i];
  });
  doc.y = doc.y + 14;
  doc.moveDown(0.8);
  // Rows
  doc.font("Helvetica").fontSize(9.5);
  for (const row of rows) {
    pageGuard(70);
    const rowStartY = doc.y;
    let maxHeight = 0;
    // pre-measure
    cx = x;
    const cellYs = [];
    row.forEach((cell, i) => {
      const h = doc.heightOfString(String(cell), { width: colWidths[i] - 10, lineGap: 1.5 });
      maxHeight = Math.max(maxHeight, h);
      cellYs.push(h);
      cx += colWidths[i];
    });
    // background stripe
    if ((rows.indexOf(row)) % 2 === 1) {
      doc.save().fillColor("#f9fafb").rect(x, rowStartY - 2, totalW, maxHeight + 6).fill().restore();
    }
    // render
    cx = x;
    row.forEach((cell, i) => {
      doc.fillColor(GREY).text(String(cell), cx + 6, rowStartY, { width: colWidths[i] - 10, lineGap: 1.5 });
      cx += colWidths[i];
    });
    doc.y = rowStartY + maxHeight + 4;
  }
  doc.moveDown(0.6);
}

// ───────────────────────────────────────────────────────────────────────────
// COVER
// ───────────────────────────────────────────────────────────────────────────
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(34).text("ATANDA × F500");
doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(34).text("Handover Protocol");
doc.moveDown(0.2);
doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(12)
  .text("COMMAND CENTRE  →  MICROSOFT COPILOT + AZURE AI FOUNDRY", { characterSpacing: 2 });
doc.moveDown(0.4);
doc.fillColor(SOFT).font("Helvetica-Oblique").fontSize(11)
  .text("Two-party operating agreement for the production of governed AI agents at Fortune 500 scale.");
doc.moveDown(2);
hr(ACCENT);

h3("Document classification");
kv([
  ["Document type", "Operating Protocol (signature-bearing)"],
  ["Parties", "ATANDA Architect Organisation  ⟷  F500 Customer AI Platform Team"],
  ["Effective on", "Both signature blocks complete on the final page"],
  ["Companion artifact", "docs/azure-foundry-agent-template.yaml (the canonical translation template)"],
  ["Methodology anchor", "ATANDA Command Centre PDD 2 (registry-aligned)"],
  ["Registry anchor", "GENERAL_TECHNICAL_TERMS_REGISTRY v1.0  +  MASTER_SPC_PLATFORM_REGISTRY v1.0"],
  ["Generated", new Date().toISOString().slice(0, 10)]
]);

calloutBox(
  "Why this protocol exists",
  "Without a written handover, a Fortune 500 Tech Team has to reverse-engineer the Architect's intent from prose. They can't, reliably. The result is agents that pass internal review but quietly diverge from the blueprint that was supposed to govern them — and a regulator who asks 'how was this agent produced?' gets a story instead of evidence. This protocol fixes that by making the MVP-PDD verify URL the auditable bridge between the design-time methodology and the runtime platform."
);

h3("How to read this document");
p("Sections 1–9 are the operating clauses. Each is short and concrete. Section 10 is the signature block. The companion YAML template (azure-foundry-agent-template.yaml) is the field-by-field translation surface — this protocol governs the *process*, the YAML governs the *artifact*. Both must be in place for the handover to be valid.");

// ───────────────────────────────────────────────────────────────────────────
// §1 PARTIES & SCOPE
// ───────────────────────────────────────────────────────────────────────────
sectionHeader("CLAUSE 1", "Parties and scope", ACCENT);

h2("1.1  The two parties");
bullets([
  "ATANDA Architect Organisation — produces blueprints in the ATANDA Command Centre using the FORGE.BONSAI HARNESS (engines F1 through F7 plus DE-SPC). Deliverables: SPCs, Micro Agent (MA) Birth Packages, ATLAS PDDs, and SPARTAN-certified MVP-PDDs with public verify URLs.",
  "F500 Customer AI Platform Team — owns the runtime estate: Microsoft 365 Copilot, Copilot Studio, Azure AI Foundry, Azure OpenAI, Azure AI Search, Azure Functions / Logic Apps, Microsoft Purview, Microsoft Entra ID, Microsoft Defender for Cloud Apps, Power Platform (with DLP policies)."
]);

h2("1.2  In scope");
bullets([
  "Translation of every signed-off MVP-PDD into a deployed Azure AI Foundry agent surfaced via Microsoft 365 Copilot or a Copilot Studio agent.",
  "The governance, telemetry, and evolution cycle that follows each agent into production.",
  "The escalation path when production telemetry breaches the blueprint's quality floor."
]);

h2("1.3  Out of scope");
bullets([
  "Architect-side IP licensing of the FORGE.BONSAI methodology itself (covered by the separate Subscription Agreement).",
  "F500-side procurement of Azure capacity, Copilot licences, or third-party connectors.",
  "Any agent built without an MVP-PDD verify URL — those are governed by the F500's standard internal AI policy, not this protocol."
]);

// ───────────────────────────────────────────────────────────────────────────
// §2 HANDOVER BUNDLE
// ───────────────────────────────────────────────────────────────────────────
sectionHeader("CLAUSE 2", "The handover bundle — what crosses the wall", ACCENT);

p("For every agent the F500 wants in production, the Architect delivers a single bundle. The bundle is complete or it is not delivered — partial handovers are explicitly not permitted by this protocol because they create exactly the 'fill in the gap with engineering intuition' failure mode the protocol exists to prevent.");

h2("2.1  Required artifacts");
table(
  ["#", "Artifact", "Source engine", "What the Tech Team uses it for"],
  [
    ["1", "MVP-PDD (with public verify URL and SPARTAN cert class)", "F7", "The contract; primary citation in every Azure DevOps work item and ARB submission"],
    ["2", "ATLAS PDD (4-Part)", "F6", "Reference doc when the MVP-PDD is too terse to act on a specific detail"],
    ["3", "Super Prompt Card (SPC) — 15 sections, includes GRO contract", "F5 (or DE-SPC for evolved SPCs)", "The runtime spec — fills the Azure AI Foundry agent definition"],
    ["4", "Micro Agent (MA) Birth Package(s) — 8 organelles", "F3", "Tool definitions, memory, grounding, guardrails, data boundary"],
    ["5", "F6-VDJ stack recommendation", "F6-VDJ", "Confirms target stack (Copilot Studio + Foundry + AI Search + Functions)"],
    ["6", "JCSE score & HIVE band at handover", "F1/F2 scoring carried through F5", "Becomes the production quality floor (see Clause 4)"]
  ],
  [28, 165, 100, 175]
);

h2("2.2  Delivery format");
bullets([
  "Bundle delivered as a single signed ZIP attached to a ServiceNow ticket (or equivalent F500 intake system).",
  "The ZIP MUST include the filled `azure-foundry-agent-template.yaml` (companion artifact to this protocol).",
  "The MVP-PDD verify URL MUST be present and resolve to HTTP 200 at the time of intake. Intake reviewer checks this themselves; the Architect's assurance is insufficient evidence."
]);

h2("2.3  Rejection criteria — when the Tech Team MUST refuse the bundle");
bullets([
  "MVP-PDD verify URL is missing, malformed, or returns non-200.",
  "SPARTAN cert class is C (CR_p < 0.40 OR a ZPOS+5 RED vector — the blueprint is not production-grade).",
  "HIVE band at handover is BRONZE and the target use case touches regulated data.",
  "The MA Birth Package's MEMBRANE section is empty AND the agent will process customer PII.",
  "The SPC's §13 governance_signing GRO contract has empty conditions for any of the five states."
]);

// ───────────────────────────────────────────────────────────────────────────
// §3 INTAKE GATE
// ───────────────────────────────────────────────────────────────────────────
sectionHeader("CLAUSE 3", "The intake gate", ACCENT);

p("Every bundle enters the F500's AI governance pipeline through the same intake gate. The verify URL is not an attachment; it is the gate itself.");

h2("3.1  Intake checklist (reviewer fills in writing)");
code(`☐  MVP-PDD verify URL provided
☐  Verify URL resolves to HTTP 200 (checked by reviewer, screenshot attached)
☐  SPARTAN cert class is A or B (recorded: ___ )
☐  HIVE band recorded: ___  (BRONZE / SILVER / GOLD / PLATINUM)
☐  JCSE score recorded: ___  (0–50)
☐  azure-foundry-agent-template.yaml filled and committed to the project repo
☐  Required signatures present (see Clause 9 RACI)
☐  Use case classified against Purview sensitivity scheme
☐  DPO sign-off acquired IF use case touches PII / PHI / PCI`);

h2("3.2  Reviewer authority");
p("The intake reviewer has unilateral authority to reject a bundle that fails any checklist item. Re-submission requires the Architect to re-run the offending engine (typically F5 for GRO completeness or F7 for SPARTAN compression), producing a new MVP-PDD with a new verify URL.");

// ───────────────────────────────────────────────────────────────────────────
// §4 QUALITY FLOOR
// ───────────────────────────────────────────────────────────────────────────
sectionHeader("CLAUSE 4", "Production quality floor", ACCENT);

p("The quality floor is the JCSE / HIVE band recorded at handover. The Tech Team commits to maintaining the agent's production score at or above that floor for the life of the agent. This is the operational contract that makes the methodology accountable past handover.");

h2("4.1  HIVE band → numerical floor");
table(
  ["HIVE band", "JCSE floor", "Foundry evaluator threshold (jcse_equivalent)"],
  [
    ["PLATINUM", "≥ 48", "48.0"],
    ["GOLD",     "≥ 43", "43.0"],
    ["SILVER",   "≥ 36", "36.0"],
    ["BRONZE",   "≥ 30", "30.0"]
  ],
  [120, 120, 228]
);

h2("4.2  Continuous evaluation");
bullets([
  "The Foundry project includes an `jcse_equivalent` custom evaluator that re-scores live traffic samples against the 7 CONTEXT CRAFT pillars nightly.",
  "Sampled, not exhaustive — typically 5% of production traffic, capped at 1,000 evaluations/day.",
  "On breach (score below floor for two consecutive nights), the agent is automatically quarantined (status flipped to 'Inactive' in Copilot Studio; new invocations return a configured fallback message).",
  "Quarantine triggers a P2 incident routed to both the Architect and the Tech Team's AI Governance Lead."
]);

calloutBox(
  "Why the floor is the handover number, not a separate negotiated SLO",
  "If the F500 negotiates a quality floor that is LOWER than the handover score, the methodology is being weakened in production — which is the same as not having used it. If they negotiate a HIGHER floor, the Tech Team is being asked to improve on a blueprint they did not author, which is exactly the failure mode this protocol prevents. The handover number is the contract."
);

// ───────────────────────────────────────────────────────────────────────────
// §5 GRO CONTRACT TRANSLATION
// ───────────────────────────────────────────────────────────────────────────
sectionHeader("CLAUSE 5", "GRO contract translation table", ACCENT);

p("The Golden Rule Orchestrator (GRO) is the Five-State Ethical Governance contract that every F5 SPC carries in §13. It is enforced at the Microsoft platform layer, NOT inside the agent's prompt. The Tech Team commits to keeping every translation row below configured in production. Removing or weakening any row requires a new MVP-PDD (i.e. a re-run through the Architect).");

table(
  ["GRO state", "Meaning", "Microsoft platform enforcement"],
  [
    ["PERMIT", "Action is allowed unconditionally.", "Entra ID Conditional Access: allow rule. No additional gate."],
    ["PERMIT_WITH_LOGGING", "Action is allowed but the full prompt+response is captured for audit.", "Application Insights custom event (gro_state=PERMIT_WITH_LOGGING). Purview audit log capture enabled on the agent."],
    ["REQUIRE_HUMAN_REVIEW", "Action proceeds only after a named human approves.", "Copilot Studio routes to a human-handoff topic. Power Automate creates a ServiceNow ticket assigned to the approver pool."],
    ["DEFER", "Action is declined; the agent escalates to its owner.", "Agent returns the canned 'I cannot help with that — escalating' message. Power Automate notifies the agent owner via Teams."],
    ["REFUSE", "Action is blocked before it ever reaches the model.", "Azure AI Content Safety pre-filter blocks the request. Defender for Cloud Apps raises a security alert."]
  ],
  [105, 175, 188]
);

p("Every GRO state's *condition* (what triggers it) is copied verbatim from the SPC's §13 into the Foundry agent's `gro_contract.states[*].condition` field. The Tech Team does not interpret these conditions — they implement the Microsoft platform enforcement on the right-hand side and route the agent to it.");

// ───────────────────────────────────────────────────────────────────────────
// §6 TELEMETRY ROUND-TRIP
// ───────────────────────────────────────────────────────────────────────────
sectionHeader("CLAUSE 6", "Telemetry round-trip", ACCENT);

p("The blueprint must learn from production. This clause defines how runtime data flows back to the Architect for the next DE-SPC cycle.");

h2("6.1  What flows back");
bullets([
  "Daily JCSE-equivalent evaluator scores (nightly job output from Azure AI Foundry).",
  "Hourly counters: invocations, fallbacks, human handoffs, GRO state distribution.",
  "Weekly P95 / P99 latency, token usage per invocation, tool-call success rate.",
  "Incident reports for any quarantine event (see Clause 7)."
]);

h2("6.2  Format and channel");
bullets([
  "Format: newline-delimited JSON (NDJSON), one event per line. Schema documented in the Foundry project repo at /telemetry/schema.json.",
  "Channel (Phase 1 — manual): the Tech Team exports an NDJSON file weekly and uploads it via the Command Centre's `/account → Import telemetry` form.",
  "Channel (Phase 2 — automated, scheduled for protocol revision once the VIOLET phase ships per PDD 2 Part 3): a partner integration surface in the Command Centre pulls the NDJSON via OAuth client credentials on a schedule. No raw prompts cross the boundary — only metrics, hashes, and metadata."
]);

h2("6.3  Phase 1 manual cadence (default)");
kv([
  ["Cadence", "Weekly export, Monday 02:00 UTC"],
  ["Owner (F500 side)", "Tech Team Lead or named delegate"],
  ["Owner (ATANDA side)", "Architect of record for the agent"],
  ["Quarterly review", "Architect runs DE-SPC against accumulated telemetry; produces a new SPC and a new MVP-PDD verify URL"]
]);

h2("6.4  Data minimisation");
p("No raw prompts or responses leave the F500's tenant. The telemetry stream contains hashes (SHA-256 of normalised prompt and response), scores, counters, and tool-call metadata. The Architect uses these to re-tune the CONTEXT CRAFT rubric — not to read user data. This is the technical underpinning that lets DPOs sign off the round-trip.");

// ───────────────────────────────────────────────────────────────────────────
// §7 ESCALATION
// ───────────────────────────────────────────────────────────────────────────
sectionHeader("CLAUSE 7", "Escalation path", ACCENT);

p("When the production agent breaches its quality floor or its GRO contract, the escalation path is fixed. Both parties commit to it.");

h2("7.1  Severity scheme");
table(
  ["Severity", "Trigger", "Response time", "Action"],
  [
    ["SEV-1", "REFUSE state breach (Content Safety bypassed) OR confirmed data-egress against MEMBRANE.", "1 hour", "Immediate agent quarantine. Joint Architect + Tech Team incident bridge. DPO + CISO notified."],
    ["SEV-2", "JCSE floor breach for two consecutive nights, OR ≥3× quarantine in 30 days.", "8 business hours", "Automated quarantine. Architect runs DE-SPC within 10 business days; new MVP-PDD issued."],
    ["SEV-3", "Tool-call success rate <90% in any 24h window.", "2 business days", "Tech Team investigates; if root cause is blueprint-side, escalate to SEV-2."],
    ["SEV-4", "Telemetry export missed for >2 consecutive weeks.", "Next business day", "Tech Team Lead notified; second miss freezes any new agent intakes under this protocol until cured."]
  ],
  [60, 200, 90, 138]
);

h2("7.2  Right of either party to quarantine");
p("Both the Architect and the Tech Team Lead have unilateral authority to quarantine the agent. Quarantine is reversible only by joint sign-off (both parties). This is deliberate — disagreement on whether an agent should be live is resolved by the agent being not-live, not by the agent staying live while the disagreement is debated.");

// ───────────────────────────────────────────────────────────────────────────
// §8 EVOLUTION
// ───────────────────────────────────────────────────────────────────────────
sectionHeader("CLAUSE 8", "Evolution & DE-SPC cadence", ACCENT);

p("Agents are not static. The ATANDA Command Centre's DE-SPC engine (Digitally Evolved SPC) is the formal mechanism for blueprint evolution based on accumulated production telemetry.");

h2("8.1  Cadence");
bullets([
  "Default: quarterly DE-SPC review per production agent.",
  "Triggered earlier by: a SEV-2 escalation; a material change to the use case scope; a change to the underlying Microsoft model catalogue that the F6-VDJ stack recommendation depended on.",
  "Output of a DE-SPC cycle: a new SPC, a new ATLAS PDD, a new MVP-PDD with a new verify URL — all of which re-enter the handover bundle at Clause 2."
]);

h2("8.2  Re-handover is a full handover");
p("There is no shortcut. A DE-SPC re-blueprint goes through the same intake gate (Clause 3), the same quality floor commitment (Clause 4 — the new floor may be higher, never lower), and the same RACI sign-offs (Clause 9). The verify URL on the new MVP-PDD replaces the old one in every audit-bearing field.");

// ───────────────────────────────────────────────────────────────────────────
// §9 RACI
// ───────────────────────────────────────────────────────────────────────────
sectionHeader("CLAUSE 9", "RACI matrix", ACCENT);

p("Roles are role-based, not name-based; the named individuals are recorded in the per-agent signoff block of the Foundry agent YAML. R = Responsible, A = Accountable, C = Consulted, I = Informed.");

table(
  ["Activity", "Architect", "Tech Lead", "Foundry Eng.", "Copilot Maker", "Purview Admin", "Entra Admin", "DPO"],
  [
    ["Produce handover bundle (SPC/MA/PDD/MVP-PDD)", "R/A", "C", "I", "I", "I", "I", "I"],
    ["Intake gate sign-off (Clause 3)", "C", "A", "C", "C", "C", "I", "C"],
    ["Build Foundry agent from filled YAML", "C", "A", "R", "I", "I", "I", "I"],
    ["Build Copilot Studio surface", "C", "A", "I", "R", "I", "I", "I"],
    ["Apply Purview labels + DLP policies", "C", "A", "I", "I", "R", "I", "C"],
    ["Configure Entra ID groups + Conditional Access", "I", "A", "I", "I", "I", "R", "I"],
    ["DPO sign-off on PII / PHI / PCI flows", "C", "A", "I", "I", "C", "I", "R"],
    ["Promote to production", "I", "A", "R", "R", "R", "R", "C"],
    ["Maintain quality floor (Clause 4)", "C", "A", "R", "R", "I", "I", "I"],
    ["Quarantine + escalation handling (Clause 7)", "R", "R/A", "C", "C", "C", "C", "C"],
    ["Quarterly DE-SPC review (Clause 8)", "R/A", "C", "I", "I", "I", "I", "I"]
  ],
  [185, 50, 50, 50, 60, 55, 50, 32]
);

// ───────────────────────────────────────────────────────────────────────────
// §10 SIGNATURES
// ───────────────────────────────────────────────────────────────────────────
sectionHeader("CLAUSE 10", "Signatures", ACCENT);

p("This protocol is effective when both signature blocks below are complete. A signed copy is filed in the F500's contracts repository and in the ATANDA Architect organisation's customer-engagement vault. Material changes to any clause require both parties to re-sign.");

doc.moveDown(1);
h3("For the ATANDA Architect Organisation");
kv([
  ["Name", "____________________________________________"],
  ["Title", "____________________________________________"],
  ["Date", "____________________________________________"],
  ["Signature", "____________________________________________"]
]);

doc.moveDown(0.6);
h3("For the F500 Customer AI Platform Team");
kv([
  ["Name", "____________________________________________"],
  ["Title", "____________________________________________"],
  ["Date", "____________________________________________"],
  ["Signature", "____________________________________________"]
]);

doc.moveDown(0.6);
h3("Counter-signature — F500 AI Governance Lead (required)");
kv([
  ["Name", "____________________________________________"],
  ["Title", "____________________________________________"],
  ["Date", "____________________________________________"],
  ["Signature", "____________________________________________"]
]);

doc.moveDown(0.6);
h3("Counter-signature — F500 Data Protection Officer (required if any agent under this protocol processes PII / PHI / PCI)");
kv([
  ["Name", "____________________________________________"],
  ["Title", "____________________________________________"],
  ["Date", "____________________________________________"],
  ["Signature", "____________________________________________"]
]);

doc.moveDown(1);
hr(ACCENT);
doc.fillColor(SOFT).font("Helvetica-Oblique").fontSize(9).text(
  `Generated ${new Date().toISOString().slice(0, 10)} · ATANDA × F500 Handover Protocol · Companion artifact: docs/azure-foundry-agent-template.yaml · Methodology anchor: ATANDA Command Centre PDD 2 · Registry: GENERAL_TECHNICAL_TERMS_REGISTRY v1.0 + MASTER_SPC_PLATFORM_REGISTRY v1.0`,
  { align: "center" }
);

doc.end();
console.log(`Wrote ${OUT_PATH}`);
