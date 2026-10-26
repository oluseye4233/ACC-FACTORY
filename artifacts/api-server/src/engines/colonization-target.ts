import { z } from "zod/v4";
import { FAMILIES, TARGETS } from "../lib/f10-export";

// Planning preference only. F10 still requires its own qualification, consent,
// target identity, adapter and independent release checks.
export const COLONIZATION_TARGETS = ["UNDECIDED", ...FAMILIES.flatMap(family =>
  (family in TARGETS ? TARGETS[family as keyof typeof TARGETS] : [family])
    .map(target => `${family}::${target}`),
)];
export const ColonizationTargetSchema = z.enum(COLONIZATION_TARGETS as [string, ...string[]]);
export type ColonizationTarget = z.infer<typeof ColonizationTargetSchema>;

export function colonizationContext(target: ColonizationTarget): string {
  return `Requested future F10 colonization target: ${target}. This is a planning preference, not an F10 approval, adapter, credential, deployment or governance waiver. Preserve GRO, ZPOS and Honesty Gate; any target packaging requires later SAVANT review and F10/F11 gates.`;
}
