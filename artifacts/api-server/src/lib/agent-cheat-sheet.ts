import { ColonizationTargetSchema } from "../engines/colonization-target";

type Context = {
  sourceName?: string | null;
  creatorName?: string | null;
  organizationName?: string | null;
  target?: string;
  now?: Date;
};
const missing = "Not recorded — confirmation required.";
function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.filter(v => typeof v === "string").join("; ");
  return "";
}
function excerpt(value: string, limit: number) {
  return value.length <= limit ? value : `${value.slice(0, limit)}\n[Excerpt; consult the full source SPC.]`;
}
/** Deterministic source-derived metadata; no fabricated identity, scores or deployment verdict. */
export function spcCheatSheetDocument(projectName: string, sourceId: string, source: Record<string, unknown>, context: Context = {}) {
  const sections = Array.isArray(source.sections) ? source.sections as Record<string, unknown>[] : [];
  const section = (key: string) => {
    const row = sections.find(s => s && typeof s === "object" && s.key === key);
    return text(row?.body) || text(row?.content);
  };
  const identity = section("card_identity_metadata");
  // Identity rows are source declarations, not verified account/legal records.
  const declared = (...labels: string[]) => {
    for (const label of labels) {
      const row = identity.split("\n").find(line =>
        new RegExp(`^\\s*\\|?\\s*${label}\\s*\\|`, "i").test(line));
      if (row) {
        const cells = row.split("|").map(s => s.trim()).filter(Boolean);
        if (cells[1]) return cells[1];
      }
    }
    return "";
  };
  const target = ColonizationTargetSchema.safeParse(context.target ?? source.colonizationTarget ?? "UNDECIDED");
  const selectedTarget = target.success ? target.data : "UNDECIDED";
  const family = selectedTarget.split("::")[0];
  const placement = family === "AZURE" ? "Use a reviewed Azure agent/application wrapper; keep authorization in gateway/middleware and least-privilege tool identities."
    : family === "AWS" ? "Use a reviewed AWS agent/application wrapper; bind IAM permissions and tool allowlists outside the prompt."
    : ["IDE", "VIBE_APP", "PROGRAMMING_ENVIRONMENT", "GITHUB"].includes(family) ? "Place reviewed instructions in the target's supported agent/project rules and keep secrets and tool permissions in its secure runtime configuration."
    : family === "SLACK" ? "Use an authorized Slack app wrapper; verify workspace consent, channel scopes and inbound request signatures."
    : ["LANGCHAIN", "LANGSMITH"].includes(family) ? "Bind the specification to a reviewed chain/agent or evaluation wrapper; enforce tool allowlists and retain traces without leaking private content."
    : "Bind the specification to the selected platform's supported instruction layer and a reviewed runtime wrapper.";
  const author = text(source.author) || declared("Author", "Created by");
  const owner = text(source.owner) || declared("Owner");
  const metadata = {
    version: "spc-cheat-sheet-v2",
    spcName: text(source.name) || declared("Name", "SPC Name", "Product Name") || context.sourceName || missing,
    projectFileName: context.sourceName || `${projectName} — SPC (${sourceId})`,
    lineage: [section("lineage_traceability"), section("dna_architecture")].filter(Boolean).join("\n\n") || missing,
    timestamp: (context.now ?? new Date()).toISOString(),
    skills: text(source.skillSets) || text(source.skills) || section("context_craft_pillars") || missing,
    target: selectedTarget,
    savant: `${selectedTarget === "UNDECIDED" ? "No target selected. Choose a destination before integration." : `Selected target: ${selectedTarget}. ${placement}`}
SENSE: identify the destination and supported instruction/runtime interfaces.
AUDIT: map required skills, data, tools and permissions.
VERIFY: check source fidelity and coverage of GRO, ZPOS and Honesty Gate.
ADJUDICATE: obtain the required compatibility/evaluation verdict; none is issued by this sheet.
NAME: retain SPC/project identity and source lineage.
TRANSLATE: adapt packaging, never weaken mandatory safeguards.
TRANSMIT: use the authorized F10/F11 handoff, then test in a sandbox before any F12 promotion.
Planning guidance only: not installation, execution, FIT certification or release consent.`,
    constraints: [section("risk_register"), section("governance_signing")].filter(Boolean).join("\n\n") || missing,
    author: author ? `${author} (source-declared; not independently verified)`
      : `${missing}${context.creatorName ? ` Creator account: ${context.creatorName}; authorship is not established by account identity.` : ""}`,
    owner: owner ? `${owner} (source-declared; not independently verified)`
      : context.organizationName ? `Enterprise workspace: ${context.organizationName}. Legal/IP ownership requires confirmation; it is not inferred from authorship.`
        : `${missing} Subscriber custody does not by itself establish legal/IP ownership.`,
    organization: context.organizationName ?? null,
  };
  const markdown = `# ${excerpt(projectName, 100)} — SPC Cheat Sheet

## 1. Name of SPC
${excerpt(metadata.spcName, 200)}

## 2. Project file name
${excerpt(metadata.projectFileName, 250)}
Source artifact ID: ${sourceId}

## 3. Lineage — synthesized SPCs and source ancestry
${excerpt(metadata.lineage, 650)}
Lineage above is source-declared, not independently verified.

## 4. Date and time stamp
${metadata.timestamp} (UTC; Cheat Sheet creation time)

## 5. Skill sets — Junglenomics framework
${excerpt(metadata.skills, 900)}
Map skills to the seven Context Craft/JCSE pillars: SYSTEM, ROLE, INSTRUCTION, EXAMPLE, CONSTRAINT, FORMAT and DATA. No missing skill or score is inferred.

## 6. SAVANT Protocol colonization cheat sheet
${metadata.savant}

## 7. Stated constraints and ethical framework integrations
${excerpt(metadata.constraints, 600)}
Required internal criteria: GRO (harm avoidance, stop/escalation and least privilege), ZPOS+5 (efficiency without loss of required fidelity) and Honesty Gate (evidence, assumptions and limitations).
Internal runtime: text only; no tools, browsing, code execution, deployment or external side effects. Installed criteria are not proof of independent evaluation or target enforcement.

## 8. Author
${excerpt(metadata.author, 300)}

## 9. Owner
${excerpt(metadata.owner, 350)}

Source-derived preparation only. Excerpts are navigation aids; the complete SPC remains authoritative. Publication and downloads use IMPRIMA Portal. This sheet does not establish copyright registration or a transfer of rights.
`;
  return { metadata, markdown };
}

export function spcCheatSheet(projectName: string, sourceId: string, source: Record<string, unknown>, context: Context = {}) {
  return spcCheatSheetDocument(projectName, sourceId, source, context).markdown;
}
