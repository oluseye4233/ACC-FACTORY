import type {
  VdjRecommendation,
  HostingPlan,
} from "@workspace/api-client-react";
import { downloadZip } from "./zipExport";

const HOST_LABELS: Record<string, string> = {
  "replit-deployments": "Replit Deployments",
  vercel: "Vercel",
  "fly-io": "Fly.io",
  render: "Render",
  railway: "Railway",
  "cloudflare-pages": "Cloudflare Pages",
  netlify: "Netlify",
  "aws-amplify": "AWS Amplify",
  "expo-eas": "Expo EAS",
};
const hostLabel = (p: string) => HOST_LABELS[p] ?? p;

const DOCTRINE_NOTE = [
  "> **Doctrine.** BUILD INSTRUCTIONS combines the two advisory side-steps of the",
  "> FORGE.BONSAI HARNESS — **VIBE ORACLE (F6-VDJ)**, which reads your ATLAS PDD and",
  "> recommends the IDE + coding vibe to build it, and **HOST ORACLE (F8-HDJ)**, which",
  "> ranks deployment hosts from your certified MVP-PDD. Both are advisory: they",
  "> do not block the F1 → F7 sequence and are never SPCs.",
].join("\n");

function vdjBlock(vdj?: VdjRecommendation): string {
  if (!vdj) {
    return "_No VIBE ORACLE recommendation has been generated yet. Run VIBE ORACLE against an ATLAS PDD to populate this section._";
  }
  const lines = [
    `- **Recommended IDE:** ${vdj.recommendedIde}`,
    `- **Recommended VIBE:** ${vdj.recommendedVibe}`,
    "",
    "**Rationale**",
    "",
    vdj.rationale,
  ];
  if (vdj.alternatives?.length) {
    lines.push(
      "",
      "**Alternatives**",
      "",
      "| Option | Fit |",
      "|---|---|",
      ...vdj.alternatives.map(
        (a) => `| ${a.name} | ${Math.round(a.fit * 100)}% |`,
      ),
    );
  }
  return lines.join("\n");
}

function hostBlock(plan?: HostingPlan): string {
  if (!plan) {
    return "_No HOST ORACLE hosting plan has been generated yet. Run HOST ORACLE against a certified MVP-PDD to populate this section._";
  }
  const lines = [
    `- **Primary host:** ${hostLabel(plan.primary.platform)} · ${plan.primary.score.toFixed(1)}/100`,
    `- **Fallback host:** ${hostLabel(plan.fallback.platform)}`,
    `- **JCSE (Journey Confidence / Self-deploy Estimate):** ${plan.jcse}/100`,
    "",
    "**Hosting requirements profile**",
    "",
    plan.hrp.summary,
    "",
    "**HSE ranking (8-criterion weighted matrix)**",
    "",
    "| # | Host | Weighted total |",
    "|---|---|---|",
    ...plan.hse.map(
      (row, i) =>
        `| ${i + 1} | ${hostLabel(row.platform)} | ${row.weightedTotal.toFixed(1)} |`,
    ),
  ];
  if (plan.journey.phases.length) {
    lines.push(
      "",
      `**Deployment journey · ${plan.journey.tier}**`,
      "",
      ...plan.journey.phases.map(
        (ph, i) => `${i + 1}. **${ph.name}** — ${ph.detail}`,
      ),
    );
  }
  if (plan.sdf.envTemplate.length) {
    lines.push(
      "",
      "**Env template (names only — no values)**",
      "",
      "| Key | Required | Description |",
      "|---|---|---|",
      ...plan.sdf.envTemplate.map(
        (e) =>
          `| \`${e.key}\` | ${e.required ? "yes" : "no"} | ${(e.description || "—").replace(/\|/g, "\\|")} |`,
      ),
    );
  }
  if (plan.notes) {
    lines.push("", "**HOST ORACLE notes**", "", plan.notes);
  }
  return lines.join("\n");
}

/** Markdown build brief combining the VIBE ORACLE and HOST ORACLE recommendations. */
export function buildInstructionsMd(
  vdj?: VdjRecommendation,
  hostPlan?: HostingPlan,
): string {
  return [
    "# BUILD INSTRUCTIONS",
    "",
    DOCTRINE_NOTE,
    "",
    "## VIBE ORACLE — build environment (F6-VDJ)",
    "",
    vdjBlock(vdj),
    "",
    "## HOST ORACLE — hosting plan (F8-HDJ)",
    "",
    hostBlock(hostPlan),
    "",
  ].join("\n");
}

/** Download the BUILD INSTRUCTIONS brief (VIBE ORACLE + HOST ORACLE) as a ZIP. */
export async function exportBuildInstructions(
  sessionId: string,
  vdj?: VdjRecommendation,
  hostPlan?: HostingPlan,
): Promise<void> {
  const files: Record<string, string> = {
    "BUILD_INSTRUCTIONS.md": buildInstructionsMd(vdj, hostPlan),
    "build-instructions.json": JSON.stringify(
      { sessionId, vdj: vdj ?? null, hostPlan: hostPlan ?? null },
      null,
      2,
    ),
  };
  await downloadZip(`build-instructions-${sessionId.slice(0, 8)}.zip`, files);
}
