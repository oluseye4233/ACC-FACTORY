import type { GovernanceSelection, GovernanceSelectionModulesItem } from "@workspace/api-client-react";

export const GOVERNANCE_MODULES: GovernanceSelectionModulesItem[] = ["GRO", "ZPOS", "HONESTY_GATE"];
export const DEFAULT_GOVERNANCE_SELECTION: GovernanceSelection = { mode: "FULL", modules: [...GOVERNANCE_MODULES] };

/** Mirrors server rules: FULL = all three; FRAGMENTED = 1 or 2 unique modules. */
export function validateGovernanceSelection(sel: GovernanceSelection): string | null {
  const unique = new Set(sel.modules);
  if (unique.size !== sel.modules.length) return "Duplicate governance modules are not allowed.";
  if (sel.modules.some((m) => !GOVERNANCE_MODULES.includes(m))) return "Unknown governance module.";
  if (sel.mode === "FULL") return sel.modules.length === 3 ? null : "FULL installation requires all three modules.";
  if (sel.modules.length < 1) return "Select at least one module for a fragmented package.";
  if (sel.modules.length > 2) return "Select fewer than three modules or choose FULL.";
  return null;
}

export const isGovernedKind = (kind?: string | null) => kind === "MA" || kind === "SPC";

/** Returns the governance property only for MA/SPC sources; other types are excluded entirely. */
export function governanceForExport(kind: string | null | undefined, sel: GovernanceSelection) {
  if (!isGovernedKind(kind)) return {};
  return { governance: { mode: sel.mode, modules: GOVERNANCE_MODULES.filter((m) => sel.modules.includes(m)) } };
}
