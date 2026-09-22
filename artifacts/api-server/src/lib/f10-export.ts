import { createHash } from "node:crypto";

export const SOURCE_TYPES = ["SPC", "MA_BIRTH_PACKAGE", "MICRO_PDD", "ATLAS_PDD", "ATLAS_PDD_JSON", "MVP_PDD", "CODEBASE_BUNDLE"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];
export const FAMILIES = ["AWS", "AZURE", "OPENAI_AGENTS", "GEMINI_AGENTS", "IDE", "VIBE_APP", "F0", "SPC_PLAYER", "LANGCHAIN", "GITHUB", "PROGRAMMING_ENVIRONMENT"] as const;
export type Family = (typeof FAMILIES)[number];
export const TARGETS = {
  // Provider targets are deliberately closed sets.  A provider name is not a
  // deployment target and accepting arbitrary strings here would make the
  // bundle contract impossible to audit.
  AWS: ["AWS_LAMBDA", "AWS_ECS_FARGATE", "AWS_S3"] as const,
  AZURE: ["AZURE_FUNCTIONS", "AZURE_CONTAINER_APPS", "AZURE_BLOB_STORAGE"] as const,
  OPENAI_AGENTS: ["OPENAI_AGENTS_SDK"] as const,
  GEMINI_AGENTS: ["GEMINI_ADK", "GEMINI_VERTEX_AGENT_ENGINE"] as const,
  IDE: ["VS Code", "Cursor", "Windsurf", "JetBrains", "Replit", "Visual Studio", "Xcode", "Android Studio", "Eclipse", "Vim/Neovim"],
  VIBE_APP: ["Replit Agent", "Lovable", "Bolt", "v0", "Base44"],
  PROGRAMMING_ENVIRONMENT: ["TypeScript/Node", "Python", "Java", "C#", "C++", "Go", "Rust", "PHP", "Ruby", "Swift", "Kotlin"],
} as const;
export const OUTPUT_KINDS = ["SPC", "MA", "MPDD", "PDD", "CODE_DJ"] as const;
export type OutputKind = (typeof OUTPUT_KINDS)[number];
const ALLOWED: Record<OutputKind, readonly SourceType[]> = {
  SPC: ["SPC"], MA: ["MA_BIRTH_PACKAGE"], MPDD: ["MICRO_PDD"],
  PDD: ["ATLAS_PDD", "ATLAS_PDD_JSON", "MVP_PDD"], CODE_DJ: ["CODEBASE_BUNDLE"],
};
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const json = (v: unknown) => Buffer.from(JSON.stringify(v, null, 2) + "\n");
export type OwnedSource = { id: string; type: SourceType; name?: string | null; content: unknown; createdAt?: string | Date };
export type ExportProfile = { outputKind: OutputKind; family: Family; target: string; deliveryMode?: "EXPORT" | "INTERNAL_HANDOFF" };
export type ExportFile = { path: string; mediaType: string; bytes: number; sha256: string; role: string; content: Buffer };
export type ExportResult = { manifest: Record<string, unknown>; files: ExportFile[]; bundle: Buffer };

export function validateProfile(profile: ExportProfile): string | undefined {
  if (!FAMILIES.includes(profile.family)) return "unsupported destination family";
  if (!OUTPUT_KINDS.includes(profile.outputKind) || !ALLOWED[profile.outputKind]) return "unsupported output kind";
  if (profile.family === "PROGRAMMING_ENVIRONMENT" && profile.outputKind !== "CODE_DJ") return "programming environments support CODE_DJ output only";
  if (profile.family === "AWS" && !TARGETS.AWS.includes(profile.target as never)) return "invalid AWS target";
  if (profile.family === "AZURE" && !TARGETS.AZURE.includes(profile.target as never)) return "invalid Azure target";
  if (profile.family === "OPENAI_AGENTS" && !TARGETS.OPENAI_AGENTS.includes(profile.target as never)) return "invalid OpenAI Agents target";
  if (profile.family === "GEMINI_AGENTS" && !TARGETS.GEMINI_AGENTS.includes(profile.target as never)) return "invalid Gemini Agents target";
  if (profile.family === "IDE" && !TARGETS.IDE.includes(profile.target as never)) return "invalid IDE target";
  if (profile.family === "VIBE_APP" && !TARGETS.VIBE_APP.includes(profile.target as never)) return "invalid vibe app target";
  if (profile.family === "PROGRAMMING_ENVIRONMENT" && !TARGETS.PROGRAMMING_ENVIRONMENT.includes(profile.target as never)) return "invalid programming environment target";
  return undefined;
}
export function assertOwnedSource(source: OwnedSource, kind: OutputKind): void {
  if (!source || !SOURCE_TYPES.includes(source.type) || !ALLOWED[kind]?.includes(source.type)) throw new Error("source artifact does not match requested output");
}
function safePath(path: string): string {
  let decoded: string;
  try { decoded = decodeURIComponent(path); } catch { throw new Error("unsafe relative path"); }
  if (path.startsWith("/") || path.startsWith("\\") || /^[A-Za-z]:[\\/]/u.test(path)) throw new Error("unsafe relative path");
  const p = decoded.replaceAll("\\", "/");
  if (!p || p.includes("\0") || p.startsWith("/") || /^[A-Za-z]:\//u.test(p) || p.split("/").some(x => x === ".." || x === "." || x === "")) throw new Error("unsafe relative path");
  return p;
}
function contentBytes(content: unknown): Buffer { return Buffer.isBuffer(content) ? content : typeof content === "string" ? Buffer.from(content) : json(content); }
function extractScaffold(value: unknown): Array<{ path: string; content: Buffer }> {
  if (!value || typeof value !== "object") return [];
  const files = (value as Record<string, unknown>).files;
  if (Array.isArray(files)) return files.map(file => {
    const row = file as Record<string, unknown>;
    if (typeof row.path !== "string" || typeof row.content !== "string") throw new Error("invalid CODE DJ scaffold file");
    return { path: safePath(row.path), content: Buffer.from(row.content) };
  });
  if (!files || typeof files !== "object") return [];
  return Object.entries(files as Record<string, unknown>).map(([path, content]) => ({ path: safePath(path), content: contentBytes(content) }));
}
function media(path: string) { return path.endsWith(".json") ? "application/json" : path.endsWith(".md") ? "text/markdown" : "text/plain"; }

export function buildExport(source: OwnedSource, profile: ExportProfile): ExportResult {
  const err = validateProfile(profile); if (err) throw new Error(err);
  assertOwnedSource(source, profile.outputKind);
  const sourceBytes = contentBytes(source.content);
  const sourceMeta = { id: source.id, type: source.type, name: source.name ?? null, contentSha256: sha(sourceBytes) };
  const files: ExportFile[] = [];
  const add = (path: string, value: Buffer, role: string, mediaType = media(path)) => {
    const clean = safePath(path); if (files.some(f => f.path === clean)) throw new Error("duplicate export path");
    if (files.length >= 500 || files.reduce((n, f) => n + f.bytes, 0) + value.length > 25 * 1024 * 1024) throw new Error("export exceeds file or size limit");
    files.push({ path: clean, mediaType, bytes: value.length, sha256: sha(value), role, content: value });
  };
  const deliveryMode = profile.deliveryMode ?? (profile.family === "F0" || profile.family === "SPC_PLAYER" ? "INTERNAL_HANDOFF" : "EXPORT");
  const manifestBase = { schemaVersion: "f10-export-v1", source: sourceMeta, profile: { ...profile, deliveryMode }, bundleSha256Scope: "zip-final-bytes; embedded manifest uses empty bundleSha256 to avoid circular hashing" };
  add("source/artifact.json", sourceBytes, "source");
  add("source/lineage.json", json({ sourceArtifactId: source.id, sourceType: source.type }), "lineage", "application/json");
  add("README.md", Buffer.from(`# F10 ${profile.outputKind} export\n\nTarget: ${profile.target}\nFamily: ${profile.family}\nDelivery: ${deliveryMode}\n\nThis deterministic export is not a deployment. Review and authorize it in the destination.\n`), "instructions", "text/markdown");
  if (profile.outputKind === "CODE_DJ") for (const file of extractScaffold(source.content)) add(file.path, file.content, "scaffold");
  if (["F0", "SPC_PLAYER"].includes(profile.family)) add("import.json", json({ format: "f10-import-v1", sourceArtifactId: source.id, outputKind: profile.outputKind }), "import", "application/json");
  const starters: Record<Family, [string, string]> = {
    AWS: ["handoff/aws.md", `# AWS native bundle (${profile.target})\n\nThis is a deterministic deployment bundle, not proof of execution. Authenticate to your own AWS account using the configured authorization reference and review the generated plan before applying it. No credential value is included.\n`],
    AZURE: ["handoff/azure.md", `# Azure native bundle (${profile.target})\n\nThis is a deterministic deployment bundle, not proof of execution. Authenticate to your own Azure subscription using the configured authorization reference and review the generated plan before applying it. No credential value is included.\n`],
    OPENAI_AGENTS: ["handoff/openai-agents.md", "# OpenAI Agents native bundle\n\nThis bundle contains agent definitions only. Use your own authorized OpenAI project connection and review before registering an agent. This export does not call OpenAI or prove agent execution.\n"],
    GEMINI_AGENTS: ["handoff/gemini-agents.md", `# Gemini native bundle (${profile.target})\n\nThis bundle contains agent definitions only. Use your own authorized Google Cloud connection and review before registering an agent. This export does not call Gemini or prove agent execution.\n`],
    LANGCHAIN: ["handoff/langchain.md", "# LangChain handoff\n\nInstall dependencies in your own environment and provide provider credentials locally:\n\n    npm install langchain\n"],
    GITHUB: ["handoff/github.md", "# GitHub handoff\n\nAuthorize with your own GitHub account, then review and push explicitly:\n\n    gh auth login\n    gh repo create <OWNER>/<REPO>\n    git push origin <BRANCH>\n\nNo repository is created by this export.\n"],
    IDE: ["handoff/ide.md", `# ${profile.target} handoff\n\nOpen this folder in your own ${profile.target} installation. No IDE session is started by this export.\n`],
    VIBE_APP: ["handoff/vibe-app.md", `# ${profile.target} handoff\n\nImport these reviewed files into your own ${profile.target} workspace. Follow that product's user authorization flow; this export does not upload content.\n`],
    PROGRAMMING_ENVIRONMENT: ["handoff/programming-environment.md", `# ${profile.target} handoff\n\nRun this CODE DJ scaffold in your own ${profile.target} environment after reviewing dependencies and local credentials.\n`],
    F0: ["handoff/f0.md", "This export is an INTERNAL_HANDOFF for F0. Use import.json in your authorized F0 workflow.\n"],
    SPC_PLAYER: ["handoff/spc-player.md", "This export is an INTERNAL_HANDOFF for SPC Player. Use import.json in your authorized player workflow.\n"],
  };
  const [starterPath, starterContent] = starters[profile.family];
  add(starterPath, Buffer.from(starterContent), "profile-instructions", "text/markdown");
  if (["AWS", "AZURE", "OPENAI_AGENTS", "GEMINI_AGENTS"].includes(profile.family)) {
    add("deployment/provider-target.json", json({
      schemaVersion: "f10-provider-target-v1",
      provider: profile.family,
      target: profile.target,
      authorization: { mode: "USER_OWNED_REFERENCE", reference: "configured-destination-authorization-ref" },
      execution: "NOT_PERFORMED",
      acceptance: "Bundle generated; provider acceptance and execution must be confirmed by the provider.",
    }), "provider-target", "application/json");
  }
  add(".env.example", Buffer.from("# Configuration names only; supply values in your destination\nF10_TARGET=\nF10_SOURCE_ID=\n"), "configuration", "text/plain");
  const manifest = { ...manifestBase, files: files.map(({ content: _content, ...f }) => f), bundleSha256: "" };
  const manifestFile = json(manifest);
  add("f10-manifest.json", manifestFile, "manifest", "application/json");
  const ordered = files.slice().sort((a, b) => a.path.localeCompare(b.path));
  const bundle = zip(ordered);
  (manifest as Record<string, unknown>).bundleSha256 = sha(bundle);
  // Replace manifest with its final representation, then rebuild once.
  const mf = files.find(f => f.path === "f10-manifest.json")!;
  const manifestEntries = files.filter(f => f.path !== "f10-manifest.json").map(({ content: _c, ...f }) => f);
  // A manifest cannot hash its own bytes without a circular value. Its own
  // descriptor uses the canonical pre-self representation, making verification
  // stable while still exposing every file in the bundle.
  const selfDescriptor = { path: "f10-manifest.json", mediaType: "application/json", bytes: 0, sha256: sha(json({ ...manifest, files: manifestEntries, bundleSha256: "" })), role: "manifest" };
  let finalManifest = json({ ...manifest, files: [...manifestEntries, selfDescriptor], bundleSha256: "" });
  selfDescriptor.bytes = finalManifest.length;
  finalManifest = json({ ...manifest, files: [...manifestEntries, selfDescriptor], bundleSha256: "" });
  mf.content = finalManifest; mf.bytes = finalManifest.length; mf.sha256 = sha(finalManifest);
  const finalBundle = zip(files.slice().sort((a, b) => a.path.localeCompare(b.path)));
  manifest.files = [...manifestEntries, { ...selfDescriptor, bytes: finalManifest.length, sha256: mf.sha256 }];
  manifest.bundleSha256 = sha(finalBundle);
  return { manifest, files, bundle: finalBundle };
}

// Small store-only ZIP writer: fixed DOS epoch, stable ordering, no platform metadata.
function crc32(buf: Uint8Array) { let c = 0xffffffff; for (const n of buf) { c ^= n; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0); } return (c ^ 0xffffffff) >>> 0; }
function zip(files: ExportFile[]): Buffer {
  const local: Buffer[] = [], central: Buffer[] = []; let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.path); const data = f.content; const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0, 6); head.writeUInt16LE(0, 8);
    head.writeUInt16LE(0, 10); head.writeUInt16LE(0, 12); head.writeUInt32LE(crc32(data), 14); head.writeUInt32LE(data.length, 18); head.writeUInt32LE(data.length, 22); head.writeUInt16LE(name.length, 26);
    local.push(head, name, data); const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0, 8); c.writeUInt16LE(0, 10); c.writeUInt16LE(0, 12); c.writeUInt16LE(33, 14); c.writeUInt32LE(crc32(data), 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(offset, 42); central.push(c, name); offset += head.length + name.length + data.length;
  }
  const body = Buffer.concat(local), dir = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(body.length, 16); return Buffer.concat([body, dir, end]);
}
