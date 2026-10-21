// Read-only documentary build. Public observations are collected separately.
// No database access, application mutations, migrations or provider operations.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { createTheme, NAVY, ACCENT, SOFT } from "./lib/atlas-pdf-theme.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dir = path.join(root, "generated-artifacts/atlas-360-scan-2026-10-20");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const evidence = JSON.parse(fs.readFileSync(path.join(dir, "public-evidence.json"), "utf8"));
if (evidence.schemaVersion !== "atlas-360-evidence-v3" || !evidence.observations.length) {
  throw new Error("A freshly collected, dated public evidence snapshot is required.");
}
const ledger = JSON.parse(read("docs/upgrade-program/progress.json"));
const app = read("artifacts/command-centre/src/App.tsx");
const routes = [...new Set([...app.matchAll(/<Route path="([^"]+)"/g)].map(m => m[1]))];
const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const sha = data => crypto.createHash("sha256").update(data).digest("hex");
const sources = [
  "artifacts/command-centre/src/App.tsx",
  "artifacts/command-centre/src/lib/learning-entry.ts",
  "artifacts/command-centre/src/pages/sessions.tsx",
  "artifacts/command-centre/src/pages/sessions.test.tsx",
  "artifacts/command-centre/src/pages/f10.tsx",
  "artifacts/command-centre/src/components/f10/native-providers.tsx",
  "artifacts/command-centre/src/components/workspaces/F11SubscriptionHandoff.tsx",
  "artifacts/api-server/src/routes/f10.ts",
  "artifacts/api-server/src/lib/f10-export.ts",
  "artifacts/api-server/src/lib/f10-provider.ts",
  "artifacts/api-server/src/lib/launch-readiness.ts",
  "artifacts/api-server/src/lib/artifact-operations/database-protection.ts",
  "artifacts/api-server/src/lib/artifact-operations/context.ts",
  "artifacts/api-server/src/lib/learning-curriculum.ts",
  "artifacts/api-server/src/lib/learning-service.ts",
  "artifacts/api-server/src/lib/badges.ts",
  "docs/f10-f11-subscription-handoffs.md",
  "docs/FORGE_FIELD_ENGINEER_PILOT.md",
  "docs/upgrade-program/fix-process-checkpoint.md",
  "docs/upgrade-program/dependency-advisories.md",
  "docs/upgrade-program/progress.json",
  "replit/AGENT_RULES.md",
  "scripts/src/build-scan-refresh-2026-10-20.mjs",
  "scripts/src/lib/atlas-pdf-theme.mjs"
].map(file => ({ file, sha256: sha(read(file)) }));
const stateCounts = (items, field) => items.reduce((a, x) => {
  const state = x[field] ?? "UNSPECIFIED";
  a[state] = (a[state] ?? 0) + 1; return a;
}, {});
const observation = route => evidence.observations.find(x => x.route === route);
const ready = observation("/api/readyz");
const base = evidence.deployment.primaryUrl;
const md = [];
const heading = (level, s) => md.push(`${"#".repeat(level)} ${s}`, "");
const para = s => md.push(s, "");
const bullets = rows => { rows.forEach(x => md.push(`- ${x}`)); md.push(""); };
const table = (headers, rows) => {
  md.push(`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`);
  rows.forEach(row => md.push(`| ${row.map(x => String(x).replace(/\|/g, "/").replace(/\n/g, " ")).join(" | ")} |`));
  md.push("");
};

heading(1, "Document control and reading guide");
para("ATANDA Command Centre — ATLAS 360 SCAN Living PDD. Edition: 20 October 2026 (America/Chicago). Public observations were collected at 04:33 UTC on 21 October, equivalent to 23:33 CDT on 20 October. Rendering time is not a new observation time.");
para(`Published target: ${base}. Deployment metadata confirms a public autoscale deployment with a successful build. Workspace HEAD at drafting: ${head}. This freezes the reviewed workspace, not the identity of the deployed JavaScript bundle.`);
para("Supersedes the 17 October report for the current observations and changes described here. Historical production SQL findings are retained as dated context, not silently promoted into a fresh database audit. The report is an analyst current-state PDD, not independent FORGE/HIVE/JCSE certification.");
bullets([
  "Navigation: eight SCAN stages; four ATLAS parts; site-map, status and evidence addenda. PDF bookmarks identify major sections.",
  "Fresh evidence: deployment metadata plus nine anonymous, read-only HTTP probes. No customer data, credentials or connection strings are reproduced.",
  "Recorded evidence: prior scoped tests, builds and preview checks explicitly attributed to their delivery checkpoints; not rerun for this document.",
  "No runtime, database, security role, secret, provider configuration or production schema is changed by this report."
]);

heading(1, "SCAN STAGE 1 — Freeze-stage Evidence Manifest");
heading(2, "1.1 Evidence classes");
table(["Label", "Meaning"], [
  ["LIVE—OBSERVED", "A specific public response was observed in this refresh; scope is limited to that response."],
  ["IMPLEMENTED—SOURCE", "Current source contains the capability; no fresh authenticated acceptance is implied."],
  ["LOCAL—VERIFIED", "Recorded scoped tests or preview evidence support the stated behaviour, not production execution."],
  ["BLOCKED / DEFERRED", "A required qualification, dependency, governance or deliberate launch gate remains unsatisfied."],
  ["UNVERIFIED", "Evidence is insufficient to assert live activation, including stale ledger entries."],
]);
heading(2, "1.2 Fresh public observations");
table(["Endpoint", "Result", "Interpretation"], evidence.observations.map(o => [
  o.route, o.status ?? "PROBE ERROR",
  o.route === "/api/healthz" ? "Process responds; not full feature assurance." :
  o.route === "/api/health" ? "Database probe and engine configuration report ok; no model execution." :
  ["/api/readyz", "/api/launch-readiness"].includes(o.route) ? `Database ${o.body?.database}; AI ${o.body?.ai}; buildReady=${o.body?.buildReady}. Deferred gates remain explicit.` :
  o.route === "/api/sphinx/catalog" ? `publicOpen=${o.body?.publicOpen}; ${o.body?.items?.length ?? "unknown"} public items. Marketplace closed.` :
  o.route === "/api/auth/session" ? "Anonymous session response; authenticated=false." :
  ["/api/learn", "/api/boomerang/cases"].includes(o.route) ? "Anonymous access refused; not proof of tenant isolation or successful signed-in use." :
  "HTML shell returned. No registration, invitation redemption or visual form test was performed."
]));
heading(2, "1.3 Scope of the freeze");
para(`The hashed source manifest covers ${sources.length} source/document files. The current router declares ${routes.length} distinct path patterns. The progress ledger contains ${ledger.invariants.length} invariants and ${ledger.prompts.length} upgrade prompt records; those are a separate register from this report's 45 atomic assessment units.`);
para("No production client asset hash was recollected or compared to workspace output. A successful deployment does not prove that every local change is published. Signed-in and tenant-specific capabilities retain unverified production status until directly exercised by an authorised user.");

heading(1, "SCAN STAGE 2 — Baseline and Scope");
para("ATANDA Command Centre supports source-led PromptWare production through the ARK Harness, reusable artifacts, gated engineering/release handoffs, advisory SPC Player runs, private preparation, learning and credential evidence. Exemplar is the reusable inventory underlying a future explicitly opened Sphinx catalog; it is not a second checkout.");
heading(2, "2.1 Architecture");
bullets([
  "Client: React/Vite with Wouter routing, accessible shared components and generated OpenAPI query/mutation clients.",
  "API: Express services with identity, ownership, entitlement, cost and request validation gates.",
  "Persistence: PostgreSQL schema/migration history, private object storage and source/byte integrity records.",
  "Inference: configured supported AI providers; budgets distinguish completed charges from temporary reservations.",
  "Operations: private preparation stays separate from protected approval, independent verification, custody and provider rollout.",
  "Identity: individual verified student accounts are separate from the staff entrance; education is not administrator access or commercial tier elevation."
]);
heading(2, "2.2 Product boundaries");
para("F0–F9 and side-step interfaces are present under account-specific permissions. F10 is the release/export/connector boundary, F11 the hosting handoff and F12 governed operation. ATLAS 360 PLAN/SCAN are F6/F7 document views, not the retired numbered F10 concept.");
para("Azure Key Vault remains a Class B deferred upgrade. Existing secret controls continue; neither this draft nor baseline readiness asserts Azure migration or compliance.");

heading(1, "SCAN STAGE 3 — Evidence Mapping");
heading(2, "3.1 Gate-level capability register");
table(["Gate", "Capability", "Current boundary"], [
  ["F0", "Discovery, service intake and advisory engagements", "Source implementation; signed-in business journey unverified in this scan."],
  ["F1", "Prompt diagnostics / Monster Hunter", "Actual model result not sampled in production."],
  ["F2", "Atomic instruction / Atom Smith", "Current account, cost and engine gates apply."],
  ["F3", "MA birth package", "Owned artifact generation; no synthetic count credit."],
  ["F4", "Micro PDD", "Specification/source for downstream and SC ONE preparation."],
  ["F5", "SPC synthesis", "Reusable contract/source for SC TWO; Player remains advisory."],
  ["F6", "ATLAS PDD; VIBE and 360 PLAN/SCAN side-steps", "Implemented document views; not release permission."],
  ["F7", "SPARTAN MVP PDD", "Retain actual gate status; doctrinal labels are not independent certification."],
  ["F8", "CODE DJ bundle and HOST DJ advisory", "Source lineage retained; operator-submitted CI/IDE evidence is not provider-validated."],
  ["F9 / F9.5", "Firmware evidence and custody", "Hardware/profile-dependent; ordinary Software routing differs."],
  ["F10", "Source-bound export and broker delivery contracts", "Manual handoff available in source; new connected adapters still require qualification."],
  ["F11", "Verified-bundle manual hosting handoff", "Download/console access does not complete protected host gates."],
  ["F12", "Staged rollout, health hold, rollback and promotion", "Readiness still explicitly reports incomplete full operation."]
]);
heading(2, "3.2 IMPRIMA and SHORT SPRINTS");
para("Private preparation: authenticated, owner-scoped source-preserving DRAFT documents/packages, saved metadata and private downloads. IMPRIMA offers HTML/DOCX/PDF draft preparation; SC ONE packages birth/Micro PDD sources, while SC TWO packages SPC/configuration/spec-sheet sources. Exact-byte manifests are not Final approval, source qualification or permission to release.");
para("Protected full operation: governed editorial/review/Final, sprint qualification/rulings, independent receipts, custody and provider rollout require the existing security and verification gates. Public readiness freshly reports these governance gates incomplete. Current source checks the restricted role, FORCE RLS, owner policies, verifier policies, immutable versions and restricted permissions.");
para("The prior 18 October production catalog inspection reported missing/insufficient role, policy, FORCE RLS and trigger controls. Those catalogs were not queried again for this refresh. Do not state that every previous catalog defect still exists—or that it was repaired—without fresh read-only evidence on the actual runtime login.");
heading(2, "3.3 New F10 / F11 subscription handoff");
table(["Target", "Implemented handoff meaning", "Not established by that action"], [
  ["SLACK_NOTIFICATIONS", "Source-bound notification contract", "An autonomous Slack agent or independent release approval."],
  ["SLACK_AGENT", "Registration contract for an existing hosted entry point", "Agent runtime execution or inbound Events security."],
  ["LANGCHAIN_APP", "Import contract for an existing user runtime", "A new execution engine or mandatory paid LangChain plan."],
  ["LANGSMITH_DATASET", "Source-preserving dataset example contract", "An expected answer, evaluation PASS or certification."],
  ["F11 manual host handoff", "Verified exact-source package plus official provider console/signup links", "HostReceipt, H4/H7/H8 completion or F12 activation."]
]);
para("Manual exports do not perform external writes. Connected F10 delivery requires a separately configured and qualified broker, tenant-bound user authorization, exact source/ZIP integrity, idempotency and truthful provider status polling. Slack agent use additionally requires a hosted runtime and verified inbound signatures/replay controls. External subscriptions belong to the user and do not replace platform release evidence.");
para("F11 selects the verified child of the intended original bundle, never an unrelated latest bundle. The generic TypeScript/Node package is not guaranteed compatible with every host. Existing subscription/signup links remain separate from credential storage and deployment.");
heading(2, "3.4 Boomerang, Player and Exemplar");
para("Boomerang covers exact F-stage origins with ownership, snapshot freshness and review. Accepted returns are supporting input, not automatic execution or release. SPC Player is sequential, advisory and plan-only; its JSON/download or consented webhook output is not deployment evidence. Exemplar-to-Sphinx supply remains opt-in and qualification-gated for eligible artifacts, with the public catalog closed in the fresh probe.");
heading(2, "3.5 FORGE FIELD ENGINEER");
para("Free, named invite-only training is implemented with 31 Guide/Ascension lessons, individual verified identity, cohort roles, source-bound submissions, review history, progress and portfolio JSON. Current lesson definitions mark seven Engineer-only lessons: Architect has 24 required lessons; Engineer and combined have 31. All students may study all worked examples. F9–F12 are simulation/tabletop, not live release exercises.");
para("Lifetime cohort/student allowances remain separate from commercial privileges and company caps. Unfinalised reservations remain held until settlement or confirmed release. Instructor review does not award or withhold Quest credentials: ASPE retains 3 owned SPCs + 4 MAs; AISA retains one ATLAS, Micro and MVP PDD; AISE/build claims retain their existing authoritative checks.");

heading(1, "SCAN STAGE 4 — Assurance Assessment");
heading(2, "4.1 What the evidence supports");
bullets([
  "Fresh public health and baseline DB readiness are positive observations, not proof of migration completeness, model availability, protected isolation or end-to-end feature acceptance.",
  "The source-backed limited preparation lane must not be treated as a workaround for governed IMPRIMA/SHORT SPRINTS security or verification failures.",
  "Signed-in archive, Quest, Player, Boomerang, preparation, learning and provider workflows were not newly exercised in production for this report.",
  "No new production DDL, runtime-role inspection, verifier execution, provider write, payment, rollout or rollback was performed.",
  "No independent score, 50/50 certification, measured token reduction or financial saving is asserted."
]);
heading(2, "4.2 Known security and quality limits");
para("The recorded dependency review retains one high braces advisory and one moderate sprintf-js advisory with no compatible patched release established. Boundary tests narrow known reachability, but do not remediate the advisories. This report did not rerun an audit or claim a fresh registry result.");
para("The remaining broader accessibility/responsive audit and authorised signed-in browser pass remain open. A public/mobile screenshot or passing component test does not certify screen-reader behaviour or a protected user journey.");

heading(1, "SCAN STAGE 5 — Delta Since the Prior Edition");
table(["Area", "Change represented in current source", "Evidence limit"], [
  ["F10", "Slack/LangChain/LangSmith families, targets, export contracts and native-provider UI", "External qualified broker adapters remain outstanding; no live delivery claimed."],
  ["F11", "Pinned verified-bundle manual package and provider console/signup route", "No deployment or HostReceipt generated by a download."],
  ["Public verification", "Staff-only request separation; failure classification, retries and URL/history sync", "Local scoped evidence, not new production acceptance."],
  ["Quest", "Section error/retry handling and credential progress", "Signed-in journey and separate evidence-form work remain open."],
  ["Accessibility", "Player/Boomerang/preparation components and public dependency-status panel improved", "Wider site audit unfinished."],
  ["Sessions Archive", "Unavailable vs empty distinction; stale-cache warning; fenced retries; native named links", "10 targeted tests, typecheck and build recorded; screenshot stopped at staff gate."],
  ["Entry routing", "Reactive authenticated learning-entry routing and invitation preservation in source", "Prior republish-required statement is now historical; no fresh deployed-client equivalence check."],
  ["Dependencies", "Typography-related advisory patch previously completed", "Braces and sprintf-js remain unresolved."],
]);
para("Recorded delivery verification: Sessions Archive passed 10 targeted tests plus frontend typecheck/build. F10/F11 delivery recorded 21 collaboration cases, 7 key-rotation/route cases, 31 existing export/provider cases and 11 frontend cases across separately scoped runs. These results are not added into a new combined-suite total, and no suites were rerun to author this PDD.");

heading(1, "SCAN STAGE 6 — Gaps and Constraints");
table(["Gap", "Why still open", "Closure evidence"], [
  ["Governed database operation", "Current readiness says governance incomplete; no fresh runtime-role catalog proof", "Reviewed supported installation and exact non-bypass runtime-context security checks."],
  ["Independent XVL/VTE", "Contract/advisory checks do not prove real independent execution", "Source-bound signed receipts from qualified distinct verifier identities; negative controls."],
  ["Full F12", "No current production rollout/health/rollback evidence", "Authorised staged target, monitoring, health hold and rollback/promotion evidence."],
  ["New connected adapters", "Platform export/protocol support is not an operated broker", "Qualified per-target broker tests, user-owned authorization and durable real-operation evidence."],
  ["Sphinx launch", "publicOpen=false; qualification and launch are deliberate gates", "Eligible owner opt-in, privacy/revocation checks and explicit public opening authorization."],
  ["Signed-in acceptance", "Anonymous capture cannot enter protected journeys", "Authorised student/staff/owner and cross-owner acceptance without bypass."],
  ["Dependency advisories", "Upstream unresolved versions", "Compatible patched release or separately reviewed replacement; audit clean for the affected finding."],
  ["Wide accessibility audit", "Only scoped surfaces checked", "Route/state-specific keyboard, narrow-screen and assistive-technology evidence."],
  ["Azure", "User-approved Class B deferral", "Later approved Key Vault credentials, integration and rotation verification."],
]);
heading(2, "6.1 Permanent safety constraints");
para("Preserve historical db/rls migrations. New security changes require additive numbered files and human review. Do not weaken verification, bypass restricted transaction context, use owner connections in protected request paths, add destructive record endpoints or silently repair production startup. A migration/verification failure stops the chain.");

heading(1, "SCAN STAGE 7 — Release Decision");
para("Decision: retain a limited, evidence-labelled release posture. Current public baseline is healthy; this report does not approve all-feature activation. An authorised publisher may evaluate already verified limited changes through the existing fail-closed migration/security/startup process. No publish or database command is executed by this scan.");
bullets([
  "Before republishing: review migration/schema impact, keep the verified security startup chain and stop on any failed check.",
  "After republishing: record release identity, repeat public probes and perform the authorised changed signed-in journeys.",
  "Do not advertise full independent XVL/VTE, governed IMPRIMA/SHORT SPRINTS, connected new provider execution, F12 or open Sphinx commerce without their own acceptance evidence.",
  "Keep rollback or containment decisions tied to the actual deployment, source and failing evidence; a report PDF is not an activation token."
]);

heading(1, "SCAN STAGE 8 — Living Monitoring and Update Rules");
para("Each later edition must freeze its own source hashes, deployment metadata and observation timestamps. Store source state, local verification and live activity separately. Update each invariant only after a matching authorised live check; generic health endpoints cannot mark every invariant active.");
para(`The present ledger records ${ledger.invariants.length} invariants with liveActivity=UNVERIFIED. Its ${ledger.prompts.length} prompt records include ${stateCounts(ledger.prompts, "localBuild").PARTIAL ?? 0} PARTIAL and ${stateCounts(ledger.prompts, "localBuild").NOT_STARTED ?? 0} NOT_STARTED local statuses; all live prompt observations are UNVERIFIED. These stale register fields are not a credible percentage of delivered platform functionality.`);
para("Do not overwrite the upgrade ledger based only on this documentary scan. Reconciliation needs invariant-specific evidence and an accountable owner. Retain historic observations rather than rewriting their collection time to the current render time.");

heading(1, "PART 1 — Cheat Sheet");
table(["Field", "Current assessment"], [
  ["Problem", "Prevent source, deployment and readiness claims from drifting apart as features and connectors evolve."],
  ["Solution", "An evidence-labelled living PDD with exact routes, explicit gates, atomic assessment units and acceptance sequence."],
  ["Top capabilities", "Gated PromptWare creation; source-linked libraries; private preparation; advisory support; cohort/Quest evidence."],
  ["Latest addition", "Manual subscription-based F10/F11 third-party handoff with qualified connected execution kept separate."],
  ["Live baseline", "Successful public deployment; HTTP 200 health/readiness; database available; AI configured."],
  ["Intentional closure", "Sphinx catalog remains closed with zero public items."],
  ["Highest-priority limitation", "Governed verification/operations and signed-in production acceptance not established."],
  ["Progress", "7 of 10 equal-weight stabilization items complete in development = 70%; not overall platform readiness."],
  ["Economics", "No measured token, latency or cost-savings claim. Use actual metering before estimating benefits."],
]);

heading(1, "PART 2 — Executive Summary");
para("The platform's useful limited feature set is broader than its fully qualified operational scope. The new provider handoff interfaces reduce manual packaging effort while retaining source identity, but external adapters, authorizations and real execution remain their own acceptance work. A positive public database check does not supply missing governance.");
heading(2, "2.1 Requirements and acceptance");
table(["Priority", "Requirement", "Acceptance evidence"], [
  ["MUST", "Truthful feature status and source identity", "Fresh dated observations linked to hashes; no unqualified ACTIVE claims."],
  ["MUST", "Fail-closed governed operations", "Actual restricted role/context and required control groups pass."],
  ["MUST", "Tenant-owned integration and data", "Owner/cross-owner tests plus provider-bound authorization."],
  ["MUST", "Unchanged Quest authority", "Course review never writes or substitutes credential eligibility."],
  ["MUST", "Qualification before marketplace opt-in", "Ineligible artifacts cannot enter public supply; authorized launch remains explicit."],
  ["SHOULD", "Accessible recoverable operator flows", "Distinct empty/error/stale states, named controls, keyboard and narrow-screen checks."],
  ["SHOULD", "Immutable, inspectable release evidence", "Exact bytes/hash, real operation references and historical receipt retention."],
]);
heading(2, "2.2 Risks and mitigations");
bullets([
  "False assurance from readiness: label health, configuration and full workflow acceptance separately.",
  "Privileged DB fallback: preserve restricted runtime context and stop on migration/verification failures.",
  "Provider credential or source leakage: user-owned references, broker-side secrets, explicit content-sharing consent and source-integrity checks.",
  "Stale artifact selection: retain exact parent/verified-child lineage; do not substitute a latest unrelated artifact.",
  "Misleading learning credentials: keep course completion, Quest eligibility and live verification distinct.",
  "Unpatched transitive dependencies: retain findings and reachability boundaries pending a compatible patch or reviewed replacement."
]);
heading(2, "2.3 Quality scorecard disclosure");
para("Clarity, traceability, atomicity, security, maintainability, accessibility, operability, economics, interoperability and evidence currency are review dimensions, not certified scores. Independent scoring is NOT PERFORMED. No inherited SPC rating, 50/50 claim, NFT registration or marketplace certification is asserted.");

heading(1, "PART 3 — Atomic Assessment Worksheet");
para("The following 45 single-operation units are a documentary assessment/acceptance specification, not newly created project tasks or a claim that these operations have run. Each declares its input, one output and dependency. No unit authorizes production mutation.");
const units = [
  ["Freeze source identities", "Workspace files", "SHA-256 source manifest", "-"],
  ["Record deployment metadata", "Deployment-service response", "Dated deployment record", "A01"],
  ["Record process health", "Anonymous GET /api/healthz", "Timestamped response", "A02"],
  ["Record baseline readiness", "Anonymous GET /api/readyz", "Scoped readiness record", "A02"],
  ["Record marketplace gate", "Anonymous GET /api/sphinx/catalog", "Public-open observation", "A02"],
  ["Enumerate client routes", "Current App.tsx", "Distinct route inventory", "A01"],
  ["Classify evidence currency", "Collected observations", "Fresh/historic/unverified map", "A01"],
  ["Count invariant states", "Current progress.json", "Live-state count table", "A01"],
  ["Define scan exclusions", "Observed scope", "Explicit untested-operation list", "A07"],
  ["Map F0–F4 capabilities", "Current gate source", "Purpose/boundary register", "A01"],
  ["Map F5–F8 capabilities", "Current gate source", "Purpose/boundary register", "A01"],
  ["Map F9/F9.5 branch", "Artifact-class routing contract", "Software/firmware boundary note", "A01"],
  ["Map F10 exports", "Export target definitions", "Target/operation matrix", "A01"],
  ["Map F11 lineage", "Verified-bundle selector", "Parent-child selection rule", "A01"],
  ["Classify F12 evidence", "Readiness and workflow contract", "Implemented/unproven distinction", "A04"],
  ["Separate preparation scope", "Preparation release profile", "Allowed-draft capability list", "A01"],
  ["Identify SQL guard groups", "database-protection.ts", "Six-group readiness contract", "A01"],
  ["Classify historical SQL facts", "Prior dated catalog snapshot", "Non-current evidence annotation", "A07"],
  ["Record course lesson scope", "learning-curriculum.ts", "31-lesson track inventory", "A01"],
  ["Document Quest authority", "Badge progress/claim contracts", "Unchanged eligibility statement", "A01"],
  ["Map Boomerang authority", "Origin/review contract", "Supporting-input boundary", "A01"],
  ["Map Player authority", "Player runtime contract", "Advisory-only boundary", "A01"],
  ["Record library supply gate", "Catalog qualification contract", "Opt-in/qualification statement", "A05"],
  ["Classify manual provider support", "F10/F11 handoff documentation", "Export-only availability statement", "A13"],
  ["List connected prerequisites", "Broker contract", "Adapter qualification checklist", "A13"],
  ["Record known advisories", "Dated dependency review", "Unresolved findings register", "A07"],
  ["Calculate stabilization ratio", "10-item fix checklist", "7/10 development-only percentage", "A01"],
  ["Record archive verification", "Sessions checkpoint", "Attributed scoped test evidence", "A07"],
  ["Record signed-in test gap", "Browser verification record", "Unverified journey list", "A07"],
  ["Define accessibility acceptance", "Open audit scope", "Route/state acceptance criteria", "A29"],
  ["Define broker write evidence", "Target-specific operation contract", "Real-operation receipt criteria", "A25"],
  ["Define verifier acceptance", "Independent receipt contract", "Bound signed-receipt criteria", "A17"],
  ["Define runtime-context acceptance", "Security rules and guard contract", "Restricted-login evidence checklist", "A17"],
  ["Define rollout acceptance", "F12 operational contract", "Staged health/rollback evidence criteria", "A15"],
  ["Define marketplace launch acceptance", "Qualification and launch policy", "Owner opt-in launch checklist", "A23"],
  ["Define course acceptance", "Learning workflow contract", "Student/instructor journey checklist", "A19"],
  ["Compile route status map", "Route inventory and evidence classes", "Access/status site map", "A06"],
  ["Compile requirement matrix", "Documented must/should requirements", "Requirement/evidence table", "A09"],
  ["Compile risk register", "Open assurance gaps", "Risk/mitigation list", "A26"],
  ["Specify limited release scope", "Boundary registers", "Conditional release statement", "A38"],
  ["Assign review responsibilities", "Required acceptance disciplines", "Unstaffed responsibility matrix", "A39"],
  ["Order acceptance packages", "Declared dependencies", "Dependency-ordered work sequence", "A40"],
  ["Compile the living PDD", "Eight SCAN stages and four parts", "Readable dated report", "A42"],
  ["Validate report coverage", "Compiled report and route list", "45-unit/route coverage result", "A43"],
  ["Archive report integrity", "Final PDF and source manifest", "Output SHA-256 evidence manifest", "A44"],
];
if (units.length !== 45) throw new Error("Expected exactly 45 atomic units.");
units.forEach(([action, input, output, dependency], i) => {
  if (i % 9 === 0) heading(2, `Phase ${Math.floor(i / 9) + 1} — ${["Freeze and evidence", "Capability boundaries", "Training and integration", "Acceptance criteria", "Release and documentation"][Math.floor(i / 9)]}`);
  heading(3, `A${String(i + 1).padStart(2, "0")} — ${action}`);
  para(`Priority: ${i < 9 || [16, 31, 32, 33, 39].includes(i) ? "P0 / RED" : i < 27 ? "P1 / HIGH" : "P2 / STANDARD"}. Input: ${input}. Output: ${output}. Dependency: ${dependency}. Success: the named output is explicit, source-bound and scoped to its evidence; unsupported facts remain unverified.`);
});
heading(2, "Token economics");
para("Not measured for this scan. No pre/post token benchmark, semantic preservation percentage or annual saving is asserted. Future measurement must retain actual provider/model usage, pricing dates and a declared workload before comparing cost.");

heading(1, "PART 4 — Implementation and Assurance Plan");
heading(2, "4.1 VIBE DJ tool selection");
para("Retain the current Replit/pnpm workspace, React/Vite, Express, PostgreSQL, Drizzle migrations and OpenAPI-generated contracts. Use CODE DJ for source/IDE handoff, not as independent verification. Use targeted component/route tests and public probes before expensive authorised browser work. Choose tools by stack fit, safety, maintainability, observable output and cost; no arbitrary playlist percentages or tool migrations are required.");
heading(2, "4.2 ORCHESTRA and Camelot responsibility map");
para("The following are proposed review responsibilities, not proof that a named SPC or external agent executed. Named accountable people are to be assigned by the owner.");
table(["Seat / discipline", "Primary responsibility"], [
  ["0 / SPHINX", "Qualified supply and public catalog launch governance"],
  ["1 / ATLAS + STRATEGOS", "Scope, requirement traceability and business priority"],
  ["2 / Product owner", "Acceptance and public claims"],
  ["3 / CODE DJ", "Source lineage, build/export integrity"],
  ["4 / BUGMXT", "Reproduction and recovery evidence"],
  ["5 / SPARTAN", "Bounded limited release and excluded scope"],
  ["6 / ARES", "Security review and containment"],
  ["7 / ADA", "Architecture, API and data contracts"],
  ["8 / OSIRIS", "Custody and orchestration requirements"],
  ["9 / Economics reviewer", "Actual usage/budget measurement"],
  ["10 / Independent verifier", "Qualified independent receipts; no self-attestation"],
  ["11 / SKRIBE + KLARITY", "Readable report, fidelity and editorial review"],
  ["12 / Authorised operator", "Deployment, monitoring and rollback evidence"],
]);
heading(2, "4.3 Eight acceptance packages");
table(["Order", "Work package", "Exit condition"], [
  ["1", "Freeze and reconcile release identity", "Source, deployed identity and evidence dates aligned."],
  ["2", "Limited signed-in acceptance", "Owner/student/instructor routes and negative cases observed without bypass."],
  ["3", "Reviewed security installation evidence", "Runtime login/context and all required controls pass; no weakened checks."],
  ["4", "Independent verifier qualification", "Real source-bound positive and negative receipt evidence."],
  ["5", "Governed IMPRIMA/SHORT SPRINTS", "Protected workflow, immutable Final/ruling and rejection paths proven."],
  ["6", "Qualified provider and F12 operations", "Real target operations, health hold and rollback/promotion evidence."],
  ["7", "Sphinx opt-in and authorised opening", "Eligible artifacts only; explicit opening and revocation/privacy checks."],
  ["8", "Living evidence reconciliation", "Invariant-specific live results and refreshed report match observed release."],
]);
para("The dependency-advisory review and broader accessibility audit may proceed independently of protected activation work. Existing separately queued broker, handoff-history and signed-in verification work is not duplicated or declared completed here. No calendar duration is promised before external and security dependencies are resolved.");

heading(1, "ADDENDUM A — Current Site Map");
para("This is an implementation route map, not a claim that every page was observed live. HTTP 200 for a client route can be an access/sign-in shell. Roles, feature gates and backend checks still determine usable actions.");
const publicRoutes = new Set(["/verify", "/test-your-agent", "/calculate-your-savings", "/sphinx", "/status"]);
const names = {
  "/": "Access front door / authenticated redirect",
  "/verify": "Public artifact/certificate verification",
  "/test-your-agent": "Acquisition assessment",
  "/calculate-your-savings": "Acquisition calculator",
  "/sphinx": "Sphinx Marketplace shell",
  "/status": "Dependency/readiness recovery",
  "/command": "Command Deck",
  "/guide": "Platform guide",
  "/boomerang": "Whole-F support and reviewed returns",
  "/learn": "FORGE FIELD ENGINEER student/teaching home",
  "/teach/cohorts/:id": "Scoped cohort review / People",
  "/sessions": "Sessions Archive",
  "/session/new": "New session",
  "/ingest": "Source document ingestion",
  "/cartridge": "Cartridge preparation",
  "/f0": "Discovery/service engagement dashboard",
  "/session/:sessionId/verification": "Session verification workbench",
  "/session/:id": "F-stage session workspace (F1–F12 gated tabs)",
  "/prompts": "Prompt records",
  "/quests": "Quest badges/evidence",
  "/ascension": "Ascension/JST progression",
  "/account": "Account and entitlement",
  "/admin/badges": "Credential administration",
  "/admin/ops": "Operations administration",
  "/admin/provider-billing": "Provider-bill review",
  "/me/activity": "Personal activity",
  "/me/costs": "Personal cost records",
  "/exemplars": "Exemplar library / qualified supply",
  "/exemplars/:id": "Exemplar detail",
  "/spc-player": "Advisory SPC Player runs",
  "/spc-player/new": "New advisory run",
  "/spc-player/:id": "Advisory run detail",
  "/operations": "IMPRIMA / SHORT SPRINTS preparation and protected lanes",
  "/f10": "Release/export/provider console",
  "/learn-login/*?": "Individual learning sign-in / callback",
  "/learn-register/*?": "Individual learning registration / callback"
};
table(["Route", "Purpose", "Access / status"], routes.map(route => [
  `\`${route}\``, names[route] ?? "Declared client route",
  publicRoutes.has(route)
    ? route === "/sphinx" ? "Public shell; catalog CLOSED—LIVE OBSERVED" : "Public source route; interactions not freshly tested"
    : route.startsWith("/learn-register") ? "Public identity entry; HTML observed, admission untested"
    : route.startsWith("/learn-login") ? "Public identity entry; authenticated redirect in source"
    : route.startsWith("/admin/") ? "Authorised admin; not freshly tested"
    : route.startsWith("/teach/") ? "Scoped owner/instructor; not freshly tested"
    : "Authenticated / account-specific gates; live interaction unverified"
]));
heading(2, "A.1 Embedded capabilities, not separate routes");
bullets([
  "F1–F12 and supporting side-steps are embedded in session workspaces; a missing standalone /f11 or /f12 route does not mean no implementation exists.",
  "ATLAS 360 PLAN/SCAN are F6/F7 views; HOST DJ is advisory and the manual F11 card is not a protected deployment receipt.",
  "IMPRIMA and SHORT SPRINTS share /operations but private preparation and governed full actions have different acceptance gates.",
  "Learning entry is reactive to path/query changes and preserves valid invitation context; invitation possession does not override named email validation."
]);

heading(1, "ADDENDUM B — Active, Pending and Why");
table(["Capability", "Current status", "Reason / next evidence"], [
  ["API baseline / DB reachability", "LIVE—OBSERVED", "Fresh public health/readiness pass; scope limited."],
  ["F0–F8 creation interfaces", "IMPLEMENTED—SOURCE", "No fresh signed-in production/model acceptance in this scan."],
  ["Preparation documents/packages", "LOCAL—VERIFIED historically; LIVE UNVERIFIED", "Owner persistence/download acceptance must be confirmed on actual deployment."],
  ["Full IMPRIMA / SHORT SPRINTS", "INCOMPLETE / GOVERNED GATES", "Fresh readiness deferral; current production SQL details not reinspected."],
  ["XVL/VTE independent verification", "INCOMPLETE", "Advisory checks and intake are not real independent receipts."],
  ["F10 manual target packages", "IMPLEMENTED / LOCAL—VERIFIED", "New target contracts do not perform external operations."],
  ["F10 connected Slack/LangChain/LangSmith", "PENDING QUALIFIED BROKER", "Subscription alone does not supply adapter or authorisation."],
  ["F11 manual verified-source handoff", "IMPLEMENTED / LOCAL—VERIFIED", "No fresh download/import production acceptance."],
  ["F11 qualified automated execution", "GATED / UNVERIFIED", "Real provider authorization and bound target evidence required."],
  ["Full F12", "INCOMPLETE", "Current readiness explicitly defers; no real rollout/rollback observed."],
  ["Sphinx public marketplace", "INACTIVE—INTENTIONAL", "publicOpen=false and zero public items in fresh response."],
  ["Boomerang whole-F", "IMPLEMENTED; LIVE INTERACTION UNVERIFIED", "Anonymous 401 proves protection, not review/adoption correctness."],
  ["SPC Player", "IMPLEMENTED ADVISORY", "No execution, certification or entitlement elevation."],
  ["FORGE FIELD ENGINEER", "IMPLEMENTED; LIVE COHORT UNVERIFIED", "Named invitation, active membership and real pilot acceptance still matter."],
  ["Azure Key Vault", "DEFERRED CLASS B", "User-approved deferral remains visible in readiness."],
]);
heading(2, "B.1 Stabilization checklist");
para("Equal-weight denominator: ten recent development stabilization items. Seven complete = 70%. Three remain: unresolved braces/sprintf-js findings, authorised signed-in browser verification, and the broader accessibility/responsive audit. Sessions Archive and public status improvements advance the wider audit but do not close it.");
para("This percentage excludes production rollout, protected operations installation, independent verification/F12, Azure and the broader project backlog. It is not a claim that 70% of the platform is live or safe to activate.");

heading(1, "ADDENDUM C — Evidence and Revalidation");
para("Companion files: public-evidence.json contains the full non-secret public probe bodies and collection timestamps; evidence-manifest.json contains source hashes, route inventory, ledger summaries and output hashes. The PDF and editable Markdown share the same documentary content. Generated output remains outside application runtime packaging.");
bullets([
  "To refresh: obtain deployment metadata again, recollect public evidence and inspect the changed source.",
  "For authenticated acceptance: use an explicitly authorised individual/owner session. Do not bypass access gates or treat mocked component tests as live acceptance.",
  "For SQL claims: use approved read-only production runtime-role checks; report login, role membership and actual required positive privileges without credentials.",
  "For activation: obtain real verifier, custody and provider evidence through supported protected workflows; never generate a synthetic passing record for a customer release.",
  "For quality: review new advisories, route/state accessibility evidence and stale artifact behaviour before closing their respective checklist items."
]);

if (routes.some(route => !md.join("\n").includes(`\`${route}\``))) throw new Error("Route coverage missing.");
const markdown = md.join("\n");
if ((markdown.match(/^### A\d\d —/gm) ?? []).length !== 45) throw new Error("Atomic unit coverage missing.");
const basename = "ATLAS_360_SCAN_Living_PDD_2026-10-20";
fs.writeFileSync(path.join(dir, `${basename}.md`), markdown);

const require = createRequire(path.join(root, "lib/export/package.json"));
const PDFDocument = require("pdfkit");
const doc = new PDFDocument({
  size: "A4", bufferPages: true,
  margins: { top: 48, bottom: 52, left: 48, right: 48 },
  info: { Title: "ATLAS 360 SCAN Living PDD — 20 October 2026",
    Author: "ATANDA Command Centre", Subject: "Current-state assessment, gated activation and site-map addendum" }
});
const pdf = path.join(dir, `${basename}.pdf`);
const stream = fs.createWriteStream(pdf);
doc.pipe(stream);
const t = createTheme(doc);
const plain = s => s.replace(/`/g, "").replace(/\*\*/g, "").replace(/→/g, "->");
doc.save().fillColor(NAVY).rect(0, 0, doc.page.width, 282).fill().restore();
doc.fillColor("white").font("Helvetica-Bold").fontSize(11).text("ATANDA / COMMAND CENTRE", 48, 52);
doc.fontSize(34).text("ATLAS 360 SCAN", 48, 110);
doc.fontSize(27).text("Living PDD", 48, 157);
doc.fontSize(15).text("Current codebase + live / pending site map", 48, 214);
doc.y = 319;
t.lead("An evidence-grounded platform assessment and activation roadmap.");
t.kv([
  ["Edition", "20 October 2026 | America/Chicago"],
  ["Evidence", "Fresh anonymous probes + current source + attributed historical checks"],
  ["Structure", "8 SCAN stages / 4 ATLAS parts / 45 atomic units / 3 addenda"],
  ["Decision", "Healthy public baseline; full governed activation not established"],
  ["Assurance", "Analyst scan — not independent certification"]
]);
t.p("New in this edition: subscription-based F10/F11 handoff, recent recovery/accessibility fixes, 70% bounded stabilization progress and a refreshed source-backed site map.");
t.p("No production mutations, security weakening, deployment or external provider writes were performed.");
doc.addPage();
let paragraph = [], rows = [];
function flushParagraph() {
  if (!paragraph.length) return;
  const s = plain(paragraph.join(" "));
  doc.font("Helvetica").fontSize(10.5);
  const height = doc.heightOfString(s, { width: doc.page.width - 96, lineGap: 2.5 });
  if (height < doc.page.height - 100 && doc.y + height + 16 > doc.page.height - 52) doc.addPage();
  t.p(s); paragraph = [];
}
function flushRows() {
  if (!rows.length) return;
  const cells = rows.filter(r => !/^\|\s*---/.test(r)).map(r => r.split("|").slice(1, -1).map(c => plain(c.trim())));
  // Wide tables become labelled records, preserving legibility and avoiding
  // tiny fonts, chopped long routes, or multi-page table-cell overflow.
  for (const record of cells.slice(1)) {
    t.pageGuard(125);
    t.h3(record[0]);
    record.slice(1).forEach((value, i) => t.p(`${cells[0][i + 1]}: ${value}`));
  }
  rows = [];
}
for (const line of markdown.split("\n")) {
  if (line.startsWith("|")) { flushParagraph(); rows.push(line); continue; }
  flushRows();
  if (!line.trim()) { flushParagraph(); continue; }
  if (line.startsWith("# ")) {
    flushParagraph();
    if (doc.y > 80) doc.addPage();
    const title = plain(line.slice(2));
    doc.outline.addItem(title);
    t.h1(title);
  } else if (line.startsWith("## ")) {
    flushParagraph(); t.h2(plain(line.slice(3)));
  } else if (line.startsWith("### ")) {
    flushParagraph(); t.h3(plain(line.slice(4)));
  } else if (line.startsWith("- ")) {
    flushParagraph(); t.bullets([plain(line.slice(2))]);
  } else paragraph.push(line);
}
flushParagraph(); flushRows();
const { count } = doc.bufferedPageRange();
for (let i = 0; i < count; i++) {
  doc.switchToPage(i);
  const bottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.fillColor(SOFT).font("Helvetica").fontSize(8).text(
    `ATANDA | ATLAS 360 SCAN | 20 Oct 2026 | ${i + 1} / ${count}`,
    48, doc.page.height - 30, { width: doc.page.width - 96, align: "center", lineBreak: false });
  doc.page.margins.bottom = bottom;
}
doc.end();
await new Promise((resolve, reject) => { stream.on("finish", resolve); stream.on("error", reject); });
fs.writeFileSync(path.join(dir, "evidence-manifest.json"), JSON.stringify({
  title: "ATLAS 360 SCAN Living PDD — 20 October 2026",
  reportDateLocal: "2026-10-20", generatedAt: new Date().toISOString(), workspaceHead: head,
  evidenceWindowUtc: { first: evidence.observations[0].observedAt, last: evidence.observations.at(-1).observedAt },
  deployment: evidence.deployment, routes,
  ledger: {
    invariants: ledger.invariants.length, prompts: ledger.prompts.length,
    invariantLive: stateCounts(ledger.invariants, "liveActivity"),
    promptLocal: stateCounts(ledger.prompts, "localBuild"),
    promptLive: stateCounts(ledger.prompts, "liveActivity")
  },
  atomicUnits: units.length, sources,
  outputs: [pdf, path.join(dir, `${basename}.md`), path.join(dir, "public-evidence.json")]
    .map(file => ({ file: path.basename(file), sha256: sha(fs.readFileSync(file)) })),
  caveats: evidence.limits
}, null, 2));
console.log(JSON.stringify({ pdf: path.relative(root, pdf), pages: count, routes: routes.length, atomicUnits: units.length }));
