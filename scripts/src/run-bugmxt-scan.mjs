// BUGMXT SI 5-layer scan, split into 4 phases so each phase fits the bash
// 120-second budget. Phase outputs accumulate in /tmp; the final `assemble`
// step builds docs/BUGMXT_Report_AccountDelete.{md,pdf}.
//
//   node scripts/src/run-bugmxt-scan.mjs phase1
//   node scripts/src/run-bugmxt-scan.mjs phase2
//   node scripts/src/run-bugmxt-scan.mjs phase3
//   node scripts/src/run-bugmxt-scan.mjs phase4
//   node scripts/src/run-bugmxt-scan.mjs assemble

import { createRequire } from "node:module";
import { mkdirSync, existsSync, createWriteStream, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");

const exportRequire = createRequire(resolve(repoRoot, "lib/export/package.json"));
const PDFDocument = exportRequire("pdfkit");

// Must match the filename registered in artifacts/api-server/src/data/exemplars.ts
// so the scan uses the same canonical body that is served as the `bugmxt-si` exemplar.
const BUGMXT_SPC_PATH = resolve(repoRoot, "attached_assets/BUGMXT_SI_SPC_v1_0_1779070949571.md");
const DIFF_PATH = "/tmp/bugmxt_diff.patch";
const MD_OUT = resolve(repoRoot, "docs/BUGMXT_Report_AccountDelete.md");
const PDF_OUT = resolve(repoRoot, "docs/BUGMXT_Report_AccountDelete.pdf");
const PHASE_DIR = "/tmp/bugmxt-phases";
mkdirSync(PHASE_DIR, { recursive: true });
mkdirSync(dirname(MD_OUT), { recursive: true });

const baseUrl = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;

const bugmxtSpc = existsSync(BUGMXT_SPC_PATH) ? readFileSync(BUGMXT_SPC_PATH, "utf-8") : "";
const diff = existsSync(DIFF_PATH) ? readFileSync(DIFF_PATH, "utf-8") : "";

const SYSTEM_BASE = `You are BUGMXT SI, the Bug Matrix Extraction & Triage Engine described in the SPC below.

Operate strictly as specified. Use the canonical output formats from the SPC.

Hard rules:
- Never alter source code; produce diff-ready recommendations only.
- Use exact issue-ID format ([SYNTAX-001], [LOGIC-007], [HARP-AI-003], [PFP-DRIFT-012], [EAL-PRI-001]).
- Score each issue against the EAL scoring matrix when scoring is requested.
- If a layer finds nothing, say so explicitly — do not invent issues.
- Be honest about confidence. If a referenced helper is not in the diff, say so rather than guess.
- Output ONLY the markdown for the requested sections. No preamble, no closing remarks.

=== BUGMXT SI SPC v1.0 (verbatim) ===

${bugmxtSpc}

=== END SPC ===`;

const COMMON_CONTEXT = `Target: the unified git diff below. It contains the most recent change set in the ATANDA Command Centre codebase — a new /account page (profile edit, data export, hard delete), tightened account-deletion flow (Stripe pre-cancel → Clerk delete → local cascade), and a strict-mode rewrite of \`ensureLocalUser\` so a stale token cannot JIT-recreate a shell user after Clerk-side deletion.

Context BUGMXT should treat as known:
- This change set has already passed three rounds of architect review; look for what architect MISSED.
- Stack: Express 5 + Drizzle + Clerk (Replit-managed) + Stripe + Zod (zod/v4 + drizzle-zod), OpenAPI-first contract via Orval.
- App-layer authorisation; no Postgres RLS. Every Drizzle query touching user-owned data MUST filter on req.localUser.id.
- The HARNESS itself is the PDD blueprint that produces SPCs/PDDs — it is NOT itself an SPC.

=== UNIFIED DIFF ===

\`\`\`diff
${diff}
\`\`\`

=== END DIFF ===`;

const PHASES = {
  phase1: {
    maxTokens: 1500,
    instructions: `Produce ONLY these two sections, in this order, in well-formed markdown:

## Executive Summary
3–5 lines, plain English. Headline finding + posture.

## Layer 1 — Syntax Sweep
List each finding as a bullet beginning with the [SYNTAX-XXX] ID. If none, write exactly: \`No syntax-layer findings.\`

Begin now.`,
  },
  phase2: {
    maxTokens: 1800,
    instructions: `Produce ONLY this section in well-formed markdown:

## Layer 2 — Logic & Outcome Audit
List each finding as a numbered subsection. Each finding must include:
- the [LOGIC-XXX] ID as the subsection heading
- a 1–2 sentence description of the defect
- the file and (where possible) the line / function it lives in
- expected vs actual outcome
- proposed fix pathway (Patch | Refactor | Redesign)

Focus on race conditions, error-handling holes, ordering bugs in the Stripe→Clerk→local cascade, edge cases in the strict \`ensureLocalUser\`, missing tier/auth checks, idempotency gaps, and any path where a stale token could survive deletion. If none, write exactly: \`No logic-layer findings.\`

Begin now.`,
  },
  phase3: {
    maxTokens: 1800,
    instructions: `Produce ONLY these two sections, in this order, in well-formed markdown:

## Layer 3 — HARP (Human + AI Readability)
Bulleted findings with [HARP-AI-XXX] or [HARP-HUMAN-XXX] IDs. Cover: naming clarity, missing JSDoc on cross-cutting helpers, ambiguous error messages surfaced to users, comment/code drift, and anything that would confuse a future agent reading the diff cold. If none, write exactly: \`No HARP-layer findings.\`

## Layer 4 — PFP (PDD Fidelity Protocol)
Cross-reference against the ATANDA Command Centre MVP PDD intent (subscription portal in front of FORGE.BONSAI HARNESS; HARNESS is a PDD blueprint, not an SPC; tier-gated F5/F6/F7; quest-badge progression). Findings as bullets with [PFP-DRIFT-XXX] IDs. Call out anywhere the implementation drifts from the PDD intent — e.g. authz bypasses, copy that mis-describes the HARNESS as an SPC, missing audit-log lines on destructive actions, anything in the account flow that conflicts with the documented MVP contract. If none, write exactly: \`No PFP-layer findings.\`

Begin now.`,
  },
  phase4: {
    maxTokens: 2000,
    instructions: `Produce ONLY these final sections, in this order, in well-formed markdown:

## Layer 5 — EAL Bayesian Triage
A single markdown table with columns: \`ID | Layer | Severity (1–5) | Likelihood (1–5) | Blast Radius (1–5) | Detectability (1–5) | EAL Score | Priority\`. Include EVERY issue surfaced in Layers 1–4 (carry the IDs forward). Sort descending by EAL Score. Priority must be one of CRITICAL / HIGH / MEDIUM / LOW per the SPC matrix.

## Bug Triage Board
Top 3 CRITICAL/HIGH items as numbered entries. For each: \`Severity\`, \`Blast Radius\`, \`Estimated Fix Time\`, \`Fix Pathway\` (Patch | Refactor | Redesign), \`Regression Risk\`, and a 1–2 sentence \`Why this matters\`.

## What architect review MISSED
1–3 items max, OR write exactly: \`Nothing material — architect coverage was complete.\` Be specific: cite the issue ID and the precise gap.

## GRO Operating State at end of scan
One line in the form \`<LIFE ZONE | ADVISORY MODE | HUMAN_ESCALATION> — <one-sentence justification>\`.

Assume the layer findings already produced are the inputs. If you must invent placeholder IDs because earlier phases are not in your context, prefix them with \`PROVISIONAL-\` and note this in a one-line italicised disclaimer at the top of Layer 5.

Begin now.`,
  },
};

async function runPhase(name) {
  const spec = PHASES[name];
  if (!spec) throw new Error(`Unknown phase ${name}`);
  if (!baseUrl || !apiKey) throw new Error("AI_INTEGRATIONS_ANTHROPIC_BASE_URL/API_KEY missing");

  // Fresh state on phase1 so a half-finished prior run can't poison `assemble`.
  if (name === "phase1") {
    rmSync(PHASE_DIR, { recursive: true, force: true });
    mkdirSync(PHASE_DIR, { recursive: true });
  }

  let prevContext = "";
  if (name === "phase4") {
    const carry = ["phase1", "phase2", "phase3"]
      .map((p) => {
        const fp = resolve(PHASE_DIR, `${p}.md`);
        return existsSync(fp) ? readFileSync(fp, "utf-8") : "";
      })
      .filter(Boolean)
      .join("\n\n");
    if (carry) {
      prevContext = `\n\n=== PRIOR LAYER FINDINGS (carry IDs forward) ===\n\n${carry}\n\n=== END PRIOR FINDINGS ===\n`;
    }
  }

  const userPrompt = `Activation: "BUGMXT — activate Code Integrity Mode. Apply the requested layers."\n\n${COMMON_CONTEXT}${prevContext}\n\n${spec.instructions}`;

  console.log(`[bugmxt:${name}] sys=${SYSTEM_BASE.length} user=${userPrompt.length} max_tokens=${spec.maxTokens}`);
  const t0 = Date.now();
  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: spec.maxTokens,
      system: SYSTEM_BASE,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic ${res.status}: ${body}`);
  }
  const data = await res.json();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const text = (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const meta = {
    elapsed,
    input_tokens: data.usage?.input_tokens ?? 0,
    output_tokens: data.usage?.output_tokens ?? 0,
    stop: data.stop_reason,
  };
  writeFileSync(resolve(PHASE_DIR, `${name}.md`), text);
  writeFileSync(resolve(PHASE_DIR, `${name}.meta.json`), JSON.stringify(meta, null, 2));
  console.log(`[bugmxt:${name}] done in ${elapsed}s · in=${meta.input_tokens} out=${meta.output_tokens} stop=${meta.stop} · ${text.length} chars`);
}

async function assemble() {
  const parts = ["phase1", "phase2", "phase3", "phase4"].map((p) => {
    const fp = resolve(PHASE_DIR, `${p}.md`);
    if (!existsSync(fp)) throw new Error(`Missing phase file ${fp}; run phase first`);
    return readFileSync(fp, "utf-8");
  });
  const metas = ["phase1", "phase2", "phase3", "phase4"].map((p) => {
    const fp = resolve(PHASE_DIR, `${p}.meta.json`);
    return existsSync(fp) ? JSON.parse(readFileSync(fp, "utf-8")) : { elapsed: "?", input_tokens: 0, output_tokens: 0 };
  });
  const totalIn = metas.reduce((s, m) => s + (m.input_tokens || 0), 0);
  const totalOut = metas.reduce((s, m) => s + (m.output_tokens || 0), 0);
  const totalElapsed = metas.reduce((s, m) => s + parseFloat(m.elapsed || "0"), 0).toFixed(1);

  const header = `# BUGMXT SI — Bug Triage Report

**Target:** ATANDA Command Centre — commit \`ffc9d3e\` (Account management + auth-safety hardening)
**Engine:** BUGMXT SI v1.0 (JCSE 46 / Platinum)
**Model:** claude-sonnet-4-6 (4-phase scan)
**Scan duration:** ${totalElapsed}s total
**Tokens:** ${totalIn} in / ${totalOut} out
**Generated:** ${new Date().toISOString()}

---

`;
  const body = parts.join("\n\n");
  writeFileSync(MD_OUT, header + body);
  console.log(`[bugmxt:assemble] wrote ${MD_OUT} (${(header + body).length} chars)`);

  // ---- PDF rendering ----
  const NAVY = "#0b1d3a";
  const ACCENT = "#1f7a8c";
  const GREY = "#374151";
  const SOFT_GREY = "#6b7280";
  const CODE_BG = "#f4f4f5";
  const RULE = "#d1d5db";

  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
    info: {
      Title: "BUGMXT SI — Bug Triage Report (Account delete + auth hardening)",
      Author: "BUGMXT SI v1.0",
      Subject: "5-layer code-integrity scan output",
    },
  });
  doc.pipe(createWriteStream(PDF_OUT));

  function hr() {
    const y = doc.y + 4;
    doc.save().strokeColor(RULE).lineWidth(0.5)
      .moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke().restore();
    doc.moveDown(0.6);
  }

  function inlineFormatted(text, baseColor, font, size) {
    const segments = [];
    const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
    let last = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) segments.push({ kind: "plain", text: text.slice(last, m.index) });
      const tok = m[0];
      if (tok.startsWith("**")) segments.push({ kind: "bold", text: tok.slice(2, -2) });
      else if (tok.startsWith("`")) segments.push({ kind: "code", text: tok.slice(1, -1) });
      else segments.push({ kind: "italic", text: tok.slice(1, -1) });
      last = m.index + tok.length;
    }
    if (last < text.length) segments.push({ kind: "plain", text: text.slice(last) });

    segments.forEach((s, i) => {
      const isLast = i === segments.length - 1;
      let useFont = font;
      let useColor = baseColor;
      if (s.kind === "bold") useFont = "Helvetica-Bold";
      else if (s.kind === "italic") useFont = "Helvetica-Oblique";
      else if (s.kind === "code") { useFont = "Courier"; useColor = NAVY; }
      doc.fillColor(useColor).font(useFont).fontSize(size).text(s.text, { continued: !isLast, lineGap: 2 });
    });
  }

  function renderMarkdown(md) {
    const lines = md.split("\n");
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (/^```/.test(line)) {
        i++;
        const codeLines = [];
        while (i < lines.length && !/^```/.test(lines[i])) { codeLines.push(lines[i]); i++; }
        i++;
        const x = doc.page.margins.left;
        const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        doc.font("Courier").fontSize(9).fillColor(NAVY);
        const padded = codeLines.join("\n");
        const h = doc.heightOfString(padded, { width: w - 16, lineGap: 1 });
        // Force a fresh page if this block won't fit on the current one.
        if (doc.y + h + 14 > doc.page.height - doc.page.margins.bottom) doc.addPage();
        const startY = doc.y;
        doc.save().fillColor(CODE_BG).rect(x, startY, w, h + 14).fill().restore();
        doc.fillColor(NAVY).font("Courier").fontSize(9).text(padded, x + 8, startY + 7, { width: w - 16, lineGap: 1 });
        doc.moveDown(0.6);
        continue;
      }
      if (/^---+\s*$/.test(line)) { hr(); i++; continue; }
      const h1 = /^#\s+(.*)$/.exec(line);
      const h2 = /^##\s+(.*)$/.exec(line);
      const h3 = /^###\s+(.*)$/.exec(line);
      const h4 = /^####\s+(.*)$/.exec(line);
      if (h1) { doc.moveDown(0.3); doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(20).text(h1[1]); doc.moveDown(0.2); i++; continue; }
      if (h2) { doc.moveDown(0.3); doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(15).text(h2[1]); doc.moveDown(0.15); i++; continue; }
      if (h3) { doc.moveDown(0.2); doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(12).text(h3[1]); doc.moveDown(0.1); i++; continue; }
      if (h4) { doc.moveDown(0.15); doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(11).text(h4[1]); doc.moveDown(0.1); i++; continue; }
      if (/^\|/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1])) {
        const tbl = [];
        while (i < lines.length && /^\|/.test(lines[i])) { tbl.push(lines[i]); i++; }
        const x = doc.page.margins.left;
        const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const txt = tbl.join("\n");
        doc.font("Courier").fontSize(8);
        const h = doc.heightOfString(txt, { width: w - 16, lineGap: 1 });
        if (doc.y + h + 14 > doc.page.height - doc.page.margins.bottom) doc.addPage();
        const startY = doc.y;
        doc.save().fillColor(CODE_BG).rect(x, startY, w, h + 14).fill().restore();
        doc.fillColor(NAVY).font("Courier").fontSize(8).text(txt, x + 8, startY + 7, { width: w - 16, lineGap: 1 });
        doc.moveDown(0.6);
        continue;
      }
      const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
      if (bullet) {
        doc.fillColor(GREY).font("Helvetica").fontSize(10).text("•  ", { continued: true, indent: 6 });
        inlineFormatted(bullet[1], GREY, "Helvetica", 10);
        doc.moveDown(0.15);
        i++; continue;
      }
      const numbered = /^\s*(\d+)\.\s+(.*)$/.exec(line);
      if (numbered) {
        doc.fillColor(GREY).font("Helvetica").fontSize(10).text(`${numbered[1]}.  `, { continued: true, indent: 6 });
        inlineFormatted(numbered[2], GREY, "Helvetica", 10);
        doc.moveDown(0.15);
        i++; continue;
      }
      if (line.trim() === "") { doc.moveDown(0.35); i++; continue; }
      inlineFormatted(line, GREY, "Helvetica", 10);
      doc.moveDown(0.3);
      i++;
    }
  }

  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(26).text("BUGMXT SI");
  doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(14).text("Bug Triage Report");
  doc.moveDown(0.4);
  doc.fillColor(SOFT_GREY).font("Helvetica-Oblique").fontSize(10)
    .text("5-layer code integrity scan · ATANDA Command Centre · Account-management commit ffc9d3e");
  doc.moveDown(0.8);
  hr();

  renderMarkdown(header + body);

  doc.moveDown(1);
  hr();
  doc.fillColor(SOFT_GREY).font("Helvetica-Oblique").fontSize(8).text(
    `Generated ${new Date().toISOString()} · BUGMXT SI v1.0 · claude-sonnet-4-6 · ${totalIn}/${totalOut} tokens · ${totalElapsed}s total (4 phases)`,
    { align: "center" }
  );

  doc.end();
  console.log(`[bugmxt:assemble] wrote ${PDF_OUT}`);
}

const arg = process.argv[2];
if (!arg) {
  console.error("usage: node scripts/src/run-bugmxt-scan.mjs <phase1|phase2|phase3|phase4|assemble>");
  process.exit(2);
}
if (arg === "assemble") {
  await assemble();
} else {
  await runPhase(arg);
}
