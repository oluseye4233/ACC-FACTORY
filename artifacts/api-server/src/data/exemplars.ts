import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export type ExemplarSummary = {
  id: string;
  title: string;
  tagline: string;
  jcse: number | null;
  certClass: string | null;
  source: "canonical" | "hand_authored" | "generated";
  kind: "SPC" | "PDD";
  /**
   * DISC personality profile (Dominance / Influence / Steadiness / Conscientiousness).
   * Every SPC has a unique DISC fingerprint that shapes how its persona behaves under load.
   * PDDs do not carry a DISC — they describe products, not personas.
   */
  disc: string | null;
};

export type Exemplar = ExemplarSummary & {
  body: string;
};

type Entry = ExemplarSummary & { filename: string };

const ENTRIES: Entry[] = [
  {
    id: "sphinx-ultra-si",
    title: "SPHINX ULTRA SI",
    tagline: "Omnipresent AI Agent Marketplace & Ecosystem Platform",
    jcse: 50,
    certClass: "PLATINUM",
    source: "canonical",
    kind: "SPC",
    disc: "DCI — Dominance + Conscientiousness + Influence (Command + Precision + Engagement)",
    filename: "SPHINX_ULTRA_SI_SPC_1779084545997.md",
  },
  {
    id: "bugmxt-si",
    title: "BUGMXT SI",
    tagline: "Canonical 15-section SPC exemplar",
    jcse: 46,
    certClass: "PLATINUM",
    source: "canonical",
    kind: "SPC",
    disc: "CD — Conscientiousness + Dominance (Precise, systematic, direct)",
    filename: "BUGMXT_SI_SPC_v1_0_1779070949571.md",
  },
  {
    id: "cell-si",
    title: "CELL SI",
    tagline: "8-organelle Micro Agent (MA) doctrine (powers F3)",
    jcse: 45,
    certClass: "GOLD",
    source: "canonical",
    kind: "SPC",
    disc: "CS — Conscientiousness (primary) + Steadiness (secondary)",
    filename: "CELL_SI_SPC_v1_0_1779068654240.md",
  },
  {
    id: "spartan",
    title: "SPARTAN",
    tagline: "Semantic Compression Matrix doctrine (powers F7)",
    jcse: 47,
    certClass: "PLATINUM",
    source: "canonical",
    kind: "SPC",
    disc: "DC — Dominance + Conscientiousness (Decisive compression with audit-grade rigour)",
    filename: "SPARTAN_SPC_v1_0_1779069054055.md",
  },
  {
    id: "vibe-spc",
    title: "VIBE SPC",
    tagline: "Dual-mode tool selector + multi-tool conductor (powers F6-VDJ)",
    jcse: 50,
    certClass: "PLATINUM",
    source: "canonical",
    kind: "SPC",
    disc: "DCI Hybrid — Dominance + Conscientiousness + Influence (Decisive architecture, systematic precision, rallying coordination)",
    filename: "VIBE_SPC_v1_0_1779154734288.md",
  },
  {
    id: "atlas-ultra-si",
    title: "ATLAS ULTRA SI",
    tagline: "PromptWare Design Document architect (powers F6)",
    jcse: 50,
    certClass: "PLATINUM",
    source: "canonical",
    kind: "SPC",
    disc: "C-Primary + D-Secondary — Conscientiousness + Dominance (Precision-led, Results-driven)",
    filename: "ATLAS_ULTRA_SI_SPC_v1.0_1779146869478.md",
  },
  {
    id: "titan-ultra-si",
    title: "TITAN ULTRA SI",
    tagline: "Orchestration archetype for multi-engine pipelines",
    jcse: 48,
    certClass: "PLATINUM",
    source: "canonical",
    kind: "SPC",
    disc: "DI — Dominance + Influence (Decisive market conquest with persuasive relationship building)",
    filename: "TITAN_ULTRA_SI_SPC_v1_0_1779069054056.md",
  },
  {
    id: "code-dj",
    title: "CODE ORACLE",
    tagline:
      "Code Distribution Junction — PromptWare-to-codebase conversion doctrine (powers F8 Code ORACLE)",
    jcse: 50,
    certClass: "PLATINUM",
    source: "canonical",
    kind: "SPC",
    disc: "DC — Dominance + Conscientiousness (Decisive code allocation with systematic precision)",
    filename: "CODE_DJ_SPC_v1_0_1779539676204.md",
  },
  {
    id: "gamemxt-ultra-si",
    title: "GAMEMXT ULTRA SI",
    tagline:
      "The Engagement Sovereign — dual-track gamification + training/mentorship architect for any SPC or BOK",
    jcse: 49,
    certClass: "PLATINUM",
    source: "canonical",
    kind: "SPC",
    disc: "ID — Influence + Dominance (Engagement-led architect, decisive game design)",
    filename: "GAMEMXT_ULTRA_SI_SPC_v1_0_1779538911328.md",
  },
  {
    id: "atanda-cc-mvp-pdd",
    title: "ATANDA Command Centre — MVP ATLAS PDD",
    tagline: "Parent PDD this product was built from",
    jcse: null,
    certClass: null,
    source: "canonical",
    kind: "PDD",
    disc: null,
    filename: "ATANDA_COMMAND_CENTRE_MVP_ATLAS_PDD_1779068119890.md",
  },
  {
    id: "atanda-command-centre",
    title: "ATANDA Command Centre",
    tagline: "Operator portal in front of the 8-engine FORGE.BONSAI HARNESS",
    jcse: 44,
    certClass: "GOLD",
    source: "hand_authored",
    kind: "SPC",
    disc: "SC — Steadiness + Conscientiousness (Calm, reliable, schema-disciplined)",
    filename: "ATANDA_COMMAND_CENTRE_SPC_v1.md",
  },
];

function findAssetsDir(): string {
  const candidates: string[] = [];
  if (typeof __dirname === "string") candidates.push(__dirname);
  candidates.push(process.cwd());
  for (const start of candidates) {
    let dir = resolve(start);
    for (let i = 0; i < 8; i++) {
      const probe = join(dir, "attached_assets");
      if (existsSync(probe)) return probe;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return join(process.cwd(), "attached_assets");
}

const ASSETS_DIR = findAssetsDir();

const bodyCache = new Map<string, string>();
function loadBody(filename: string): string | null {
  if (bodyCache.has(filename)) return bodyCache.get(filename)!;
  try {
    const body = readFileSync(join(ASSETS_DIR, filename), "utf-8");
    bodyCache.set(filename, body);
    return body;
  } catch {
    return null;
  }
}

export function listExemplars(): ExemplarSummary[] {
  return ENTRIES.map(({ filename: _f, ...summary }) => summary);
}

export function getExemplar(id: string): Exemplar | null {
  const entry = ENTRIES.find((e) => e.id === id);
  if (!entry) return null;
  const body = loadBody(entry.filename);
  if (body === null) return null;
  const { filename: _f, ...summary } = entry;
  return { ...summary, body };
}
