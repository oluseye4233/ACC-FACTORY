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
    filename: "BUGMXT_SI_SPC_v1_0_1779070949571.md",
  },
  {
    id: "cell-si",
    title: "CELL SI",
    tagline: "8-organelle Molecular Agent doctrine (powers F3)",
    jcse: 45,
    certClass: "GOLD",
    source: "canonical",
    kind: "SPC",
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
    filename: "SPARTAN_SPC_v1_0_1779069054055.md",
  },
  {
    id: "titan-ultra-si",
    title: "TITAN ULTRA SI",
    tagline: "Orchestration archetype for multi-engine pipelines",
    jcse: 48,
    certClass: "PLATINUM",
    source: "canonical",
    kind: "SPC",
    filename: "TITAN_ULTRA_SI_SPC_v1_0_1779069054056.md",
  },
  {
    id: "atanda-cc-mvp-pdd",
    title: "ATANDA Command Centre — MVP ATLAS PDD",
    tagline: "Parent PDD this product was built from",
    jcse: null,
    certClass: null,
    source: "canonical",
    kind: "PDD",
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
