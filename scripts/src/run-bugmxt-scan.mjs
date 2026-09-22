// BUGMXT SI 5-layer scan, split into 4 phases so each phase fits the bash
// 120-second budget. Phase outputs accumulate in /tmp; the final `assemble`
// step builds docs/BUGMXT_Report_AccountDelete.{md,pdf}.
//
//   node scripts/src/run-bugmxt-scan.mjs phase1
//   node scripts/src/run-bugmxt-scan.mjs phase2
//   node scripts/src/run-bugmxt-scan.mjs phase3
//   node scripts/src/run-bugmxt-scan.mjs phase4
//   node scripts/src/run-bugmxt-scan.mjs assemble
//
// Repeatable "latest change set" mode (the standing quality gate):
//
//   pnpm --filter @workspace/scripts run bugmxt-latest
//   (= node scripts/src/run-bugmxt-scan.mjs all --run=latest)
//
// In --run=latest the run config is built automatically: the diff is
// git diff <last scanned sha>..HEAD (state in docs/bugmxt/.last-scan.json,
// overridable with --base=<sha>), the report lands in
// docs/bugmxt/BUGMXT_Report_<date>_<base>-<head>.{md,pdf}, and past
// false-positive triage notes (docs/bugmxt/TRIAGE_NOTES.md) are injected
// into the prompt so known-good findings aren't re-flagged. The state file
// advances to HEAD only after a successful assemble.

import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
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

// ---- "latest" run support: scan the diff since the last recorded scan ----
const BUGMXT_DIR = resolve(repoRoot, "docs/bugmxt");
const STATE_PATH = resolve(BUGMXT_DIR, ".last-scan.json");
const TRIAGE_NOTES_PATH = resolve(BUGMXT_DIR, "TRIAGE_NOTES.md");

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
}

// Builds a full run config from git state. Deterministic for a given
// base..head range, so per-phase invocations rebuild the identical config.
function buildLatestRun() {
  const baseArg = process.argv.find((a) => a.startsWith("--base="))?.slice("--base=".length);
  let base = baseArg;
  if (!base) {
    if (!existsSync(STATE_PATH)) {
      console.error(
        `No ${STATE_PATH} found and no --base=<sha> given. Seed the state file ` +
          `({"sha":"<last scanned commit>"}) or pass --base once.`
      );
      process.exit(2);
    }
    base = JSON.parse(readFileSync(STATE_PATH, "utf-8")).sha;
  }
  const head = git(["rev-parse", "HEAD"]).trim();
  const baseFull = git(["rev-parse", `${base}^{commit}`]).trim();
  if (baseFull === head) return { upToDate: true, head };

  const shortBase = baseFull.slice(0, 7);
  const shortHead = head.slice(0, 7);
  // Exclude prior BUGMXT reports and agent memory from the scanned diff —
  // scanning our own scan output just produces noise.
  const pathspec = [".", ":(exclude)docs/bugmxt", ":(exclude).agents"];
  const log = git(["log", "--oneline", "--no-decorate", `${baseFull}..${head}`]).trim();
  const stat = git(["diff", "--stat", "--no-renames", `${baseFull}..${head}`, "--", ...pathspec]).trim();
  const diffText = git(["diff", "--no-renames", `${baseFull}..${head}`, "--", ...pathspec]);
  const triage = existsSync(TRIAGE_NOTES_PATH) ? readFileSync(TRIAGE_NOTES_PATH, "utf-8").trim() : "";
  const date = new Date().toISOString().slice(0, 10);
  const stamp = `${date}_${shortBase}-${shortHead}`;

  return {
    upToDate: false,
    head,
    baseFull,
    diffText,
    diffPath: "/tmp/bugmxt_diff-latest.patch",
    mdOut: `docs/bugmxt/BUGMXT_Report_${stamp}.md`,
    pdfOut: `docs/bugmxt/BUGMXT_Report_${stamp}.pdf`,
    targetLine: `ATANDA Command Centre — commits \`${shortBase}..${shortHead}\` (routine change-set scan, ${date})`,
    pdfSubtitle: `5-layer code integrity scan · ATANDA Command Centre · change sets ${shortBase}..${shortHead} · ${date}`,
    pdfTitle: `BUGMXT SI — Bug Triage Report (change sets ${shortBase}..${shortHead})`,
    contextIntro: `Target: the unified git diff below — every commit landed on main since the last BUGMXT scan (\`${shortBase}..${shortHead}\`).

Commits in this change set:
\`\`\`
${log}
\`\`\`

Diffstat:
\`\`\`
${stat}
\`\`\`

Binary entries appear as "Binary files differ" — audit only the code that produces/consumes them.`,
    knownBullets: `- This is a routine repeatable scan of the latest change sets; look for what the authors' self-review missed.
- Stack: pnpm monorepo; Express 5 + Drizzle + Clerk (Replit-managed) + Stripe + Zod (zod/v4 + drizzle-zod), OpenAPI-first contract via Orval; React 18 + Vite + Wouter + TanStack Query + shadcn/ui on the web side; Node 24 ESM/TypeScript 5.9 scripts under scripts/src/.
- App-layer authorisation; no Postgres RLS. Every Drizzle query touching user-owned data MUST filter on req.localUser.id.
- The HARNESS itself is the PDD blueprint that produces SPCs/PDDs — it is NOT itself an SPC. IPDD = human-authored INPUT to the INGESTION ENGINE; PWDD = HARNESS-certified OUTPUT of an ingested session. Never collapse those terms.
${triage ? `
=== TRIAGE NOTES FROM PAST SCANS (verified — do NOT re-flag these as new findings) ===

${triage}

=== END TRIAGE NOTES ===` : ""}`,
    phase2Focus: `Focus on race conditions, error-handling holes, missing tier/auth checks, idempotency gaps, unvalidated inputs, off-by-one and ordering bugs, partial-failure states, and any query on user-owned data missing the owner filter.`,
    pfpFocus: `Cross-reference against the documented operating contract in replit.md and the ATANDA Command Centre MVP PDD intent (subscription portal in front of FORGE.BONSAI HARNESS; HARNESS is a PDD blueprint, not an SPC; tier-gated engines; quest-badge progression). Call out authz bypasses, secret-hygiene violations, copy that mis-states the IPDD/PWDD ontology, and missing audit-log lines on destructive actions.`,
  };
}

// Each scan run is a named config: what the diff contains, what BUGMXT should
// assume, where the layer focus lies, and where the report lands.
const RUNS = {
  "account-delete": {
    mdOut: "docs/BUGMXT_Report_AccountDelete.md",
    pdfOut: "docs/BUGMXT_Report_AccountDelete.pdf",
    targetLine:
      "ATANDA Command Centre — commits `778e73d..169519b` (Engine button glow + HoverCard explainers + ontological-alignment cleanup)",
    pdfSubtitle: "5-layer code integrity scan · ATANDA Command Centre · UX polish + ontology cleanup (778e73d..169519b)",
    pdfTitle: "BUGMXT SI — Bug Triage Report (Account delete + auth hardening)",
    contextIntro: `Target: the unified git diff below. It contains the two most recent change sets in the ATANDA Command Centre codebase: (1) UX polish on the session-detail page — F1–F8 button glow/pulse animation plus HoverCard explainers on every engine button (FeatureNavItem + index.css keyframes + ENGINES explainer fields + isNext computed flag); and (2) a 4-fix ontological-alignment cleanup — restoring the canonical "=== CARTRIDGE CONTEXT (authoritative · do not contradict) ===" fence in cartridge-context.ts, stripping the (AISE_BUILD) suffix from the senior-engineer badge display name, upgrading the JCSE counter chip to a HoverCard that expands "Junglenomics Composite Score Estimate" with all 7 pillars and tier bands, and replacing the static INGESTED·PWDD badge on session-detail with a HoverCard explainer that defines IPDD vs PWDD per the replit.md ontology.`,
    knownBullets: `- This change set was self-reviewed only; no architect pass yet. Look for what self-review MISSED.
- Stack: Express 5 + Drizzle + Clerk (Replit-managed) + Stripe + Zod (zod/v4 + drizzle-zod), OpenAPI-first contract via Orval; React 18 + Vite + Wouter + TanStack Query + shadcn/ui on the web side.
- App-layer authorisation; no Postgres RLS. Every Drizzle query touching user-owned data MUST filter on req.localUser.id.
- The HARNESS itself is the PDD blueprint that produces SPCs/PDDs — it is NOT itself an SPC. IPDD = human-authored INPUT to the INGESTION ENGINE; PWDD = HARNESS-certified OUTPUT of an ingested session. Never collapse those terms.
- HoverCard component lives at artifacts/command-centre/src/components/ui/hover-card.tsx (shadcn wrapper around @radix-ui/react-hover-card). It is the canonical pattern for explainer popovers — title-attribute tooltips are being phased out.`,
    phase2Focus: `Focus on race conditions, error-handling holes, ordering bugs in the Stripe→Clerk→local cascade, edge cases in the strict \`ensureLocalUser\`, missing tier/auth checks, idempotency gaps, and any path where a stale token could survive deletion.`,
    pfpFocus: `Cross-reference against the ATANDA Command Centre MVP PDD intent (subscription portal in front of FORGE.BONSAI HARNESS; HARNESS is a PDD blueprint, not an SPC; tier-gated F5/F6/F7; quest-badge progression). Call out anywhere the implementation drifts from the PDD intent — e.g. authz bypasses, copy that mis-describes the HARNESS as an SPC, missing audit-log lines on destructive actions, anything in the account flow that conflicts with the documented MVP contract.`,
  },
  "guide-github-sync": {
    mdOut: "docs/BUGMXT_Report_GuideMedia_GitHubSync.md",
    pdfOut: "docs/BUGMXT_Report_GuideMedia_GitHubSync.pdf",
    targetLine:
      "ATANDA Command Centre — commits `4b8f27a` (guide-page walkthrough screenshots/GIFs) + `655657e` (automatic GitHub mirror)",
    pdfSubtitle: "5-layer code integrity scan · ATANDA Command Centre · guide media + GitHub auto-sync (4b8f27a, 655657e)",
    pdfTitle: "BUGMXT SI — Bug Triage Report (Guide media + GitHub auto-sync)",
    contextIntro: `Target: the unified git diff below. It contains the two most recent change sets in the ATANDA Command Centre codebase: (1) guide-page walkthrough media — a resumable headless-Chromium capture pipeline (scripts/src/capture-guide-media.mjs) that logs into the staff portal, screenshots each guide step, records short GIFs, and writes them into artifacts/command-centre/public/guide-media/, plus the guide page updates that embed those assets (binary PNG/GIF entries appear as "Binary files differ" — audit only the code that produces/consumes them); and (2) an automatic one-way GitHub mirror — scripts/src/sync-github.ts pushes local main to oluseye4233/ACC-FACTORY@main via the GitHub Data API: it resumes from a "Replit-Commit: <sha>" trailer on the remote head (or an explicit --base=<sha>), parses git diff --no-renames base..HEAD, uploads changed blobs base64 with concurrency 5, builds a tree against base_tree (deletions via sha:null), creates one commit, and PATCHes the branch ref with force:false; on a non-fast-forward HTTP 422 (two syncs racing) it re-reads the remote head and retries exactly once. It is triggered from scripts/post-merge.sh (best-effort) and from an always-on "GitHub Sync" workflow looping every 600 seconds.`,
    knownBullets: `- Both change sets already passed an architect review; look for what BOTH self-review AND the architect pass MISSED.
- Stack: pnpm monorepo, Node 24 ESM scripts under scripts/src/, TypeScript 5.9; the sync script runs via tsx from package.json.
- The GitHub OAuth token comes from the Replit GitHub connector, fetched fresh per run, expires in ~1 hour, and MUST never be logged or written to disk. It lacks the \`workflow\` scope, so any push touching .github/workflows/* is rejected wholesale by GitHub — the sync intentionally excludes those paths from the diff.
- The mirror must NEVER force-push or rewrite remote history; force:false on the ref PATCH is the invariant.
- Two sync entry points can genuinely race: the post-merge hook and the 600-second workflow loop. The loser of the race gets HTTP 422 non-fast-forward.
- The capture pipeline runs against the local dev server through the shared proxy on localhost:80 and authenticates with the shared STAFF_ACCESS_CODE; it must not leak that code into captured files or logs.
- Guide media are static public assets served by Vite from artifacts/command-centre/public/; there is no per-user data in them.`,
    phase2Focus: `Focus on: correctness of the trailer-resume protocol (missing trailer, rewritten local history, --base pointing at the wrong tree); the race/retry path (is one retry sufficient, can the retry itself push a duplicate or skip commits, what happens if the winner synced a DIFFERENT local head); partial-failure states (blobs uploaded but ref never moved, token expiring mid-run); git plumbing edge cases in parseChanges/fileMode (renames disabled, file-mode changes, executable bits, submodules, paths with spaces or quotes, binary files); the post-merge hook's best-effort semantics masking real failures; and in the capture pipeline, login/session handling, secret leakage into logs or captured frames, and resumability leaving stale or half-written media files that the guide page then embeds.`,
    pfpFocus: `Cross-reference against the documented operating contract in replit.md: the mirror is strictly one-way and never force-pushes; .github/workflows/* is excluded because the connector token lacks the workflow scope; connector tokens are short-lived and never logged; the sync runs automatically after merges and on a 10-minute loop so manual invocation is not normally needed. Call out anywhere the implementation or its docs drift from that contract, any secret-hygiene violation, any path that could rewrite or corrupt the GitHub mirror, and any guide-page copy in the diff that mis-states the IPDD/PWDD ontology or describes the HARNESS as an SPC.`,
  },
};

const runSlug = process.argv.find((a) => a.startsWith("--run="))?.slice("--run=".length) ?? "account-delete";
let RUN;
let diff;
if (runSlug === "latest") {
  const latest = buildLatestRun();
  if (latest.upToDate) {
    console.log(`[bugmxt] up to date — HEAD ${latest.head.slice(0, 7)} already scanned; nothing to do.`);
    process.exit(0);
  }
  RUN = latest;
  diff = latest.diffText;
  writeFileSync(latest.diffPath, diff); // for inspection / reproducibility
} else {
  RUN = RUNS[runSlug];
  if (!RUN) {
    console.error(`unknown --run=${runSlug}; known: ${Object.keys(RUNS).join(", ")}, latest`);
    process.exit(2);
  }
  const DIFF_PATH = "/tmp/bugmxt_diff.patch";
  diff = existsSync(DIFF_PATH) ? readFileSync(DIFF_PATH, "utf-8") : "";
}
const MD_OUT = resolve(repoRoot, RUN.mdOut);
const PDF_OUT = resolve(repoRoot, RUN.pdfOut);
const PHASE_DIR = `/tmp/bugmxt-phases-${runSlug}`;
mkdirSync(PHASE_DIR, { recursive: true });
mkdirSync(dirname(MD_OUT), { recursive: true });

const baseUrl = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;

const bugmxtSpc = existsSync(BUGMXT_SPC_PATH) ? readFileSync(BUGMXT_SPC_PATH, "utf-8") : "";

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

const COMMON_CONTEXT = `${RUN.contextIntro}

Context BUGMXT should treat as known:
${RUN.knownBullets}

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
    maxTokens: 4000,
    instructions: `Produce ONLY this section in well-formed markdown:

## Layer 2 — Logic & Outcome Audit
List each finding as a numbered subsection. Each finding must include:
- the [LOGIC-XXX] ID as the subsection heading
- a 1–2 sentence description of the defect
- the file and (where possible) the line / function it lives in
- expected vs actual outcome
- proposed fix pathway (Patch | Refactor | Redesign)

${RUN.phase2Focus} If none, write exactly: \`No logic-layer findings.\`

Cap the layer at the 6 highest-value findings, ordered most severe first. Keep each finding tight (≤120 words) — no rhetorical padding, no restating the diff. You MUST finish the final finding completely.

Begin now.`,
  },
  phase3: {
    maxTokens: 3200,
    instructions: `Produce ONLY these two sections, in this order, in well-formed markdown:

## Layer 3 — HARP (Human + AI Readability)
Bulleted findings with [HARP-AI-XXX] or [HARP-HUMAN-XXX] IDs. Cover: naming clarity, missing JSDoc on cross-cutting helpers, ambiguous error messages surfaced to users, comment/code drift, and anything that would confuse a future agent reading the diff cold. If none, write exactly: \`No HARP-layer findings.\`

## Layer 4 — PFP (PDD Fidelity Protocol)
Findings as bullets with [PFP-DRIFT-XXX] IDs. ${RUN.pfpFocus} If none, write exactly: \`No PFP-layer findings.\`

Cap each layer at the 5 highest-value findings; keep each bullet ≤60 words. You MUST finish both sections completely.

Begin now.`,
  },
  phase4: {
    maxTokens: 3600,
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

Keep prose tight — table rows one line each, triage entries ≤80 words. You MUST finish every section completely, ending with the GRO line.

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
  // Retry 429/5xx with backoff — a 4-phase run fires calls back-to-back and
  // can trip the proxy rate limit; a repeatable check must ride that out.
  const MAX_ATTEMPTS = 4;
  let res;
  for (let attempt = 1; ; attempt++) {
    res = await fetch(`${baseUrl}/v1/messages`, {
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
    if (res.ok) break;
    const body = await res.text();
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= MAX_ATTEMPTS) {
      throw new Error(`Anthropic ${res.status}: ${body}`);
    }
    const retryAfter = Number(res.headers.get("retry-after"));
    const waitS = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 15 * attempt;
    console.log(`[bugmxt:${name}] HTTP ${res.status}; retrying in ${waitS}s (attempt ${attempt}/${MAX_ATTEMPTS})`);
    await new Promise((r) => setTimeout(r, waitS * 1000));
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

**Target:** ${RUN.targetLine}
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
      Title: RUN.pdfTitle,
      Author: "BUGMXT SI v1.0",
      Subject: "5-layer code-integrity scan output",
    },
  });
  const pdfStream = createWriteStream(PDF_OUT);
  // Resolve only when the PDF is fully flushed to disk; reject on either
  // document or stream errors so the scan pointer never advances past a
  // missing/corrupt report.
  const pdfDone = new Promise((resolvePdf, rejectPdf) => {
    pdfStream.on("finish", resolvePdf);
    pdfStream.on("error", rejectPdf);
    doc.on("error", rejectPdf);
  });
  doc.pipe(pdfStream);

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
    .text(RUN.pdfSubtitle);
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
  await pdfDone;
  console.log(`[bugmxt:assemble] wrote ${PDF_OUT}`);

  // Latest mode: advance the scan pointer only after a fully assembled report.
  if (runSlug === "latest") {
    writeFileSync(
      STATE_PATH,
      JSON.stringify({ sha: RUN.head, scannedAt: new Date().toISOString(), report: RUN.mdOut }, null, 2) + "\n"
    );
    console.log(`[bugmxt] state advanced to ${RUN.head.slice(0, 7)} (${STATE_PATH})`);
  }
}

const arg = process.argv[2];
if (!arg) {
  console.error("usage: node scripts/src/run-bugmxt-scan.mjs <phase1|phase2|phase3|phase4|assemble|all> [--run=<slug|latest>] [--base=<sha>]");
  process.exit(2);
}
if (arg === "assemble") {
  await assemble();
} else if (arg === "all") {
  for (const p of ["phase1", "phase2", "phase3", "phase4"]) {
    await runPhase(p);
  }
  await assemble();
} else {
  await runPhase(arg);
}
