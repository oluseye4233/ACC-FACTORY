import type { AutoCommandInput } from "./intake";

export const AUTO_COMMAND_PLAN_VERSION = 1;
type Stage = { key: string; title: string };
/** Applicable stages only; no invented completion of skipped product branches. */
export function autoCommandPlan(packageType: AutoCommandInput["packageType"]): Stage[] {
  const common = [
    { key: "F1", title: "Validate and freeze intake" },
    { key: "F0", title: "Editable business-document draft" },
    { key: "F2", title: "Governed requirements" },
  ];
  const branch: Stage[] = packageType === "BASIC_AGENT" ? [
    { key: "F3", title: "MA specification" },
    { key: "F4", title: "Micro PDD" },
  ] : [
    { key: "F3", title: "Capability design" },
    { key: "F4", title: "Specification design" },
    { key: "F5", title: "Advanced SPC specification" },
    { key: "SPC_CHEAT_SHEET", title: "SPC identity, lineage and colonization cheat sheet" },
    ...(packageType === "WEB_APPLICATION" ? [
      { key: "F6", title: "PDD" },
      { key: "F7", title: "MVP PDD" },
    ] : []),
  ];
  return [...common, ...branch, { key: "F8", title: "Implementation-path guidance (not deployed code)" }];
}
