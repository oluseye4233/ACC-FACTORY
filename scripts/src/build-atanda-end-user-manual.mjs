// Generates the current ATANDA Command Centre end-user manual.
// Run with: node scripts/src/build-atanda-end-user-manual.mjs

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
const outputName = "ATANDA_Command_Centre_End_User_Manual_2026-09-23.pdf";
const outputPath = path.join(docsDir, outputName);
const exportPath = path.join(exportsDir, outputName);

fs.mkdirSync(docsDir, { recursive: true });
fs.mkdirSync(exportsDir, { recursive: true });

const doc = new PDFDocument({
  size: "A4",
  bufferPages: true,
  margins: { top: 54, bottom: 52, left: 54, right: 54 },
  info: {
    Title: "ATANDA Command Centre — End User Manual",
    Author: "ATANDA Command Centre",
    Subject: "Step-by-step guide to using the ACC PromptWare production workflow",
    Keywords: "ATANDA, ACC, Command Centre, HARNESS, user manual, Use Case Alpha",
  },
});
const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);
const t = createTheme(doc);

function cover() {
  doc.rect(0, 0, doc.page.width, doc.page.height).fill("#f8fafc");
  doc.save().fillColor(NAVY).rect(0, 0, doc.page.width, 178).fill().restore();
  doc.save().fillColor(ACCENT).rect(0, 178, doc.page.width, 9).fill().restore();
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(11)
    .text("ATANDA  /  COMMAND CENTRE", 54, 54, { characterSpacing: 2 });
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(34)
    .text("ACC", 54, 91);
  doc.fillColor("#d9f0f2").font("Helvetica").fontSize(17)
    .text("End User Manual", 54, 137);
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(27)
    .text("From a raw idea to a governed AI transformation handoff", 54, 244, { width: 480 });
  doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(13)
    .text("A step-by-step walkthrough for operators, engineers, architects, and transformation teams", 54, 328, { width: 470 });
  doc.fillColor("#374151").font("Helvetica").fontSize(11)
    .text(
      "This manual explains what to do in the Command Centre, what each stage produces, how to use the side-step tools, and how to recognize the correct next action.",
      54, 369, { width: 465, lineGap: 4 },
    );
  doc.save().fillColor("#e7f3f4").roundedRect(54, 472, 487, 122, 8).fill().restore();
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(10)
    .text("READ THIS FIRST", 72, 494, { characterSpacing: 1.5 });
  doc.fillColor("#374151").font("Helvetica").fontSize(10.5)
    .text(
      "ACC is a guided production line, not a chat window. Each stage creates an owned artifact, and later stages are unlocked only when their inputs and evidence are present. The interface keeps the previous stage, current workspace, and next handoff visible.",
      72, 516, { width: 450, lineGap: 3 },
    );
  doc.fillColor(SOFT).font("Helvetica").fontSize(9)
    .text("Current manual · 23 September 2026 · Internal working document", 54, 735);
}

function section(label, title, accent = PHASE_COLOURS.BLUE) {
  t.partHeader(label, title, accent);
}

function step(number, title, action, result) {
  t.h3(`${number}. ${title}`);
  t.p(action);
  t.kv([["You should have", result]]);
}

function scenario(title, audience, goal, path, outcome) {
  t.h2(title);
  t.kv([
    ["Best for", audience],
    ["Starting goal", goal],
    ["Recommended path", path],
    ["Expected outcome", outcome],
  ]);
}

cover();

section("PART 01", "Orientation: what ACC is and how to think about it", PHASE_COLOURS.BLUE);
t.h1("The Command Centre in one sentence");
t.lead(
  "ATANDA Command Centre turns a fuzzy business or engineering idea into a structured, traceable, and appropriately gated implementation handoff.",
);
t.p(
  "ACC is the operating surface for the FORGE.BONSAI HARNESS. You begin with a prompt, source document, or domain cartridge. You then move through a sequence of analysis, specification, certification, code generation, machine-floor validation, release, and host-connection stages. The system saves each result as an artifact so that a later operator can understand what was decided and why.",
);
t.h2("The three rules that make ACC useful");
t.bullets([
  "Start with a bounded outcome. Describe the user, the operational problem, the desired result, and what must not happen.",
  "Treat each artifact as a contract. Do not ask a later stage to repair a missing or contradictory earlier decision.",
  "Use the correct path for the target. Software, firmware, host integration, and physical deployment have different evidence requirements.",
]);
t.h2("The main workspace areas");
t.table(
  ["Area", "Use it for", "Typical first action"],
  [
    ["Command", "The linear stage cockpit and session production line.", "Open or create a session."],
    ["Sessions", "Review active work, artifacts, source context, and stage state.", "Open the session with the closest business goal."],
    ["Ingest", "Bring an existing document into a traceable session.", "Upload the source document and review extraction."],
    ["Cartridge", "Apply a configured domain context to repeated work.", "Choose the authoritative project or domain context."],
    ["Exemplars", "Browse, fork, or contribute high-quality reference artifacts.", "Open a relevant exemplar before starting from zero."],
    ["Prompts", "Review saved prompt assets and reusable prompt material.", "Inspect a prior prompt before rewriting it."],
    ["Quests / Ascension", "See evidence-based learning and progression signals.", "Review which completed artifacts unlock the next challenge."],
    ["Account / Activity / Costs", "Manage profile, export data, review audit history, and inspect spend.", "Check activity and cost before a large run."],
    ["F10 / SPC Player", "Use release or capability-brief workflows outside the core session rail.", "Open only when the project has reached the relevant handoff."],
  ],
  [0.20, 0.47, 0.33],
);
t.h2("What ACC does not do");
t.bullets([
  "It does not turn a vague idea directly into an unreviewed production deployment.",
  "A generated profile, reference standard, or model output is not proof of certification.",
  "F9 and F10 refuse when required external evidence, custody, consent, or connector readiness is missing.",
  "A passing development test or generated artifact does not prove that a live provider, deployment, or external integration is healthy.",
]);

section("PART 02", "Start a session and choose your source", PHASE_COLOURS.ORANGE);
t.h1("Step-by-step: get a clean session started");
t.lead("A good session has one clear transformation target and one authoritative source.");
step(
  "1",
  "Enter the Command Centre",
  "Open ACC and enter the staff access details. Use your real name or initials so later activity and artifacts can be attributed to the correct operator.",
  "The Command route opens and the stage cockpit is available.",
);
step(
  "2",
  "Create or open a session",
  "Choose a new session for a new problem. Reopen an existing session when you are continuing the same product or transformation effort.",
  "A session with a persistent artifact tray and stage state.",
);
step(
  "3",
  "Choose the source path",
  "Use a manual prompt for a new idea, Ingest for an existing document or IPDD, or Cartridge when a domain/project context should be inserted into every engine call.",
  "A source context that later stages can trace back to.",
);
step(
  "4",
  "Write the outcome before the implementation",
  "State who needs the result, what is currently difficult, what the system should produce, the boundaries, and how success will be measured.",
  "A prompt with enough signal for F1 to diagnose instead of guessing.",
);
step(
  "5",
  "Check the artifact tray",
  "After each run, confirm that the artifact was persisted. Use the previous/current/next cockpit columns to decide whether to continue, revise, or stop.",
  "A traceable chain instead of a collection of unlinked chat responses.",
);

section("PART 03", "The core F process: F1 through F7", PHASE_COLOURS.YELLOW);
t.h1("Move from idea to certified product definition");
t.p(
  "The core rail is intentionally sequential. The names are less important than the handoffs: diagnosis becomes an executable instruction, the instruction becomes an agent or system contract, and the contract becomes a certified implementation source.",
);
t.phaseBlock({
  colourName: "RED",
  header: "F1 — Prompt Diagnostic",
  duration: "first pass",
  status: "Prompt quality gate",
  deliverables: ["Scores the intent across system, role, instruction, example, constraint, format, and data.", "Identifies omissions, ambiguity, and unsafe assumptions."],
  exit: "You can explain what the system is supposed to do and what it must not do.",
});
t.phaseBlock({
  colourName: "ORANGE",
  header: "F2 — Atomic Prompt",
  duration: "rewrite",
  status: "Executable instruction",
  deliverables: ["Rewrites the request into one bounded instruction.", "Makes role, intent, constraints, inputs, and output format explicit."],
  exit: "The instruction is singular enough to execute and test.",
});
t.phaseBlock({
  colourName: "YELLOW",
  header: "F3 — CELL Micro Agent Creator",
  duration: "design",
  status: "Agent boundary",
  deliverables: ["Defines persona, capabilities, context needs, guardrails, and lifecycle.", "Checks whether the request is still a micro-agent or needs escalation."],
  exit: "The worker has a bounded job and a defined retirement or escalation condition.",
});
t.phaseBlock({
  colourName: "GREEN",
  header: "F4 — Micro PDD / MPDD",
  duration: "specification",
  status: "Deploy-shaped micro-spec",
  deliverables: ["Converts the birth package into a compact product design document.", "Captures user, behavior, inputs, outputs, failure modes, and acceptance criteria."],
  exit: "An engineer can review the micro-spec without reopening the original conversation.",
});
t.phaseBlock({
  colourName: "BLUE",
  header: "F5 — SPC",
  duration: "system contract",
  status: "Practitioner-gated",
  deliverables: ["Expands the micro-spec into the full Super Prompt Card system contract.", "Carries ethical, compliance, and operational controls."],
  exit: "The system contract is complete enough for an ATLAS PDD.",
});
t.phaseBlock({
  colourName: "INDIGO",
  header: "F6 — ATLAS PDD",
  duration: "blueprint",
  status: "Implementation-ready document",
  deliverables: ["Produces the four-part ATLAS PDD: cheat sheet, executive summary, worksheet, and implementation plan.", "Provides the source for ATLAS 360 PLAN and SCAN side-steps."],
  exit: "The project has an auditable blueprint and a clear build boundary.",
});
t.phaseBlock({
  colourName: "VIOLET",
  header: "F7 — SPARTAN MVP PDD",
  duration: "certification",
  status: "Architect-gated",
  deliverables: ["Compresses the ATLAS PDD through a math-audited scope and risk pass.", "Produces a certified MVP PDD/PWDD and public verification URL when the gates pass."],
  exit: "Only then may the project proceed to Code DJ or the Machine Floor.",
});

section("PART 04", "Side-step tools and evidence views", PHASE_COLOURS.GREEN);
t.h1("Use side-steps when the project needs a different kind of answer");
t.h2("ATLAS 360 PLAN");
t.p("PLAN turns the PDD into a structured execution view for delivery teams. Use it to break the work into implementation areas, dependencies, sequencing, and evidence. It is a planning overlay, not a replacement for F7 certification.");
t.h2("ATLAS 360 SCAN");
t.p("SCAN turns the PDD and repository evidence into an assurance profile. Use it to separate implemented behavior from unverified production, security, external-integration, and operational evidence. A SCAN is honest only when it preserves those distinctions.");
t.h2("F6-VDJ / VIBE ORACLE");
t.p("Use this when the PDD is clear but you need a recommended IDE, framework, or build posture. Treat its output as a recommendation that still has to be checked against the project’s constraints.");
t.h2("F8-HDJ / HOST ORACLE");
t.p("Use this to rank host and deployment options for a certified MVP PDD. It does not replace the release gateway or provider acceptance.");
t.h2("MATHMON and PFP");
t.p("MATHMON profiles whether mathematical or verification methods apply. PFP compares a certified MVP PDD with an F8 codebase bundle and blocks new work when critical drift remains unless an operator explicitly acknowledges it.");
t.h2("Exemplar Library");
t.p("Browse canonical artifacts, fork a useful example into a new session, or contribute a file in a supported format. A fork is a starting point, not automatic approval for your new use case.");
t.h2("SPC Player");
t.p("The SPC Player is a separate, open-access capability-brief cockpit. Register a brief, select draft cards, review the governance policy, export the manifest, execute, and optionally authorize one owned run for public HTTPS webhook delivery. Environment sketches are documentation, not live integrations.");

section("PART 05", "Build, validate, release, and connect", PHASE_COLOURS.VIOLET);
t.h1("The post-certification path");
t.p("After F7, the correct next stage depends on where the result will run.");
t.h2("F8 — Code ORACLE / Code DJ");
t.bullets([
  "Choose a target platform and generate a codebase bundle from the certified MVP PDD.",
  "The server refuses uncertified sources and records the source artifact lineage.",
  "The bundle contains files, a manifest, and implementation notes for the selected platform.",
  "For Firmware, select the hardware profile that matches the target device. The profile customizes scaffolding but is not certification evidence.",
  "Software bundles can continue directly to F10/F11. Firmware bundles continue through F9.",
]);
t.h2("F9 — MECHA ULTRA SI Machine Floor");
t.bullets([
  "Use F9 for physical or firmware targets that require a bounded, versioned, signed Machine Artifact.",
  "Supply all seven ordered phases and their external gate evidence.",
  "The Machine Floor refuses incomplete, contradictory, unsafe, or unverifiable evidence.",
  "For appliance fleets, the APPLIANCE_FLEET profile is a reference baseline for secure boot, signed OTA rollback, telemetry isolation, and local fail-safe behavior.",
]);
t.h2("F9.5 — OSIRIS custody");
t.p("OSIRIS holds the emitted artifact in an attested custody state. It does not repair, mutate, or certify the artifact. A deviation sends the work back for review rather than silently changing the source.");
t.h2("F10 — Connector and Release Gateway");
t.bullets([
  "Use F10 for authorized release, export, provider delivery, or a colonization run.",
  "Physical targets require an active F9 attestation, UCG evidence, deployment subject, consent, and a qualified connector path.",
  "Start with a sense-only or staging posture when the target is new. Provider acceptance is a delivery receipt, not proof that the external system executed successfully.",
  "The current environment fails closed when the required external connector/analyzer/SAVANT adapters are not wired.",
]);
t.h2("F11 — Host Connector");
t.p("Use F11 to connect a certified project to its host or operator environment. It helps turn the implementation bundle into a host/deployment journey while preserving the certified source boundary.");

section("PART 06", "Scenario playbooks", PHASE_COLOURS.ORANGE);
t.h1("Use the process against real work");
scenario(
  "Use Case Alpha — Full Stack Engineer to Forward Deployed Engineer",
  "Full Stack engineers who need to lead AI transformation inside their own organizations.",
  "Learn to translate an organizational workflow into a governed AI transformation plan, then produce a credible build and adoption handoff.",
  "Create a training session for one internal workflow and run F1–F7. Use PLAN to teach execution sequencing, SCAN to teach evidence and risk, F8 to show the implementation handoff, and F11 to show how the host environment receives the result.",
  "A repeatable training artifact that demonstrates discovery, specification, certification, engineering handoff, stakeholder communication, and operational evidence.",
);
t.h3("Alpha walkthrough");
step("A1", "Choose a transformation assignment", "Example: the company’s support, finance, sales, or operations team spends too much time classifying work and routing it to the right owner.", "A one-sentence problem statement, named users, baseline metric, and a decision about what remains human-controlled.");
step("A2", "Run F1 and F2 as discovery practice", "The engineer learns to identify hidden assumptions, missing data, unclear ownership, and vague success language before proposing a model.", "A diagnosed prompt and an atomic prompt that an engineer can test.");
step("A3", "Run F3 and F4 as product practice", "Define the worker’s role, tools, context, guardrails, lifecycle, failure behavior, and escalation path.", "A Micro Agent birth package and MPDD with acceptance criteria.");
step("A4", "Run F5 and F6 as architecture practice", "Expand the worker into a system contract and then a full ATLAS PDD. Ask the engineer to explain the data flow, user journey, and operating boundaries to a non-engineer.", "A reviewable blueprint with a clear implementation boundary.");
step("A5", "Run F7 as evidence practice", "Compress the project, review the score and risk gate, and publish the verification URL only when the certification conditions pass.", "A certified MVP PDD/PWDD and an auditable reason for the scope.");
step("A6", "Run F8/F11 as delivery practice", "Generate a codebase bundle, review the manifest, inspect any PFP drift findings, then prepare the host handoff.", "A portable implementation handoff and a host-specific next step.");
step("A7", "Assess the engineer", "Do not grade them on prompt cleverness. Grade discovery quality, boundary setting, evidence quality, stakeholder explanation, and whether the proposed system can be operated safely.", "Forward Deployed Engineer behavior: translating between users, business operations, engineering, and AI capability.");
t.h2("Alpha training loop");
t.table(
  ["Training skill", "ACC evidence", "Coach question"],
  [
    ["Discovery", "F1 diagnosis and F2 atomic prompt", "What did you learn that was missing from the original request?"],
    ["Product thinking", "F3 birth package and F4 MPDD", "What is the worker’s bounded job, and when must it escalate?"],
    ["Architecture", "F5 SPC and F6 ATLAS PDD", "Where are data, authority, failure, and human review located?"],
    ["Assurance", "F7 certification and SCAN", "Which claims are proven, and which are still open?"],
    ["Delivery", "F8 bundle and F11 host plan", "Can another engineer or operator pick this up without the original author?"],
  ],
  [0.23, 0.39, 0.38],
);

scenario(
  "Use Case Beta — Smart dispenser fleet",
  "Teams embedding asset analysis and inventory management into connected dispensers.",
  "Track inventory and asset health while keeping local dispenser control safe during network loss, sensor failure, or interrupted updates.",
  "Create a firmware path and a related software path. Use F8 with artifact class FIRMWARE and the APPLIANCE_FLEET profile; use a separate Software bundle for cloud analytics or host UI. Send the firmware through F9 before F10.",
  "A signed, evidence-bound firmware artifact, a separately governed analytics/inventory experience, and a release request that refuses until physical-target gates and connectors are ready.",
);
t.bullets([
  "Define asset identity, SKU/lot/expiry, fill-level events, dispense events, reconciliation rules, offline queues, and operator permissions in F4–F6.",
  "Keep LLM-based analysis out of the real-time dispense-control path. Use bounded local rules for safety and authorized remote commands.",
  "Use F9 evidence for secure boot, signed OTA rollback, fail-safe behavior, sensor failure, network loss, and control-path boundaries.",
  "Start F10 in sense-only or staging mode. The current connector path intentionally refuses live colonization until qualified adapters are available.",
]);

scenario(
  "Use Case Gamma — Support operations triage",
  "Product and operations teams that need an AI worker to classify and route incoming support work.",
  "Reduce manual triage while preserving human escalation, audit history, and measurable routing quality.",
  "Start with a manual prompt or an ingested support playbook. Run F1–F7, use F8 with artifact class SOFTWARE, and connect the host workflow through F11.",
  "A certified software blueprint, implementation bundle, routing acceptance metrics, and an explicit human-review path.",
);
t.bullets([
  "Use F1 to expose ambiguous labels and missing escalation rules.",
  "Use F3 to define what the triage worker can classify and what it must send to a human.",
  "Use F7 to lock the MVP scope before generating code.",
  "Use PFP after F8 to compare the bundle with the certified PDD and resolve critical drift.",
]);

scenario(
  "Use Case Delta — Existing organization playbook",
  "A team with an existing design document, policy, or operating manual.",
  "Convert existing knowledge into a traceable AI transformation artifact without losing source lineage.",
  "Use Ingest, review the extracted source, optionally apply a Cartridge, then run the F1–F7 path. The result is a PWDD when the session originates from an ingested document.",
  "A source-linked, reviewable product definition instead of an untraceable rewrite.",
);

section("PART 07", "Daily operator checklist", PHASE_COLOURS.BLUE);
t.h1("Before, during, and after a run");
t.h2("Before you run");
t.bullets([
  "Do I know the user, business outcome, and decision the system supports?",
  "Is the source prompt or document authoritative and current?",
  "Am I creating Software, Firmware, a host integration, or a physical release?",
  "Will this run consume meaningful model budget? Check the Costs view before starting a batch.",
  "Do I have the access, ownership, and external evidence required for the next stage?",
]);
t.h2("While you run");
t.bullets([
  "Read the current stage’s input and gate before pressing run.",
  "Treat the output as a draft until it is persisted and reviewed.",
  "Use the artifact tray and activity history to preserve the chain.",
  "Stop and revise when the output changes the problem instead of silently accepting drift.",
  "Keep safety-critical control paths deterministic and human-reviewable.",
]);
t.h2("After you run");
t.bullets([
  "Name the important artifact so another operator can find it.",
  "Review PFP findings after F8 and acknowledge drift only after review.",
  "Export the document, ZIP, IDE bundle, or GitHub-ready handoff when the audience needs it.",
  "Use /verify for public certification checks when an F7 verification URL exists.",
  "Record unresolved risks as the next evidence request, not as a hidden assumption.",
]);
t.h2("Where to find operational history");
t.table(
  ["Need", "ACC location"],
  [
    ["Your previous generated work", "Sessions and the session artifact tray"],
    ["Chronological action history", "Activity"],
    ["LLM spend by engine and user", "Costs / company spend views"],
    ["Public certification check", "Verify route and the F7 public URL"],
    ["Reusable patterns", "Exemplars and Prompts"],
    ["Progress and learning signals", "Quests and Ascension"],
    ["Account export or deletion", "Account"],
    ["Operational staff controls", "Admin Ops and Admin Badges"],
  ],
  [0.36, 0.64],
);

section("PART 08", "Troubleshooting and honest handoffs", PHASE_COLOURS.VIOLET);
t.h1("When ACC stops you, use the refusal as information");
t.h2("“Certified MVP PDD required”");
t.p("You are trying to use F8 or a downstream stage without a valid F7 source. Return to the session, select the certified MVP PDD/PWDD, and confirm that it belongs to the same session and operator.");
t.h2("“Drift gate: critical findings outstanding”");
t.p("PFP found critical divergence between the PDD and code bundle. Review the finding, fix the bundle or update the certified source through the proper path, then retry. Do not acknowledge drift just to force progress.");
t.h2("“Hardware configuration required” or “mismatch”");
t.p("Firmware must name its reference hardware profile, and F9 must use the same profile persisted by F8. Regenerate F8 when the target hardware has changed.");
t.h2("F9 refuses");
t.p("F9 is designed to refuse incomplete or unverifiable external evidence. Read the cited phase, constraint, invariant, cause, and required-to-proceed field. Supply the missing gate evidence or stop the run.");
t.h2("F10 refuses a physical target");
t.p("Physical targets require a valid F9 attestation, active custody, UCG evidence, consent, and a qualified connector path. A refusal is expected when an external analyzer or SAVANT adapter is not wired.");
t.h2("Provider, quota, or cost-cap error");
t.p("Check the error status, Costs view, and the configured provider path. A cost-cap response is different from a tier or permission response. Do not retry a blocked call repeatedly without changing the condition.");
t.h2("The right handoff format");
t.bullets([
  "Give the next person the session name, artifact name, source lineage, verification URL if present, and unresolved evidence list.",
  "Include the target class: Software, Firmware, Appliance IoT, Robotics, or host integration.",
  "State what is verified, what is implemented but unverified, and what is unavailable.",
  "Never describe a reference profile or generated scaffold as certification.",
]);

section("PART 09", "Quick reference", PHASE_COLOURS.GREEN);
t.h1("The ACC path on one page");
t.table(
  ["Stage", "Question it answers", "Primary output"],
  [
    ["F1", "What is unclear or unsafe in the request?", "Prompt diagnostic"],
    ["F2", "Can the request be stated as one executable instruction?", "Atomic Prompt"],
    ["F3", "What bounded worker or agent is being created?", "CELL birth package"],
    ["F4", "What is the compact product specification?", "Micro PDD / MPDD"],
    ["F5", "What is the full system contract?", "SPC"],
    ["F6", "How will the product be understood and built?", "ATLAS PDD"],
    ["F7", "Is the MVP scope certified and verifiable?", "Certified MVP PDD / PWDD"],
    ["F8", "What codebase handoff follows the certified source?", "Codebase bundle"],
    ["F9", "Can the firmware/machine artifact pass its external gates?", "Signed Machine Artifact or refusal"],
    ["F9.5", "Is the artifact in active custody?", "Attestation state"],
    ["F10", "Can the artifact be released through an authorized connector?", "Receipt, export, ACK, or refusal"],
    ["F11", "How does the host environment receive the result?", "Host/deployment handoff"],
    ["PLAN / SCAN", "How should the work be executed or assured?", "Read-only planning or assurance view"],
  ],
  [0.16, 0.50, 0.34],
);
t.h2("Final operating principle");
t.lead(
  "ACC is most valuable when it makes the next decision clearer than the previous one.",
);
t.p(
  "Use it to make work more explicit, more reviewable, and easier to hand to another person. Continue only when the artifact, evidence, and target boundary agree. When they do not agree, stop, read the refusal, and repair the source rather than hiding the discrepancy.",
);
t.hr(ACCENT);
doc.fillColor(SOFT).font("Helvetica-Oblique").fontSize(9)
  .text("ATANDA Command Centre · End User Manual · 23 September 2026 · Internal working document", { align: "center" });

const pageRange = doc.bufferedPageRange();
for (let i = pageRange.start; i < pageRange.start + pageRange.count; i += 1) {
  doc.switchToPage(i);
  const y = doc.page.height - 32;
  doc.save().strokeColor("#d1d5db").lineWidth(0.5)
    .moveTo(doc.page.margins.left, y - 8)
    .lineTo(doc.page.width - doc.page.margins.right, y - 8)
    .stroke().restore();
  doc.fillColor("#6b7280").font("Helvetica").fontSize(8)
    .text("ATANDA COMMAND CENTRE  ·  END USER MANUAL", doc.page.margins.left, y, { width: 280 });
  doc.text(`23 September 2026  ·  ${i + 1}`, 0, y, {
    align: "right", width: doc.page.width - doc.page.margins.right,
  });
}

doc.end();
await new Promise((resolve, reject) => {
  stream.once("finish", resolve);
  stream.once("error", reject);
});
fs.copyFileSync(outputPath, exportPath);
console.log(`Wrote ${outputPath}`);
console.log(`Copied ${exportPath}`);