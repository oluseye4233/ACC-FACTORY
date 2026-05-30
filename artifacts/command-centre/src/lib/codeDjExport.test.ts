import { describe, it, expect } from "vitest";
import type {
  CodebaseBundle,
  HarnessArtifact,
  PfpReport,
} from "@workspace/api-client-react";
import {
  buildAgentsMd,
  buildExportFiles,
  SUPPORTED_IDES,
} from "./codeDjExport";

function makeBundle(overrides: Partial<CodebaseBundle> = {}): CodebaseBundle {
  return {
    artifactId: "11111111-2222-3333-4444-555555555555",
    platform: "express-replit",
    manifest: {
      framework: "Express",
      language: "TypeScript",
      entrypoint: "src/index.ts",
      installCommand: "pnpm install",
      runCommand: "pnpm run dev",
      buildCommand: "pnpm run build",
      deployTarget: "Replit",
    },
    files: [
      {
        path: "src/index.ts",
        language: "typescript",
        content: "console.log('hi');",
      },
      {
        path: "package.json",
        language: "json",
        content: '{"name":"scaffold"}',
      },
      {
        path: "README.md",
        language: "md",
        content: "# Scaffold",
      },
    ],
    notes: "Scaffold notes here.",
    ...overrides,
  };
}

function makeSource(
  overrides: Partial<HarnessArtifact> = {},
): HarnessArtifact {
  return {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    sessionId: "session-1",
    featureId: 7,
    artifactType: "mvp_pdd" as HarnessArtifact["artifactType"],
    artifactContent: {
      sections: [
        { key: "overview", title: "Overview", body: "The product overview." },
        { key: "scope", title: "Scope", body: "What is in scope." },
      ],
      donut: { a: 3, b: 2, c: 1 },
    } as HarnessArtifact["artifactContent"],
    certTier: "SPARTAN-A",
    spartanCert: {
      certId: "CERT-123",
      class: "A",
      verificationUrl: "https://verify.example/CERT-123",
    } as HarnessArtifact["spartanCert"],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makePfp(overrides: Partial<PfpReport> = {}): PfpReport {
  return {
    artifactId: "11111111-2222-3333-4444-555555555555",
    verdict: "pass" as PfpReport["verdict"],
    fci: 92,
    summary: "Code traces cleanly to the certified spec.",
    findings: [
      {
        code: "MISSING_IMPL" as PfpReport["findings"][number]["code"],
        severity: "high" as PfpReport["findings"][number]["severity"],
        pddRef: "Scope",
        codeRef: "src/index.ts:1",
        detail: "Entry point only logs; scope expects an HTTP server.",
      },
    ],
    counts: { critical: 0, high: 1, medium: 0, low: 0 },
    ...overrides,
  };
}

describe("buildExportFiles", () => {
  it("includes every scaffold file at its real path", () => {
    const bundle = makeBundle();
    const files = buildExportFiles(bundle, makeSource(), makePfp());
    for (const f of bundle.files) {
      expect(files[f.path]).toBe(f.content);
    }
  });

  it("includes the universal AGENTS.md", () => {
    const files = buildExportFiles(makeBundle(), makeSource(), makePfp());
    expect(files["AGENTS.md"]).toBeDefined();
    expect(files["AGENTS.md"]).toContain("# CODE DJ — Agent Operating Brief");
  });

  it("includes every per-IDE adapter file declared in SUPPORTED_IDES", () => {
    const files = buildExportFiles(makeBundle(), makeSource(), makePfp());
    for (const { file } of SUPPORTED_IDES) {
      expect(files[file], `missing adapter file ${file}`).toBeDefined();
      expect(files[file].length).toBeGreaterThan(0);
    }
  });

  it("includes the retained raw bundle JSON with source lineage", () => {
    const source = makeSource();
    const bundle = makeBundle();
    const files = buildExportFiles(bundle, source, makePfp());
    expect(files[".code-dj/bundle.json"]).toBeDefined();
    const parsed = JSON.parse(files[".code-dj/bundle.json"]);
    expect(parsed.artifactId).toBe(bundle.artifactId);
    expect(parsed.platform).toBe(bundle.platform);
    expect(parsed.sourceMvpPddArtifactId).toBe(source.id);
  });

  it("records null source lineage when no source artifact is given", () => {
    const files = buildExportFiles(makeBundle());
    const parsed = JSON.parse(files[".code-dj/bundle.json"]);
    expect(parsed.sourceMvpPddArtifactId).toBeNull();
  });

  it("produces exactly scaffold + AGENTS.md + adapters + bundle JSON", () => {
    const bundle = makeBundle();
    const files = buildExportFiles(bundle, makeSource(), makePfp());
    const expected =
      bundle.files.length + 1 + SUPPORTED_IDES.length - 1 + 1;
    // -1 because AGENTS.md is also listed in SUPPORTED_IDES.
    expect(Object.keys(files).length).toBe(expected);
  });
});

describe("buildAgentsMd", () => {
  it("embeds the manifest commands", () => {
    const bundle = makeBundle();
    const md = buildAgentsMd(bundle, makeSource(), makePfp());
    expect(md).toContain(bundle.manifest.installCommand);
    expect(md).toContain(bundle.manifest.runCommand);
    expect(md).toContain(bundle.manifest.buildCommand as string);
    expect(md).toContain(bundle.manifest.framework);
    expect(md).toContain(bundle.manifest.entrypoint);
  });

  it("embeds the file ↔ spec traceability table with every file", () => {
    const bundle = makeBundle();
    const md = buildAgentsMd(bundle, makeSource(), makePfp());
    expect(md).toContain("| File | Language | PDD section(s) |");
    for (const f of bundle.files) {
      expect(md).toContain(`| \`${f.path}\``);
    }
  });

  it("embeds the SPARTAN cert lineage", () => {
    const source = makeSource();
    const md = buildAgentsMd(makeBundle(), source, makePfp());
    expect(md).toContain("## Certified source (SPARTAN)");
    expect(md).toContain(source.id);
    expect(md).toContain("CERT-123");
    expect(md).toContain("https://verify.example/CERT-123");
    expect(md).toContain("Overview");
    expect(md).toContain("Scope");
  });

  it("embeds the PFP findings table when a drift report is passed", () => {
    const pfp = makePfp();
    const md = buildAgentsMd(makeBundle(), makeSource(), pfp);
    expect(md).toContain("| Severity | Code | PDD ref | Code ref | Detail |");
    expect(md).toContain(pfp.verdict);
    expect(md).toContain(`${pfp.fci}/100`);
    expect(md).toContain(pfp.findings[0].detail);
  });

  it("falls back to a no-PFP note when no drift report is passed", () => {
    const md = buildAgentsMd(makeBundle(), makeSource());
    expect(md).toContain(
      "No PFP (PDD Fidelity Protocol) drift check was run before this export.",
    );
    expect(md).not.toContain(
      "| Severity | Code | PDD ref | Code ref | Detail |",
    );
  });
});
