import { stringify } from "csv-stringify";
import PDFDocument from "pdfkit";
import type { Writable } from "node:stream";

/**
 * 33-column BI_SPC_ALPHA row shape — matches BI_SPC_ALPHA_CLEAN dataset.
 */
export const BI_SPC_COLUMNS = [
  "spc_id",
  "spc_name",
  "spc_class",
  "spc_origin",
  "session_id",
  "session_name",
  "created_at",
  "feature_id",
  "artifact_type",
  "cert_tier",
  "jcse_score",
  "gro_state",
  "spartan_cert_id",
  "domain",
  "tier_class",
  "atlas_role",
  "atlas_instruction",
  "atlas_example",
  "atlas_constraint",
  "atlas_format",
  "atlas_data",
  "system_prompt",
  "molecular_agents_count",
  "ma_ids",
  "objective",
  "success_criteria",
  "guardrails",
  "outputs",
  "telemetry",
  "owner_user_id",
  "verify_url",
  "source_prompt",
  "notes",
] as const;
export type BiSpcColumn = (typeof BI_SPC_COLUMNS)[number];
export type BiSpcRow = Record<BiSpcColumn, string>;

export interface SpcArtifactLike {
  id: string;
  sessionId: string;
  userId: string;
  featureId: number;
  artifactType: string;
  artifactContent: unknown;
  jcseScore: number | null;
  certTier: string | null;
  groState: string;
  spartanCert: unknown;
  spcOrigin: "artisanal" | "digitally_evolved";
  createdAt: Date | string;
}

export interface SpcExportContext {
  sessionName?: string | null;
  publicBaseUrl?: string | null;
  /** Optional count of MA birth packages in the same session — drives spc_class. */
  maCount?: number;
  maIds?: string[];
  sourcePrompt?: string | null;
}

function s(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function mapSpcToBiRow(art: SpcArtifactLike, ctx: SpcExportContext = {}): BiSpcRow {
  const content = obj(art.artifactContent);
  const cert = obj(art.spartanCert);
  const tuple = obj(content["atomicPrompt"] ?? content["tuple"] ?? content["atlas"]);
  const tierClass =
    art.certTier === "PLATINUM"
      ? "platinum"
      : art.certTier === "GOLD"
        ? "gold"
        : art.certTier === "SILVER"
          ? "silver"
          : art.certTier === "BRONZE"
            ? "bronze"
            : "uncertified";
  const spcClass =
    art.spcOrigin === "digitally_evolved"
      ? "adaptive_multi_agent_tier (digitally_evolving)"
      : "enterprise_tier (artisanal)";
  const verifyUrl =
    typeof cert["certId"] === "string" && ctx.publicBaseUrl
      ? `${ctx.publicBaseUrl.replace(/\/$/, "")}/verify?cert=${encodeURIComponent(String(cert["certId"]))}`
      : "";
  const name =
    s(content["title"]) || s(content["name"]) || s(content["objective"]) || `SPC-${art.id.slice(0, 8)}`;

  return {
    spc_id: art.id,
    spc_name: name,
    spc_class: spcClass,
    spc_origin: art.spcOrigin,
    session_id: art.sessionId,
    session_name: ctx.sessionName ?? "",
    created_at: typeof art.createdAt === "string" ? art.createdAt : art.createdAt.toISOString(),
    feature_id: String(art.featureId),
    artifact_type: art.artifactType,
    cert_tier: art.certTier ?? "",
    jcse_score: art.jcseScore != null ? String(art.jcseScore) : "",
    gro_state: art.groState,
    spartan_cert_id: s(cert["certId"]),
    domain: s(content["domain"]),
    tier_class: tierClass,
    atlas_role: s(tuple["role"]),
    atlas_instruction: s(tuple["instruction"]),
    atlas_example: s(tuple["example"]),
    atlas_constraint: s(tuple["constraint"]),
    atlas_format: s(tuple["format"]),
    atlas_data: s(tuple["data"]),
    system_prompt: s(tuple["system"]) || s(content["systemPrompt"]),
    molecular_agents_count: ctx.maCount != null ? String(ctx.maCount) : "",
    ma_ids: (ctx.maIds ?? []).join("|"),
    objective: s(content["objective"]),
    success_criteria: s(content["successCriteria"] ?? content["acceptance"]),
    guardrails: s(content["guardrails"] ?? content["constraints"]),
    outputs: s(content["outputs"] ?? content["deliverables"]),
    telemetry: s(content["telemetry"] ?? content["metrics"]),
    owner_user_id: art.userId,
    verify_url: verifyUrl,
    source_prompt: ctx.sourcePrompt ?? "",
    notes: s(content["notes"]),
  };
}

export async function writeSpcCsv(rows: BiSpcRow[], out: Writable): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const stringifier = stringify({
      header: true,
      columns: BI_SPC_COLUMNS.map((c) => ({ key: c, header: c })),
    });
    stringifier.on("error", reject);
    out.on("error", reject);
    out.on("finish", resolve);
    stringifier.pipe(out);
    for (const row of rows) stringifier.write(row);
    stringifier.end();
  });
}

export async function writeSpcPdf(rows: BiSpcRow[], out: Writable): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: "LETTER" });
    out.on("error", reject);
    out.on("finish", resolve);
    doc.on("error", reject);
    doc.pipe(out);

    doc.font("Helvetica-Bold").fontSize(18).text("SPC EXPORT — BI_SPC_ALPHA");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(9).fillColor("#666").text(
      `Generated ${new Date().toISOString()} · ${rows.length} record${rows.length === 1 ? "" : "s"}`,
    );
    doc.fillColor("#000");
    doc.moveDown();

    if (rows.length === 0) {
      doc.fontSize(11).text("No SPC artifacts found.");
    }

    rows.forEach((row, i) => {
      if (i > 0) doc.addPage();
      doc.font("Helvetica-Bold").fontSize(14).text(row.spc_name);
      doc.font("Helvetica").fontSize(9).fillColor("#666").text(
        `${row.spc_class} · ${row.cert_tier || "uncertified"} · JCSE ${row.jcse_score || "—"} · ${row.spc_id}`,
      );
      doc.fillColor("#000").moveDown(0.5);

      for (const col of BI_SPC_COLUMNS) {
        const val = row[col];
        if (!val) continue;
        doc.font("Helvetica-Bold").fontSize(8).text(col.toUpperCase(), { continued: false });
        doc.font("Helvetica").fontSize(10).text(val.length > 1200 ? val.slice(0, 1200) + "…" : val);
        doc.moveDown(0.25);
      }
    });

    doc.end();
  });
}
