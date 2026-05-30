import type {
  CodebaseBundle,
  HarnessArtifact,
  PfpReport,
} from "@workspace/api-client-react";
import { downloadZip } from "./zipExport";

const PLATFORM_LABELS: Record<string, string> = {
  "nextjs-vercel": "Next.js → Vercel",
  "react-vite-static": "React + Vite (static)",
  "express-replit": "Express → Replit",
  "expo-mobile": "Expo (mobile)",
  "pnpm-monorepo": "pnpm monorepo",
};

/** IDEs whose agents auto-read a project-level instruction file. */
export const SUPPORTED_IDES: { ide: string; file: string }[] = [
  { ide: "Codex / cross-tool standard", file: "AGENTS.md" },
  { ide: "Cursor", file: ".cursor/rules/code-dj.mdc" },
  { ide: "Claude Code", file: "CLAUDE.md" },
  { ide: "Replit Agent", file: "replit.md" },
  { ide: "GitHub Copilot", file: ".github/copilot-instructions.md" },
  { ide: "Windsurf", file: ".windsurfrules" },
];

function platformLabel(p: string): string {
  return PLATFORM_LABELS[p] ?? p;
}

function manifestBlock(b: CodebaseBundle): string {
  const m = b.manifest;
  return [
    `- **Platform:** ${platformLabel(b.platform)}`,
    `- **Framework:** ${m.framework}`,
    `- **Language:** ${m.language}`,
    `- **Entrypoint:** \`${m.entrypoint}\``,
    `- **Install:** \`${m.installCommand}\``,
    `- **Run:** \`${m.runCommand}\``,
    `- **Build:** ${m.buildCommand ? `\`${m.buildCommand}\`` : "_none_"}`,
    `- **Deploy target:** ${m.deployTarget}`,
  ].join("\n");
}

function oneLine(s: string, max = 160): string {
  const flat = (s || "").replace(/\s+/g, " ").trim().replace(/\|/g, "\\|");
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat || "—";
}

type MvpContent = {
  sections?: { key: string; title: string; body: string }[];
  donut?: { a: number; b: number; c: number };
};

/** Concise summary of the certified MVP-PDD that seeded this scaffold. */
function mvpSummaryBlock(source?: HarnessArtifact): string {
  if (!source) return "_Source MVP-PDD content not available in this export._";
  const content = (source.artifactContent ?? null) as MvpContent | null;
  const sections = content?.sections ?? [];
  if (!sections.length) return "_Source MVP-PDD has no readable sections._";
  const lines: string[] = [];
  const d = content?.donut;
  if (d) {
    lines.push(
      `**Collapse profile (donut):** CLASS A ${d.a} · CLASS B ${d.b} · CLASS C ${d.c}`,
      "",
    );
  }
  lines.push("| PDD section | Summary |", "|---|---|");
  for (const s of sections) {
    lines.push(`| **${s.title || s.key}** | ${oneLine(s.body)} |`);
  }
  return lines.join("\n");
}

/** Best-effort file → PDD-section map derived from PFP code↔spec findings. */
function fileToPddRefs(pfp?: PfpReport): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  if (!pfp) return map;
  for (const f of pfp.findings) {
    if (!f.codeRef || !f.pddRef) continue;
    // codeRef is often "src/foo.ts:12" or "src/foo.ts#fn" — keep the file part.
    const filePart = f.codeRef.split(/[:#\s]/)[0]?.trim();
    if (!filePart) continue;
    if (!map.has(filePart)) map.set(filePart, new Set());
    map.get(filePart)!.add(f.pddRef);
  }
  return map;
}

/** One row per scaffold file mapping it back to the certified spec. */
function traceabilityBlock(b: CodebaseBundle, pfp?: PfpReport): string {
  const refs = fileToPddRefs(pfp);
  const rows = b.files.map((f) => {
    let matched: string[] = [];
    for (const [filePart, set] of refs) {
      if (f.path === filePart || f.path.endsWith(filePart) || filePart.endsWith(f.path)) {
        matched = matched.concat([...set]);
      }
    }
    const pdd = matched.length
      ? matched.join(", ")
      : "— _(trace to a PDD section in your IDE)_";
    return `| \`${f.path}\` | ${f.language} | ${pdd} |`;
  });
  return ["| File | Language | PDD section(s) |", "|---|---|---|", ...rows].join(
    "\n",
  );
}

function certBlock(source?: HarnessArtifact): string {
  if (!source) return "_Source MVP-PDD not available in this export._";
  const cert = (source.spartanCert ?? null) as {
    certId?: string;
    class?: string;
    verificationUrl?: string;
  } | null;
  const lines = [
    `- **Source artifact id:** \`${source.id}\``,
    `- **SPARTAN class:** ${cert?.class ?? source.certTier ?? "—"}`,
    `- **Cert id:** ${cert?.certId ? `\`${cert.certId}\`` : "—"}`,
  ];
  if (cert?.verificationUrl) {
    lines.push(`- **Verification URL:** ${cert.verificationUrl}`);
  }
  return lines.join("\n");
}

function pfpBlock(pfp?: PfpReport): string {
  if (!pfp) {
    return [
      "_No PFP (PDD Fidelity Protocol) drift check was run before this export._",
      "Re-derive fidelity in your IDE: confirm every scaffold file still traces",
      "back to a section of the certified MVP-PDD before extending the codebase.",
    ].join("\n");
  }
  const c = pfp.counts;
  const head = `**Verdict:** \`${pfp.verdict}\` · **FCI:** ${pfp.fci}/100 · critical ${c.critical} · high ${c.high} · medium ${c.medium} · low ${c.low}`;
  const findings = pfp.findings.length
    ? [
        "",
        "| Severity | Code | PDD ref | Code ref | Detail |",
        "|---|---|---|---|---|",
        ...pfp.findings.map(
          (f) =>
            `| ${f.severity} | ${f.code} | ${f.pddRef || "—"} | ${f.codeRef || "—"} | ${(f.detail || "").replace(/\|/g, "\\|").replace(/\n/g, " ")} |`,
        ),
      ].join("\n")
    : "\n_No outstanding findings._";
  return [`${head}`, `${pfp.summary}`, findings].join("\n\n");
}

const FIDELITY_RULES = [
  "1. **Every file traces to the spec.** Each source file must map back to a",
  "   section of the certified MVP-PDD. Do not add files that have no spec basis.",
  "2. **Keep the MVP lean.** This scaffold is a deliberately minimal cut (≤ 12",
  "   files). Add scope only when the certified spec calls for it.",
  "3. **No silent drift.** If you change behaviour, update the spec mapping in",
  "   this file alongside the code so fidelity stays auditable.",
  "4. **Critical drift blocks shipping.** Treat any critical mismatch between the",
  "   code and the certified spec as a hard stop until it is reviewed and resolved.",
].join("\n");

const DOCTRINE_NOTE = [
  "> **Doctrine.** CODE DJ (the F8 engine of the FORGE.BONSAI HARNESS) is the",
  "> terminal step of an ordered atomic-prompt **instruction layer** — it is not",
  "> an SPC. It scaffolds this codebase from a SPARTAN-certified **MVP-PDD**",
  "> (the qualified output of a HARNESS session; a session seeded from an ingested",
  "> **IPDD** produces a **PWDD** instead). This file carries that doctrine forward",
  "> so your IDE's agent keeps building in fidelity to the certified spec.",
].join("\n");

/** The universal AGENTS.md — the CODE DJ operating brief for any IDE agent. */
export function buildAgentsMd(
  bundle: CodebaseBundle,
  source?: HarnessArtifact,
  pfp?: PfpReport,
): string {
  return [
    "# CODE DJ — Agent Operating Brief",
    "",
    DOCTRINE_NOTE,
    "",
    "## What this project is",
    "",
    `A deploy-ready scaffold generated by **CODE DJ (F8)** for **${platformLabel(bundle.platform)}**, ` +
      "to be continued by your IDE's coding agent against the certified spec below.",
    "",
    "## Certified source (SPARTAN)",
    "",
    certBlock(source),
    "",
    "## Certified MVP-PDD summary",
    "",
    mvpSummaryBlock(source),
    "",
    "## Build manifest",
    "",
    manifestBlock(bundle),
    "",
    "## File ↔ spec traceability",
    "",
    "Every scaffold file traces back to the certified MVP-PDD. Rows without a",
    "resolved PDD section must be traced to one before they are extended.",
    "",
    traceabilityBlock(bundle, pfp),
    "",
    "## File ↔ spec fidelity (PFP / BUGMXT)",
    "",
    pfpBlock(pfp),
    "",
    "## Fidelity rules for the IDE agent",
    "",
    FIDELITY_RULES,
    "",
    "## How to continue",
    "",
    `1. Install: \`${bundle.manifest.installCommand}\``,
    `2. Run: \`${bundle.manifest.runCommand}\``,
    bundle.manifest.buildCommand
      ? `3. Build: \`${bundle.manifest.buildCommand}\``
      : "3. (No build step.)",
    "4. Extend only along the certified spec; preserve the fidelity rules above.",
    "",
    bundle.notes ? `## CODE DJ notes\n\n${bundle.notes}\n` : "",
  ].join("\n");
}

function cursorMdc(): string {
  return [
    "---",
    "description: CODE DJ operating brief — build in fidelity to the certified MVP-PDD",
    "globs:",
    "alwaysApply: true",
    "---",
    "",
    "Follow the CODE DJ operating brief in `AGENTS.md` at the project root.",
    "It defines the certified spec, the build manifest, and the file ↔ spec",
    "fidelity rules. Every change must trace back to a section of the certified",
    "MVP-PDD; keep the MVP lean and never introduce silent drift.",
  ].join("\n");
}

function shortBrief(bundle: CodebaseBundle): string {
  return [
    `- Install: \`${bundle.manifest.installCommand}\``,
    `- Run: \`${bundle.manifest.runCommand}\``,
    bundle.manifest.buildCommand
      ? `- Build: \`${bundle.manifest.buildCommand}\``
      : "- Build: none",
    "",
    "Read `AGENTS.md` for the full CODE DJ operating brief: the certified spec,",
    "the file ↔ spec fidelity map, and the rules below.",
    "",
    FIDELITY_RULES,
  ].join("\n");
}

function claudeMd(bundle: CodebaseBundle): string {
  return [
    "# CLAUDE.md",
    "",
    "This project was scaffolded by CODE DJ (the F8 engine of the FORGE.BONSAI",
    "HARNESS) from a SPARTAN-certified MVP-PDD. The HARNESS is an instruction",
    "layer, not an SPC.",
    "",
    shortBrief(bundle),
  ].join("\n");
}

function replitMd(bundle: CodebaseBundle): string {
  return [
    `# ${bundle.manifest.framework}`,
    "",
    "Scaffolded by CODE DJ (F8) from a SPARTAN-certified MVP-PDD. Continue",
    "building in fidelity to the certified spec — see `AGENTS.md`.",
    "",
    "## Run",
    "",
    shortBrief(bundle),
  ].join("\n");
}

function copilotMd(bundle: CodebaseBundle): string {
  return [
    "# Copilot instructions",
    "",
    "Build in fidelity to the CODE DJ operating brief in `AGENTS.md`. This",
    "codebase is a CODE DJ (F8) scaffold of a SPARTAN-certified MVP-PDD.",
    "",
    shortBrief(bundle),
  ].join("\n");
}

function windsurfRules(bundle: CodebaseBundle): string {
  return [
    "Follow the CODE DJ operating brief in AGENTS.md.",
    "This is an F8 CODE DJ scaffold of a SPARTAN-certified MVP-PDD; the HARNESS",
    "is an instruction layer, not an SPC.",
    "",
    shortBrief(bundle),
  ].join("\n");
}

/**
 * Build the full set of files for the export bundle: the real scaffold folder
 * tree, the universal AGENTS.md, per-IDE adapter files, and the raw bundle JSON
 * retained for lineage.
 */
export function buildExportFiles(
  bundle: CodebaseBundle,
  source?: HarnessArtifact,
  pfp?: PfpReport,
): Record<string, string> {
  const files: Record<string, string> = {};
  // Real scaffold folder tree at the bundle's own paths.
  for (const f of bundle.files) {
    files[f.path] = f.content;
  }
  // Universal + per-IDE agent instruction files.
  files["AGENTS.md"] = buildAgentsMd(bundle, source, pfp);
  files[".cursor/rules/code-dj.mdc"] = cursorMdc();
  files["CLAUDE.md"] = claudeMd(bundle);
  files["replit.md"] = replitMd(bundle);
  files[".github/copilot-instructions.md"] = copilotMd(bundle);
  files[".windsurfrules"] = windsurfRules(bundle);
  // Raw bundle retained for lineage / debugging.
  files[".code-dj/bundle.json"] = JSON.stringify(
    { ...bundle, sourceMvpPddArtifactId: source?.id ?? null },
    null,
    2,
  );
  return files;
}

export async function exportCodeDjBundle(
  bundle: CodebaseBundle,
  source?: HarnessArtifact,
  pfp?: PfpReport,
): Promise<void> {
  const files = buildExportFiles(bundle, source, pfp);
  const name = `code-dj-${bundle.artifactId.slice(0, 8)}-${bundle.platform}.zip`;
  await downloadZip(name, files);
}
