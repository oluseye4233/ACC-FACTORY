import { z } from "zod/v4";
import { artifactOutputHash } from "../command-deck-capture";
import { OperationsError } from "./context";

export const IMPRIMA_FORMATS = ["DOCX", "PDF", "HTML"] as const;
export const IMPRIMA_SOURCE_KINDS = ["F3_MA", "F4_MICRO_PDD", "F5_SPC", "F6_PDD", "F7_MVP_PDD", "F95_LIVING_PDD", "F0_SERVICE", "SPC_PLAYER"] as const;
export const publishRequest = z.object({
  formats: z.array(z.enum(IMPRIMA_FORMATS)).min(1).max(3).refine(v => new Set(v).size === v.length),
  audience: z.enum(["EXECUTIVE", "TECHNICAL", "CLIENT", "PUBLIC"]).default("TECHNICAL"),
  mode: z.enum(["DRAFT", "FINAL"]).default("DRAFT"),
  title: z.string().trim().min(1).max(120),
  project: z.string().trim().min(1).max(60),
  author: z.string().trim().min(2).max(80),
  authorIsHuman: z.literal(true),
  timezone: z.string().max(80).default("America/Chicago").refine(v => { try { new Intl.DateTimeFormat("en", { timeZone: v }).format(); return true; } catch { return false; } }),
  confidentiality: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL"]).default("INTERNAL"),
  provider: z.enum(["claude", "openai", "gemini"]).default("claude"),
  riskDomain: z.enum(["GENERAL", "LEGAL", "FINANCIAL", "HEALTH"]).default("GENERAL"),
  changeNote: z.string().max(1000).default("Initial publication"),
}).strict();
export type PublishConfig = z.infer<typeof publishRequest>;
export type DocumentBlock = { id: string; type: "heading" | "paragraph" | "code"; text: string; protected: boolean };
export type CanonicalDocument = {
  schemaVersion: "IMPRIMA-CDM-1";
  sourceId: string; sourceKind: string; sourceHash: string; config: PublishConfig;
  disclosure: string; blocks: DocumentBlock[];
};
export const hashContent = (value: unknown) => artifactOutputHash(JSON.parse(JSON.stringify(value)));
export function nameToken(value: string, max = 60) {
  const token = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, max).replace(/-$/g, "");
  if (!token) throw new OperationsError(400, "Title, project and author must contain ASCII letters or numbers.");
  return token;
}
export function dateToken(date: Date, timezone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short" }).formatToParts(date).map(p => [p.type, p.value]));
  const zone = parts.timeZoneName!.replace(/\+/g, "PLUS").replace(/-/g, "MINUS").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${zone}`;
}
export function documentFilename(config: PublishConfig, format: typeof IMPRIMA_FORMATS[number], renderedAt: Date, collision = 1) {
  const suffix = collision > 1 ? `-${String(collision).padStart(2, "0")}` : "";
  const tail = `__${dateToken(renderedAt, config.timezone)}__${nameToken(config.project, 45)}__${nameToken(config.author, 55)}__${format}.${format.toLowerCase()}`;
  return `${nameToken(config.title, Math.min(60 - suffix.length, 180 - tail.length - suffix.length))}${suffix}${tail}`;
}
export function sourceSafety(value: unknown, config: PublishConfig) {
  const text = JSON.stringify(value);
  const secrets = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\bsk-(?:proj-|live_|test_)?[A-Za-z0-9_-]{20,}\b|(?:password|api_key|client_secret|access_token)\s*["']?\s*[:=]\s*["'][^"'*\s<]{12,}["']/i.test(text);
  const injection = /ignore (?:all )?(?:previous|prior) instructions|reveal (?:your |the )?(?:system prompt|secret)|exfiltrat(?:e|ion)/i.test(text);
  const sensitive = config.riskDomain !== "GENERAL" || /\b(?:medical diagnosis|legal advice|investment advice|tax advice|patient treatment)\b/i.test(text);
  return { secrets, injection, groState: secrets || injection ? "CONTAINMENT" : sensitive ? "SAFE_LIFE" : "LIFE" };
}
export function normaliseDocument(sourceKind: string, sourceId: string, raw: unknown, config: PublishConfig): CanonicalDocument {
  if (Buffer.byteLength(JSON.stringify(raw), "utf8") > 512_000) throw new OperationsError(413, "This saved source exceeds the 512 KB document limit.");
  const blocks: DocumentBlock[] = [];
  function add(type: DocumentBlock["type"], text: string, protectedValue: boolean) {
    if (blocks.length >= 5000) throw new OperationsError(413, "This source exceeds the 5,000-block document limit.");
    blocks.push({ id: `block-${blocks.length + 1}`, type, text, protected: protectedValue });
  }
  function walk(value: unknown, path: string, depth: number) {
    if (depth > 18) throw new OperationsError(413, "Source nesting is too deep to publish safely.");
    const protectedPath = /prompt|worksheet|contract|code|json|formula|score|never|constraint|(?:^|_)id(?:_|$)/i.test(path);
    if (value !== null && typeof value === "object") {
      if (protectedPath) { add("code", JSON.stringify(value, null, 2), true); return; }
      for (const [key, child] of Object.entries(value)) {
        add("heading", Array.isArray(value) ? `${Number(key) + 1}` : key.replace(/[_-]/g, " "), false);
        walk(child, `${path}.${key}`, depth + 1);
      }
      return;
    }
    const text = typeof value === "string" ? value : JSON.stringify(value);
    if (text === undefined) return;
    const protectedValue = protectedPath || /\d|```|["“”]|[A-Z]{2,}-[A-Z0-9-]+/.test(text);
    add(protectedValue ? "code" : "paragraph", text, protectedValue);
  }
  walk(raw, "", 0);
  if (sourceSafety(raw, config).groState === "SAFE_LIFE") add("paragraph", "NOT PROFESSIONAL ADVICE — This document is not legal, financial or medical advice. A qualified human must review it before reliance.", true);
  if (!blocks.length) throw new OperationsError(400, "The saved source has no publishable content.");
  return { schemaVersion: "IMPRIMA-CDM-1", sourceId, sourceKind, sourceHash: hashContent(raw), config, blocks, disclosure: "AI editorial adapters: KLARITY, SOCRATES and SKRIBE. Human approval is recorded separately. Source certification and compliance are not granted by document publication." };
}
export const clarityResponse = z.object({
  edits: z.array(z.object({ blockId: z.string(), text: z.string().max(12000) }).strict()).max(200),
  clarity: z.number().min(0).max(100),
  summary: z.string().max(3000).nullable(),
  glossary: z.array(z.object({ term: z.string().max(100), definition: z.string().max(500) })).max(30),
}).strict();
export function applyClarity(cdm: CanonicalDocument, response: z.infer<typeof clarityResponse>) {
  const next = structuredClone(cdm);
  const changes: { blockId: string; before: string; after: string }[] = [];
  const seen = new Set<string>();
  for (const edit of response.edits) {
    const block = next.blocks.find(b => b.id === edit.blockId);
    if (!block || block.protected || block.type !== "paragraph" || seen.has(block.id)) throw new OperationsError(409, "KLARITY attempted to edit protected, duplicate or unknown content.", "FIDELITY_FAILURE");
    // Numeric, ID, quoted and code content is never delegated to this adapter.
    if (/\d|```|["“”]|[A-Z]{2,}-[A-Z0-9-]+/.test(edit.text)) throw new OperationsError(409, "KLARITY introduced protected content into an editable span.", "FIDELITY_FAILURE");
    seen.add(block.id);
    changes.push({ blockId: block.id, before: block.text, after: edit.text });
    block.text = edit.text;
  }
  if (response.summary && !cdm.blocks.some(b => /summary/i.test(b.text) && b.type === "heading")) {
    next.blocks.unshift({ id: "editorial-summary", type: "paragraph", text: `EDITORIAL ADDITION — Summary\n${response.summary}`, protected: false });
  }
  if (response.glossary.length && !cdm.blocks.some(b => /glossary/i.test(b.text) && b.type === "heading")) {
    next.blocks.push({ id: "editorial-glossary", type: "paragraph", text: `EDITORIAL ADDITION — Glossary\n${response.glossary.map(g => `${g.term}: ${g.definition}`).join("\n")}`, protected: false });
  }
  const original = cdm.blocks.filter(b => b.protected);
  const preserved = next.blocks.filter(b => b.protected);
  if (hashContent(original) !== hashContent(preserved)) throw new OperationsError(409, "Protected source fidelity failed.", "FIDELITY_FAILURE");
  return { cdm: next, changes };
}
export const interrogationResponse = z.object({
  verdict: z.enum(["CLEAR", "CLEAR_WITH_NOTES", "HOLD"]),
  flags: z.array(z.object({ id: z.string().max(80), claim: z.string().max(1000), question: z.string().max(1000), severity: z.enum(["NOTE", "HIGH", "CRITICAL"]) }).strict()).max(60),
  rationale: z.string().max(4000),
}).strict();
