import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const files = [
  "ARK_Harness_Upgrade_PDD_v1_0_1792081065810.md",
  "XVL_PDD_v1_1_1792081065811.md",
  "VTE_PDD_v1_0_1792081065810.md",
  "SHORT_SPRINTS_PDD_v1_1_1792081065809.md",
  "IMPRIMA_Upgrade_PDD_v1_1_1792081065811.md",
];
const register = "ARK_Harness_Invariant_Register_v1_0_1792081065806.md";
const promptPattern = /^(?:UPG|XVL|VTE|SS|IMP)-[A-Z]+-\d{3}$/;
const referencePattern = /\b(?:UPG|XVL|VTE|SS|IMP|CD)-[A-Z]+-\d{3}\b/g;
const invariantPattern = /^(?:SP|CELL|MVE|ACM|SPC7|MECHA|CD|XVL|VTE|UPG|SS|IMP|KMB)-\d{2}$/;
const cells = (line) => line.split(/(?<!\\)\|/).slice(1, -1).map((v) => v.trim());

export function parsePrompts(text, source) {
  let header = [];
  const prompts = [];
  for (const [index, line] of text.split("\n").entries()) {
    if (!line.startsWith("|")) continue;
    const row = cells(line);
    if (row[0] === "ID") header = row;
    if (!promptPattern.test(row[0]) || !header.includes("Depends on")) continue;
    const external = row[header.indexOf("External prerequisite")] ?? "";
    const dependencies = row[header.indexOf("Depends on")] ?? "";
    prompts.push({
      id: row[0], instruction: row[1], owner: row[2], priority: row[3],
      dependencies: [...new Set((dependencies + " " + external).match(referencePattern) ?? [])],
      externalPrerequisite: external,
      source, sourceLine: index + 1,
      sourceWave: row.at(-1),
    });
  }
  return prompts;
}

export function sequencePrompts(prompts) {
  const map = new Map();
  for (const prompt of prompts) {
    if (map.has(prompt.id)) throw new Error(`Duplicate atomic prompt: ${prompt.id}`);
    map.set(prompt.id, prompt);
  }
  const visiting = new Set();
  const done = new Map();
  const ordered = [];
  function visit(id) {
    if (visiting.has(id)) throw new Error(`Dependency cycle at ${id}`);
    if (done.has(id)) return done.get(id);
    visiting.add(id);
    const prompt = map.get(id);
    const internal = prompt.dependencies.filter((dep) => map.has(dep));
    const depth = 1 + Math.max(0, ...internal.map(visit));
    visiting.delete(id);
    done.set(id, depth);
    ordered.push({
      ...prompt,
      dependencyDepthLowerBound: depth,
      unavailablePromptReferences: prompt.dependencies.filter((dep) => !map.has(dep)),
    });
    return depth;
  }
  for (const id of map.keys()) visit(id);
  return ordered;
}

export async function buildIndex() {
  const sources = [];
  const prompts = [];
  for (const filename of files) {
    const path = `attached_assets/${filename}`;
    const text = await readFile(resolve(root, path), "utf8");
    const parsed = parsePrompts(text, path);
    if (!parsed.length) throw new Error(`No atomic prompts found in ${path}`);
    sources.push({ path, sha256: createHash("sha256").update(text).digest("hex"), atomicPrompts: parsed.length });
    prompts.push(...parsed);
  }
  const registerPath = `attached_assets/${register}`;
  const text = await readFile(resolve(root, registerPath), "utf8");
  const invariants = text.split("\n").flatMap((line, index) => {
    if (!line.startsWith("|")) return [];
    const row = cells(line);
    if (!invariantPattern.test(row[0])) return [];
    return [{
      id: row[0], source: registerPath, sourceLine: index + 1, sourceCells: row.slice(1),
      sourceStatus: row.some((cell) => cell.includes("Not located")) ? "MISSING_SOURCE" : "SPECIFIED",
    }];
  });
  if (new Set(invariants.map((row) => row.id)).size !== invariants.length) throw new Error("Duplicate invariant IDs");
  const ordered = sequencePrompts(prompts);
  const output = {
    effectiveGovernance: await (async () => {
      const path = "docs/upgrade-program/governance-gap-resolution.json";
      const content = await readFile(resolve(root, path), "utf8");
      const resolution = JSON.parse(content);
      return {
        path, sha256: createHash("sha256").update(content).digest("hex"),
        policyVersion: resolution.policyVersion,
        successorInvariantIds: resolution.successorInvariants.map((row) => row.id),
        historicalSourceStatus: "Original missing-source rows below are preserved, not reconstructed.",
      };
    })(),
    schemaVersion: 1,
    notice: "Source inventory and dependency order only. No implementation, live activation, approval or independent enforcement is asserted. Depth is a lower bound; external prerequisites and policy approvals are additional gates.",
    sources,
    register: { path: registerPath, sha256: createHash("sha256").update(text).digest("hex") },
    historicalOnly: ["SHORT_SPRINTS_PDD_v1_0_1792081065809.md", "XVL_PDD_v1_0_1792081065811.md"],
    invariants,
    prompts: ordered,
    unresolvedPromptReferences: [...new Set(ordered.flatMap((p) => p.unavailablePromptReferences))].sort(),
  };
  await mkdir(resolve(root, "docs/upgrade-program"), { recursive: true });
  await writeFile(resolve(root, "docs/upgrade-program/source-index.json"), JSON.stringify(output, null, 2) + "\n");
  // The source inventory is reproducible; progress is not. Never overwrite
  // accumulated production evidence when re-indexing the PDDs.
  const progress = {
    schemaVersion: 1,
    activityValues: ["ACTIVE", "INACTIVE", "UNVERIFIED"],
    rule: "ACTIVE requires evidence from the published version. INACTIVE requires confirmed absence or disablement. Unchecked, inaccessible or development-only capabilities remain UNVERIFIED. Enforced requires an I1+ passing test recorded in XVL.",
    invariants: invariants.map((row) => ({
      id: row.id,
      liveActivity: "UNVERIFIED",
      enforcement: row.sourceStatus === "MISSING_SOURCE" ? "NOT_ASSESSABLE" : "SPECIFIED",
      deployedVersion: null,
      evidence: [],
    })),
    prompts: ordered.map((row) => ({
      id: row.id, localBuild: "NOT_STARTED", liveActivity: "UNVERIFIED", evidence: [],
    })),
  };
  try {
    await writeFile(resolve(root, "docs/upgrade-program/progress.json"), JSON.stringify(progress, null, 2) + "\n", { flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  console.log(JSON.stringify({
    sources: sources.map(({ path, atomicPrompts }) => ({ path, atomicPrompts })),
    invariants: invariants.length,
    missingInvariantSources: invariants.filter((i) => i.sourceStatus === "MISSING_SOURCE").map((i) => i.id),
    prompts: ordered.length,
    unresolvedPromptReferences: output.unresolvedPromptReferences,
  }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildIndex();
}
