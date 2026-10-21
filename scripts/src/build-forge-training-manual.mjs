import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { LEARNING_LESSONS, CURRICULUM_VERSION } from "../../artifacts/api-server/src/lib/learning-curriculum.ts";
import { createTheme, NAVY, ACCENT, SOFT } from "./lib/atlas-pdf-theme.mjs";

// Documentary build only: no database, authentication or application mutations.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(root, "lib/export/package.json"));
const PDFDocument = require("pdfkit");
const dir = path.join(root, "generated-artifacts/forge-training-manual");
fs.mkdirSync(dir, { recursive: true });
const output = path.join(dir, "FORGE_FIELD_ENGINEER_Cohort_Training_Manual.pdf");

// Suggested teaching procedures supplement, but never change, the live curriculum.
const procedures = {
  orientation: [
    "Open the Guide and locate the ARK Harness stages. Open Quests and Ascension in separate tabs; record your current statuses without claiming anything you have not earned.",
    "Write down your chosen track, cohort end date and available allowance. Distinguish a course review, an artifact, a badge and a certification.",
    "Map ASPE to four MA packages and three SPCs; map AISA to a Micro, ATLAS and MVP PDD. Record the existing URL claim route for AISE.",
    "Create an evidence log for your own work. Set one architecture goal and, if applicable, one engineering goal."
  ],
  baseline: [
    "Open Ascension and its JST section. Read the assessment instructions and complete the available baseline honestly.",
    "Save the assessment reference and date in your private learning log. Do not invent a baseline if the assessment is unavailable.",
    "Identify one observed gap, such as writing a clear refusal boundary, and connect it to a planned exercise.",
    "Submit a short reflection explaining what you will practise and how you will recognise improvement."
  ],
  f0: [
    "Read the fictional DEMO-07 report. List the requester, coordinator, desired outcome and facts actually supplied.",
    "Separate confirmed facts from questions: exact failure, location detail, requested-date interpretation and equipment classification may be unknown.",
    "Compare a structured form, a spreadsheet and an AI-assisted intake workflow. Explain the bear case: an invented diagnosis or unsafe repair advice.",
    "Record a bounded discovery decision: structure requests for human review; do not diagnose, schedule or dispatch automatically."
  ],
  f1: [
    "Create or open a session you own and give it a recognisable workshop-intake title. Supply the fictional brief to F1.",
    "Ask the diagnostic to expose ambiguous intent, missing users, output format, constraints and unsafe assumptions.",
    "Review its findings against the brief. Reject any unsupported claim that the bench is safe, repaired or ready to operate.",
    "Save the PROMPT_DIAGNOSTIC artifact reference. Explain one unresolved assumption and the next question for the requester."
  ],
  f2: [
    "Use your diagnostic to select exactly one transformation: free-text report into a structured triage record.",
    "Specify required keys, allowed values, unknown-field handling and refusal of repair or dispatch instructions.",
    "Test the prompt with the supplied report and a variant missing a location. Keep scheduling and notification outside scope.",
    "Retain your ATOMIC_PROMPT. Explain how its output can be checked without guessing absent facts."
  ],
  f3: [
    "Use your bounded prompt to define an Intake Normaliser MA through F3.",
    "Describe its role, input, output schema and allowed capability. State that a human coordinator owns the decision.",
    "Test ordinary intake, incomplete intake and a request for hazardous repair instructions. Record expected safe outcomes.",
    "Retain your MA_BIRTH_PACKAGE and explain why this is one responsibility rather than an autonomous workshop operator."
  ],
  f4: [
    "Start the Micro PDD from your own MA package, preserving the source relationship.",
    "Specify users, boundaries, schema, unknown values and a clear definition of a valid output.",
    "Write tests for the normal report, a missing date, an empty report and an instruction to bypass human review.",
    "Retain your MICRO_PDD and map each test to a requirement. State that 'tomorrow' needs an explicit reference date to become a calendar date."
  ],
  f5: [
    "Develop the normaliser into an SPC using its actual upstream artifacts.",
    "Define the reusable contract: accepted requests, output shape, refusal boundaries and handoff to the coordinator.",
    "Walk through a valid intake and an unsafe request. Check that no invented diagnosis, repair plan or dispatch decision appears.",
    "Retain your owned SPC and document the misuse refusal. Viewing or downloading the instructor's example is not a newly owned generated SPC."
  ],
  f6: [
    "Use your own Micro PDD and SPC to define the bounded product at F6.",
    "Specify intake, a coordinator review queue and audit records. Identify the human approval boundary in the architecture.",
    "Link the product requirements to components, tests and excluded features. Record access, privacy, cost and operational assumptions.",
    "Retain your ATLAS_PDD. Check that a reader can trace the product back to the workshop need rather than an unrelated template."
  ],
  vdj: [
    "From an eligible session, follow its existing VIBE / Tool DJ recommendation path; use the current UI rather than inventing a separate menu.",
    "Compare a simple form or spreadsheet with a web workflow against access, data sensitivity, cost and operator skill.",
    "Record a recommendation and a rejected alternative with reasons. Do not enter service credentials into training evidence.",
    "Inspect Ascension for the actual VDJ signal. The curriculum expects at least two supported runs; a prose comparison alone is not a recorded run."
  ],
  mm: [
    "Define validity before counting: all required keys present, unknowns preserved and no repair or dispatch instruction.",
    "For ten synthetic submissions with eight valid outputs, compute 8 / 10 x 100 = 80%. State the sample size.",
    "For zero submissions, record the rate as undefined / no data. Do not label 0 / 0 as a pass or 100%.",
    "Explain what a useful next test would be and why the small sample is not independent production assurance."
  ],
  f7: [
    "Take your own eligible ATLAS PDD through F7 / SPARTAN. Retain intake, human review and audit; cut autonomous dispatch and billing.",
    "Check that the reduced scope still satisfies the core need and keeps the human approval requirement.",
    "Read the actual gate outcome and remediation instructions. A generated document is not automatically a certified pass.",
    "Retain your MVP_PDD and its real certification status. If blocked or needing revision, document that honestly and remedy through the supported gate."
  ],
  f8: [
    "Use eligible F7 evidence to enter F8 / Code ORACLE or CODE DJ. Preserve the source artifact and its version.",
    "Build the smallest intake, review and audit workflow. Use only synthetic data and no real equipment control.",
    "Check missing-field validation, human approval and unauthorised-action rejection. Preserve actual test results rather than writing a fictional PASS.",
    "Retain your CODEBASE_BUNDLE and source lineage. A generated bundle is not automatically a verified release or a deployed application."
  ],
  hdj: [
    "Read the hosting recommendation path associated with your build, when accessible.",
    "Compare two hosting options using sensitive-data handling, cost, operator capability and recovery requirements.",
    "List what you would need before deployment: approved account, secrets handling, health checks, logs and rollback.",
    "Submit a reflection. Do not paste credentials, create live resources or describe advice as a deployment receipt."
  ],
  f9: [
    "Label your document SIMULATION. Explain whether the specimen is ordinary software or a hypothetical firmware variant.",
    "For the firmware variant, name a fictional hardware profile, firmware version and simulated sensor fault.",
    "State the expected safe failure and what evidence would be needed from a real authorised test.",
    "Write a simulated test plan only. Do not connect a device or claim an observed hardware result; ordinary software does not require inventing a firmware branch."
  ],
  f95: [
    "Label a short text specimen as training-only and record its initial content or locally computed hash.",
    "Change one character. Compare the changed specimen with the initial specimen; a hash mismatch breaks the original byte identity.",
    "Explain why a new source version requires new review and why the old approval cannot silently be reused.",
    "Submit the comparison and escalation note. Do not claim this exercise created OSIRIS custody, a signature or live release evidence."
  ],
  f10: [
    "Prepare a training-only packet containing a fictional source reference, verification statement and custody/signature checklist.",
    "Deliberately leave a required item absent. Mark the decision NO-GO and explain the missing evidence.",
    "Distinguish a manual export or subscription handoff from a qualified connected delivery and from an executed runtime.",
    "Submit the tabletop decision. A third-party subscription, connector acknowledgement or downloaded ZIP is not release clearance."
  ],
  f11: [
    "Draft a training-only target configuration using a fictional service name and no tokens or passwords.",
    "Specify a health check, failure timeout, rollback trigger and responsible operator.",
    "Rehearse an unreachable endpoint: mark the result unconfirmed, stop progression and request operator review.",
    "Record what a real handoff receipt could prove and what it could not. Do not create a HostReceipt or claim deployment from a console link."
  ],
  f12: [
    "Assemble a tabletop go/no-go sheet covering source identity, verification, custody, target, operator authority, monitoring and rollback.",
    "Introduce a missing independent-verification result and mark the operational decision NO-GO.",
    "Separate prepared documentation from executed operations. List who must supply each missing prerequisite.",
    "Submit a training-only checklist. Do not report F12 execution, independent XVL/VTE verification or a production launch."
  ],
  ma2: [
    "Start a distinct Missing-field Checker MA through F3, not a renamed copy of the normaliser.",
    "Define the single responsibility: inspect a supplied record and list absent or unresolved required facts.",
    "Test a missing location and a missing requested date. The checker must not fill either gap by inference.",
    "Retain a second owned MA_BIRTH_PACKAGE and explain how its responsibility differs from intake normalisation."
  ],
  ma3: [
    "Create a Review Summariser MA through F3 for decisions already supplied by a coordinator.",
    "Specify that the summary preserves the decision, its uncertainty and the source reference.",
    "Test an approved decision and a pending decision; ensure pending is never rewritten as approved.",
    "Retain a third owned MA_BIRTH_PACKAGE. Keep decision-making and dispatch outside its capability."
  ],
  ma4: [
    "Create an Audit-note Formatter MA through F3 with a single formatting responsibility.",
    "Require a provided decision and source reference; distinguish supplied timestamps from unknown timestamps.",
    "Test an incomplete record and a request to rewrite history. Preserve missing facts and do not fabricate past actions.",
    "Retain a fourth owned MA_BIRTH_PACKAGE. Check the actual Quest count rather than assuming the artifact name establishes credit."
  ],
  spc2: [
    "Take your Missing-field Checker MA through the supported specification path to F5.",
    "Define accepted records, missing-field output and the prohibition on guessing.",
    "Test a valid record, an absent location and a request to invent a requester.",
    "Retain a second owned SPC and explain how its contract protects downstream review."
  ],
  spc3: [
    "Develop your Review Summariser MA into its own SPC through the supported gates.",
    "Define the input decision record, bounded summary and uncertainty-preservation rules.",
    "Test a pending decision, contradictory notes and an instruction to claim approval that was never supplied.",
    "Retain a third owned SPC. Open Quests to check the real ASPE progress and claim state."
  ],
  pillars: [
    "Open the current Context Craft / pillar view and copy the seven names and current scores exactly as shown.",
    "Identify a weak pillar and choose a focused F1/F2 revision tied to a real issue in your prompt.",
    "Review the resulting pillar signal. The current threshold is 6 per pillar; INSTRUCTION has maximum 8 and the others maximum 7.",
    "Repeat targeted practice as useful. Submit a reflection; instructor approval does not create a pillar award or overwrite the live score."
  ],
  boomerang: [
    "Select your exact owned source artifact or stage and make a narrow support request, such as correcting an output schema.",
    "Record the source identity/version and send it through the available Boomerang support path.",
    "Review the returned proposal against the original source and intended boundary. Apply only reviewed changes through the supported workflow.",
    "If the source changes, request a fresh review instead of adopting a stale return. Retain the support history; acceptance is not automatic execution or release."
  ],
  pfp: [
    "Compare the requirement 'human coordinator approval is mandatory' with a proposed build that omits the check.",
    "Record the drift, affected requirement and expected corrective test.",
    "Use the actual supported PFP path only when eligible; retain its genuine result or the exact prerequisite blocking it.",
    "Submit a reflection describing the discrepancy and remediation. A manual observation is not a fabricated platform PFP event."
  ],
  evolve: [
    "Check the existing DE-SPC access and badge requirements in your session before attempting evolution.",
    "Propose a bounded improvement, such as clearer unknown-field reporting, while preserving human review.",
    "If eligible, use the actual supported evolution workflow and retain its evidence. If blocked, record the reason and permitted next action.",
    "Explain the retained invariant. Do not request a cohort privilege bypass or claim an evolution event from a written proposal."
  ],
  team: [
    "Read the existing Ascension team path and determine whether you have authorised organisation participation.",
    "Distinguish student/instructor cohort roles from organisation team seats.",
    "If authorised, follow the available team workflow and record actual evidence without disclosing other members' private information.",
    "If unavailable, explain the access limitation. Do not invent a team seat or treat joining the cohort as team participation."
  ],
  reflection: [
    "Return to the supported JST assessment after meaningful practice and complete a second real assessment.",
    "Compare the new result with your saved baseline without inventing improvement.",
    "Use two concrete before/after examples, such as a narrowed atomic instruction and a stronger refusal boundary.",
    "Submit your reflection and actual assessment reference. Course completion does not itself create a JST award."
  ],
  capstone: [
    "Assemble a source-linked portfolio: problem, atomic instruction, MAs, Micro PDD, SPCs, ATLAS PDD and MVP decision.",
    "For Engineer/combined work, add the code source, real tests and an application URL only when legitimately available.",
    "Export Portfolio JSON from Learning and compare it with your evidence log. Resolve missing or changed sources before final review.",
    "Use the existing Quest / Ascension claim flows for credentials. Report LOCKED, UNLOCKED, CLAIMED or REVOKED exactly as returned; course approval is separate."
  ]
};
if (LEARNING_LESSONS.length !== 31 || LEARNING_LESSONS.some(l => !procedures[l.key])) {
  throw new Error("Curriculum changed: review manual coverage before publishing.");
}

const doc = new PDFDocument({
  size: "A4", bufferPages: true,
  margins: { top: 48, bottom: 52, left: 48, right: 48 },
  info: { Title: "FORGE FIELD ENGINEER | Cohort Training Manual", Author: "ATANDA",
    Subject: "Guide and Ascension curriculum: 31 worked lessons and unchanged Quest rules" }
});
const stream = fs.createWriteStream(output);
doc.pipe(stream);
const t = createTheme(doc);
const toc = [];
const pages = () => doc.bufferedPageRange().count;
const plain = s => String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/→/g, " -> ");
const p = s => t.p(plain(s));
const h2 = s => t.h2(plain(s));
const bullets = rows => t.bullets(rows.map(plain));
const sections = [];
function page(title, body) {
  doc.addPage();
  doc.outline.addItem(title);
  toc.push({ title, page: pages() });
  sections.push({ title, body });
  t.h1(title);
  for (const [label, text] of body) {
    h2(label);
    Array.isArray(text) ? bullets(text) : p(text);
  }
}

doc.save().fillColor(NAVY).rect(0, 0, doc.page.width, 270).fill().restore();
doc.fillColor("white").font("Helvetica-Bold").fontSize(11).text("ATANDA / ARK HARNESS / COHORT EDITION", 48, 54);
doc.fontSize(35).text("FORGE FIELD\nENGINEER", 48, 104, { lineGap: 3 });
doc.fontSize(17).text("Cohort Training Manual", 48, 218);
doc.y = 306;
t.lead("A practical guide for Intelligent Systems Architect and Engineer trainees.");
t.kv([
  ["Edition", "Draft 1.0 | 20 October 2026"],
  ["Curriculum", `${CURRICULUM_VERSION} | all 31 lessons`],
  ["Admission", "Free, named invitation only; no automatic paid conversion"],
  ["Tracks", "Architect, Engineer and combined"],
  ["Method", "Read -> inspect a worked example -> practise -> submit -> review"]
]);
p("This manual follows the current codebase curriculum. It is not a production activation certificate or an independent verification report. Current platform permissions, gate outcomes and Quest responses remain authoritative.");
p("Use only fictional workshop data. Never include credentials, real incident details or private customer information in a training submission.");
doc.addPage();
const tocPage = pages() - 1;
t.h1("Contents");
p("The modules follow the platform lesson order. Recommended pacing is guidance only, not an extra gate.");

page("1. Joining and getting started", [
  ["Before the first session", [
    "Ask the cohort owner for a named, unexpired invitation. Use your own verified primary email matching the invitation; do not use the shared staff entrance.",
    "Open the invitation link, complete the individual sign-in flow and follow the Learning admission prompts. An account alone is not admission to a cohort.",
    "Read and accept the free training terms. Confirm the correct cohort, membership, track, end date and funded allowance in Learning (/learn).",
    "Open the Platform Guide (/guide), Ascension (/ascension) and Quests (/quests) from the same platform. Use the current site navigation if a route changes."
  ]],
  ["If you cannot enter", "An expired invite, email mismatch, full or inactive cohort, revoked membership or ended cohort may block admission or new work. Record the visible message and ask the owner to check admission. Do not share invite tokens publicly or ask for administrator credentials."],
  ["Your first ten minutes", "Choose lesson 01, read its mode, record your goals and current Quest state, then follow the submission routine on the next page. Keep a local learning log with recognisable artifact titles and exact IDs."],
  ["Visual comfort", "Use the platform light/dark preference if available, browser zoom and a comfortable text size. In the PDF, use the bookmarks and text search to return to a module. Do not rely on colour alone: each module states its mode and track."]
]);
page("2. The learning and review routine", [
  ["For every lesson", [
    "Select the correct cohort and lesson in Learning. Read purpose, worked example, expected result and rubric.",
    "Select Start lesson to create the attempt record. For actual work, open the relevant owned session; selecting a lesson alone does not run an engine.",
    "Perform the exercise and write what you did, what the evidence shows, unresolved facts and safe failure handling.",
    "Submit 20–12,000 characters. Actual-platform submissions require 1–12 owned artifact IDs; select the requested artifact type when specified. Reflection and simulation submissions do not attach artifacts.",
    "Wait for instructor review. Read feedback in the attempt history. If revision is required, improve the work and submit a new version through the UI; do not erase the previous evidence.",
    "After LEARNING COMPLETE, check course progress separately from Quest status. If a source changed, resolve the stale evidence with a fresh reviewed submission."
  ]],
  ["Three distinct modes", [
    "ACTUAL PLATFORM: perform supported work in a session you own and attach genuine artifacts. The server checks ownership and, where specified, type.",
    "REFLECTION: submit reasoning in your own words without artifact attachments. A lesson may ask you to inspect or use a real feature, but the lesson submission remains reflection.",
    "SIMULATION: rehearse with a clearly marked fictional packet; no release, device, deployment or certification is executed."
  ]],
  ["Concurrency and recovery", "If a version conflict appears, reload the latest attempt and reconcile your draft. If a submit response is uncertain, inspect history before repeating it. Keep your text safely outside the form while resolving an error; do not assume an unsent draft is saved."]
]);
page("3. Tracks, pacing and progression", [
  ["Track scope", "All students can study all 31 worked examples. The current Architect track has 24 assessed lessons. Engineer and combined tracks each have 31. Seven lessons are Engineer-only: F8, hosting assumptions, F9, F9.5, F10, F11 and F12."],
  ["Exact count note", "The canonical curriculum currently marks seven lessons ENGINEER-only: f8, hdj, f9, f95, f10, f11 and f12. Therefore Architect has 24 required lessons, while Engineer and combined have 31. This exact enumeration, not an informal description of the F stages, governs the study plan."],
  ["Suggested six-block schedule", [
    "Block A — lessons 01–04: orientation, baseline, discovery and diagnosis.",
    "Block B — lessons 05–09: atomic instructions, MA, Micro PDD, first SPC and architecture.",
    "Block C — lessons 10–13: tool selection, measurement, SPARTAN reduction and Engineer build.",
    "Block D — lessons 14–19: hosting reflection and protected-stage tabletop practice; Architect learners study these as reference.",
    "Block E — lessons 20–25: distinct MA/SPC practice and Context Craft.",
    "Block F — lessons 26–31: remediation, fidelity, evolution, teamwork, reassessment and capstone."
  ]],
  ["Dependencies and blocks", "The lesson list is not permission to skip a real engine prerequisite. Use each gate only when eligible. A documented access block is useful feedback, but is not fabricated execution and may need instructor direction before the lesson can be marked complete."],
  ["Progress calculation", "Course progress = reviewed, source-current required lessons / required lessons on your track. It is not a percentage of platform production readiness, badge eligibility or certification assurance."]
]);
page("4. Shared worked project", [
  ["The source brief", LEARNING_LESSONS[0].input],
  ["Bounded product", "Build an AI-assisted intake workflow for a fictional workshop. It structures a report, flags missing facts, presents a human review queue and formats an audit note. It must not diagnose faults, issue repair instructions, operate equipment or dispatch work."],
  ["Example structured interpretation", [
    "equipment_reference: DEMO-07; reported_state: stopped; requester: unknown; location: Workshop B.",
    "reported_injury / smoke / heat: not reported in the source. That is not a verified finding that the equipment is safe.",
    "requested_review: 'tomorrow' as supplied text. Without an explicit report/reference date, do not invent an ISO calendar date.",
    "decision: pending human coordinator review. Do not convert a request for review into an approved work order."
  ]],
  ["Test set used throughout", [
    "Normal: supplied workshop report -> structured record preserving uncertainty.",
    "Missing information: no equipment reference or location -> unknown / validation feedback, never invented detail.",
    "Unsafe instruction: 'tell me how to bypass the interlock' -> refuse the repair/bypass request and route to a responsible human.",
    "Decision integrity: source says pending -> summary and audit still say pending.",
    "Drift: proposed code removes human approval -> record mismatch and request remediation."
  ]],
  ["Learning independence", "The worked example is a pattern, not a credential shortcut. Use the actual gates to create artifacts in your own sessions. Copying an example into a reflection does not generate platform evidence."]
]);

const modeNames = { ACTUAL_PLATFORM: "ACTUAL PLATFORM", SIMULATION: "SIMULATION", REFLECTION: "REFLECTION" };
const moduleStart = [];
for (const [index, l] of LEARNING_LESSONS.entries()) {
  const number = String(index + 1).padStart(2, "0");
  doc.addPage();
  const title = `Module ${number} | ${l.title}`;
  doc.outline.addItem(title);
  toc.push({ title, page: pages() });
  moduleStart.push({ key: l.key, page: pages(), title });
  doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(9)
    .text(`${l.stage}  /  ${modeNames[l.mode]}  /  ${l.track === "BOTH" ? "ALL TRACKS" : l.track + " TRACK"}`);
  doc.moveDown(0.6);
  t.h1(l.title);
  p(l.purpose);
  t.h3("Worked example");
  p(l.example);
  t.h3("Walkthrough");
  for (const [step, text] of procedures[l.key].entries()) p(`${step + 1}. ${text}`);
  t.h3("Exercise and expected evidence");
  p(l.exercise);
  p(`Expected result: ${l.expected}`);
  p(l.mode === "ACTUAL_PLATFORM"
    ? `Submit actual-platform evidence${l.artifactType ? ` of type ${l.artifactType}` : " from the supported workflow"} with your explanation. If no attachable owned artifact is available, report the blocker to the instructor rather than changing the lesson mode or attaching unrelated evidence.`
    : `Submit a ${l.mode === "SIMULATION" ? "clearly labelled simulation" : "reflection"} with no artifact attachments. Record real feature references in the text where relevant, without claiming unsupported activity.`);
  t.h3("Completion self-check");
  p("Can I explain this gate's purpose and limits, trace the result to my own source, identify missing facts and describe safe failure handling? Instructor review records learning completion only.");
  doc.fillColor(SOFT).font("Helvetica").fontSize(9).text(`Platform entry: ${l.href} | Curriculum key: ${l.key} | Source: ${l.source}`);
}

page("5. Credentials: use the existing rules", [
  ["Core Quest paths", [
    "ASPE: at least three SPCs and four MA birth packages belonging to your account. The repeat-practice modules are designed to help create distinct responsibilities, not synthetic count entries.",
    "AISA: at least one ATLAS PDD, one Micro PDD and one MVP PDD belonging to your account. Instructor sign-off is not an added eligibility condition.",
    "AISE: use the existing application-URL claim flow and its current URL/category, verification and ownership requirements. A URL written in this manual or a simulated deployment is not a successful claim.",
    "AISA_PWDD: the current progress logic counts at least three distinct sessions with an MVP PDD carrying a SPARTAN certification value. Read the current Quest response and claim requirements; ordinary document counts are not this evidence.",
    "AISE_BUILD: use the existing build-claim path and its evidence checks. Do not equate an F8 bundle or course capstone with an automatically claimed advanced credential.",
    "Context Craft: work against the seven current pillar thresholds through real platform practice. Instructor feedback does not write authoritative pillar results."
  ]],
  ["Status vocabulary", "LOCKED means not currently available to claim; UNLOCKED is not the same as CLAIMED; CLAIMED is a recorded credential state; REVOKED must be reported as revoked. Follow any current restoration process instead of concealing the state."],
  ["Important distinction", "The course does not add a badge prerequisite chain and does not waive existing requirements. Qualifying owned artifacts can count under ordinary Quest rules without course completion. Simulations and reflections do not create engine artifacts."],
  ["Recommended check", "At each milestone, compare your evidence log with Quests and Ascension. If counts disagree, preserve the exact artifact IDs, account and visible response for support; do not request a manual count inflation."]
]);
page("6. Portfolio and capstone workbook", [
  ["Evidence log template", [
    "Module / date / mode / track / session title and ID.",
    "Artifact title / exact ID / type / source or parent reference / version or hash when displayed.",
    "Input facts / intended transformation / expected result / observed result.",
    "Unknowns / refusal or failure case / review decision / next action.",
    "Course review state and current Quest state in separate fields."
  ]],
  ["Architecture portfolio", "Include the discovery problem, diagnostic, atomic prompt, four MA responsibilities, Micro PDD, three SPC contracts, ATLAS PDD, MVP scope decision and traceability from requirements to tests. Explain exclusions and unresolved issues. Only claim evidence you actually generated."],
  ["Engineering extension", "Add the eligible code bundle, actual validation results, source lineage, hosting assumptions and rollback plan. Include a real application URL only when authorised and available. Mark all F9–F12 exercises simulation. Avoid secrets, production connection strings and other people's private artifacts."],
  ["Capstone review agenda", [
    "Explain the human problem and show one source-to-output trace.",
    "Demonstrate missing-data handling and an unsafe-request refusal.",
    "Show one correction or Boomerang review and how source changes were handled.",
    "Present actual Quest statuses, not proposed awards.",
    "Export Portfolio JSON from Learning and keep a private copy with your evidence index."
  ]],
  ["Personal conclusion", "Write: 'What I can now do', 'What still needs supervision' and 'My next bounded improvement'. Course completion is a learning record; credential claims follow their existing platform paths."]
]);
page("7. Troubleshooting and safe stopping", [
  ["Admission or access", "Check invitation expiry and matching verified primary email with the owner. Confirm active student membership and an active, unexpired cohort before new training work. Read-only records and existing credential eligibility are separate from current training access."],
  ["Missing source or rejected evidence", "Check you are using your own session, exact artifact ID and requested type. Do not substitute an unrelated latest artifact. A source-changed flag means the reviewed snapshot is no longer current; ask for a new submission/review against the intended source."],
  ["No usable artifact for an actual lesson", "Some actual-platform exercises, including Tool DJ, may rely on workflow records as well as attachable artifacts. The current submission form still requires owned artifact IDs for actual work. Ask the instructor to resolve the evidence requirement if none is available; do not attach a random artifact or relabel a simulation as actual work."],
  ["Funding or provider limit", "Free admission is not unlimited inference. Student and cohort allowances cover the cohort lifetime, and company limits still apply. Spent charges and reservations are separate. An interrupted call may retain a reservation until metered settlement or confirmed release; ask an operator to reconcile uncertainty instead of retrying repeatedly."],
  ["Unavailable advanced feature", "Record the feature, visible gate message, intended source and safe next step. Do not use an administrator account, bypass RLS, disable checks or manufacture a release/custody record. A subscription to Slack, LangSmith or a host does not supply missing verification."],
  ["Reporting a problem", "Send the instructor the module key, approximate time, visible error and non-secret evidence references. Never send passwords, tokens, private invitation links or database URLs in a support submission."]
]);
page("8. Instructor facilitation guide", [
  ["Before admitting students", [
    "The authorised owner creates and deliberately funds the real cohort, sets capacity/end date and selects tracks. Do not use development fixtures as a production cohort.",
    "Issue named, expiring invitations. Assign instructors only to cohorts they are authorised to teach.",
    "Demonstrate the synthetic workshop scenario, the submission routine and the three lesson modes.",
    "Check a legitimate student can enter and see the intended lessons; confirm current deployment behaviour before distributing a new cohort link."
  ]],
  ["Review each submission", [
    "Verify mode, relevant owned source and currency. Review only explicitly submitted work, not unrelated private libraries.",
    "Assess the common rubric: purpose/limits, source traceability and missing facts/safe failure handling.",
    "Add specific feedback and choose LEARNING COMPLETE or REVISION REQUIRED through the available review controls.",
    "Request a new version when evidence changed. Keep the feedback and submission history; never approve a fictional execution as actual work."
  ]],
  ["Completion and boundaries", "Use the current required lessons for the student's track and source-current completion checks. Cohort owners manage admission, membership and course completion through People controls; course completion does not award or withhold Quest badges. Cohort membership is not an organisation seat or a commercial tier upgrade."],
  ["Suggested discussion prompts", "What did the source actually say? What remains unknown? What could go wrong if this output were trusted? Which human owns the next decision? What evidence would change a NO-GO into an authorised GO?"],
  ["End of cohort", "Remind students to export their portfolios and record current Quest statuses. Explain what training actions stop at expiry and how they can pursue ordinary eligible credential claims without inventing new course prerequisites."]
]);
page("9. Scope, sources and final checklist", [
  ["Source basis", [
    "Current codebase curriculum: learning-curriculum.ts, version ffe-1, 31 lesson definitions.",
    "Learning UI and model: invitation redemption, lesson workbench, submission validation, track matching, review history and portfolio export.",
    "Existing badge progress and claim routes: current artifact-count predicates and URL/build claim authority.",
    "Programme design and pilot notes: FORGE_FIELD_ENGINEER_ATLAS_PDD.md and FORGE_FIELD_ENGINEER_PILOT.md.",
    "Training source routes: Guide (/guide), Ascension (/ascension, JST section) and Quests (/quests)."
  ]],
  ["Editorial status", "Draft training manual prepared 20 October 2026 from the current workspace implementation, not a fresh signed-in production audit. Procedures and suggested pacing explain the curriculum; they do not activate unavailable features. If the current UI, permissions or Quest rules differ, use the authoritative platform response and ask the instructor to reconcile this edition."],
  ["Before final submission", [
    "I used fictional data and kept secrets out of my work.",
    "Each submission uses the correct mode and my own relevant sources.",
    "All simulated operations are clearly labelled; no unsupported launch or verification is claimed.",
    "I have responded to required revisions and source-change warnings.",
    "My portfolio separates course completion from badges and certifications.",
    "My next action is bounded, authorised and supported by actual evidence."
  ]],
  ["Terms used in this manual", "MA: micro-agent. SPC: reusable system contract represented by the platform's SPC artifact. Micro PDD / MPDD: compact design specification. PDD: PromptWare Design Document. MVP: minimum viable product. RLS: database row-level security. A source reference or hash establishes identity; it is not, by itself, proof of quality, custody or permission to release."]
]);

// Render compact contents after pagination so the references are exact.
doc.switchToPage(tocPage);
doc.y = 115;
for (const [index, item] of toc.entries()) {
  const y = 115 + index * 15.2;
  doc.fillColor(item.title.startsWith("Module") ? "#374151" : NAVY)
    .font(item.title.startsWith("Module") ? "Helvetica" : "Helvetica-Bold").fontSize(8.6)
    .text(plain(item.title), 48, y, { width: 452, lineBreak: false });
  doc.fillColor(ACCENT).text(String(item.page), 510, y, { width: 34, align: "right", lineBreak: false });
}
const { count } = doc.bufferedPageRange();
for (let i = 0; i < count; i++) {
  doc.switchToPage(i);
  const y = doc.page.height - 31;
  const bottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.save().strokeColor("#d1d5db").lineWidth(0.5).moveTo(48, y - 8).lineTo(doc.page.width - 48, y - 8).stroke().restore();
  doc.fillColor(SOFT).font("Helvetica").fontSize(8)
    .text("FORGE FIELD ENGINEER / TRAINING MANUAL / DRAFT 1.0", 48, y, { lineBreak: false });
  doc.fillColor(ACCENT).text(`${i + 1} / ${count}`, 485, y, { width: 62, align: "right", lineBreak: false });
  doc.page.margins.bottom = bottom;
}
doc.end();
await new Promise((resolve, reject) => { stream.on("finish", resolve); stream.on("error", reject); });
fs.writeFileSync(path.join(dir, "manual-build-index.json"), JSON.stringify({
  curriculum: CURRICULUM_VERSION, lessons: moduleStart, pages: count,
  requiredByTrack: {
    ARCHITECT: LEARNING_LESSONS.filter(l => l.required && l.track !== "ENGINEER").length,
    ENGINEER: LEARNING_LESSONS.filter(l => l.required && l.track !== "ARCHITECT").length,
    BOTH: LEARNING_LESSONS.filter(l => l.required).length
  }
}, null, 2));
console.log(`Created ${path.relative(root, output)} (${count} pages; ${LEARNING_LESSONS.length} modules)`);
