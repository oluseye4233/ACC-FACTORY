// Reviewed, synthetic teaching examples. These are never customer project inputs.
export const STAGE_GUIDE_CATALOG = [
  ["F0", "Advisory", "Clarify the problem, constraints and evidence before production.",
    "Ask how a community reading-room assistant should handle uncertain opening hours. Record assumptions and advice, then return the findings to the originating stage.",
    "Advice supports a decision; it does not approve an artifact or unlock a gate."],
  ["F1", "Intake", "Capture a supported source and establish the project's working context.",
    "Start a Reading Room project with a short synthetic brief. Use the portal intake for supported files or the available text input. Review extracted content before continuing.",
    "A supplied link is not proof its content was fetched. Never paste passwords or private connection strings."],
  ["F2", "Atomic Prompt", "Define one bounded instruction with a clear acceptance condition.",
    "Ask the reading-room assistant to answer one opening-hours question using supplied evidence. Specify what an acceptable answer contains and require uncertainty when evidence is missing.",
    "Keep one task per atomic instruction; a saved prompt is not an executed or independently verified agent."],
  ["F3", "Molecular Agent", "Combine eligible instructions into a bounded agent specification.",
    "Create a reading-room helper with a defined role, permitted inputs, limits and output format. Inspect its governance requirements and companion artifact before accepting the specification.",
    "An agent specification is not a deployed service. Agent Creator still requires its checks and eligible runtime."],
  ["F4", "Micro PDD", "Turn an eligible agent specification into a small, inspectable implementation specification.",
    "Select the saved reading-room agent as the source. Describe its hours lookup, evidence requirements and error behaviour. Check that the Micro PDD preserves the original constraints.",
    "Do not force an early coding platform choice. Implementation recommendations belong to the conversion stage."],
  ["F5", "SPC and SCAN inputs", "Create a structured capability specification and supported reference context.",
    "Specify the reading-room lookup capability, its boundaries and acceptance examples. For SCAN, add supported website or repository references and inspect the evidence actually available.",
    "References are read-only context, not permission to run remote code or access private servers."],
  ["F6", "ATLAS PDD", "Create a PDD, PLAN or SCAN view from eligible saved F5 material.",
    "Choose the saved reading-room F5 artifact. Review scope, architecture, acceptance criteria and unresolved evidence in the resulting PDD. Preserve limitations in the chosen view.",
    "F6 uses eligible F5 sources. A planning or analysis document does not establish independent verification."],
  ["F7", "MVP PDD", "Define the smallest useful, testable implementation without removing governance.",
    "Limit the first reading-room release to answering hours questions from one supplied source. Keep failure cases and acceptance criteria. Review the actual assessment findings before continuing.",
    "Draft completion alone does not award a badge, certification or passing evaluation."],
  ["F8", "CODE ONE+", "Recommend an implementation path and create editable code from governed specifications.",
    "Review the reading-room implementation recommendation with CODE ONE+ and the CODE ORACLE/DJ support. Inspect the editable output, compare it with the specification and run the available drift check.",
    "A scaffold is not a finished application. Failed drift findings require remediation and a fresh check; handoff is not deployment."],
  ["F9", "Machine Floor", "Prepare controlled hardware configuration and required machine evidence where applicable.",
    "For a hypothetical reading-room display appliance, select the governed hardware profile and inspect required evidence. For a software-only assistant, follow the software path rather than inventing hardware work.",
    "Real physical actions require qualified machine gates. A preparation artifact cannot authorize actuation."],
  ["F9.5", "OSIRIS Custody", "Inspect exact artifact identity, integrity and custody before a qualified release.",
    "Compare the reading-room package identity and recorded hash with the bound specimen. If the bytes change, obtain fresh evidence rather than reusing the previous approval.",
    "A delivery receipt does not establish custody, verification or permission to release changed bytes."],
  ["F10", "Integration Handoff", "Package and hand off eligible work through the selected authorized integration.",
    "Choose a supported destination for the reading-room code, review target-specific packaging and grant the required consent. Inspect the delivery receipt and keep the editable source available.",
    "A subscription or connector alone does not prove target qualification. Delivery is not proof that code ran."],
  ["F11", "Target Refinement", "Continue through the available authorized third-party implementation or refinement path.",
    "Open the reading-room handoff in its chosen environment. Refine the code against the governed specification and retain returned evidence. Use the eligible supported path rather than claiming an unavailable adapter is active.",
    "External execution and specialist validation remain subject to their original credentials, evidence and consent gates."],
  ["F12", "Delivery Target", "Use the eligible delivery or deployment path and inspect the resulting evidence.",
    "Review the reading-room target, configuration and release conditions. Use available preparation or qualified execution, then inspect receipts and runtime evidence before describing the service as live.",
    "Preparation is not deployment. Missing target credentials or qualification must remain explicit and cannot be bypassed by watching a guide."],
] as const;
export type StageKey = typeof STAGE_GUIDE_CATALOG[number][0];
export type GuideKind = "EXPLAINER" | "DEMONSTRATION";
export function stageDefinition(stage: string) {
  const item = STAGE_GUIDE_CATALOG.find(row => row[0] === stage);
  if (!item) throw new Error("Unknown F stage");
  return { stageKey: item[0], name: item[1], outcome: item[2], example: item[3], limitation: item[4] };
}
export function defaultStageScript(stage: string, kind: GuideKind) {
  const d = stageDefinition(stage);
  return kind === "EXPLAINER"
    ? `Welcome to ARK ${d.stageKey}: ${d.name}. ${d.outcome} Review your eligible saved source, inspect the result and its recorded evaluation findings, and accept only what the evidence supports. ${d.limitation} If supporting work is needed, use the optional stage tools and return with the new artifact to the stage you left. This guide is optional and does not change production eligibility.`
    : `This is a narrated, synthetic worked example for ARK ${d.stageKey}, not a recording of a live customer project. ${d.example} Review the saved outcome and unresolved findings. ${d.limitation} If you leave for supporting work, return with the upgraded artifact and continue from the original stage. No score, certification or successful deployment is implied by this example.`;
}
