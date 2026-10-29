import { describe, expect, it } from "vitest";
import { spcCheatSheetDocument } from "../src/lib/agent-cheat-sheet";

const source = {
  sections: [
    { key: "card_identity_metadata", body: "| Name | Research SPC |\n| Author | Source Author |\n| Owner | Enterprise Owner |" },
    { key: "lineage_traceability", body: "Synthesized from Parent A and Parent B." },
    { key: "dna_architecture", body: "Parent A 60%, Parent B 40%." },
    { key: "context_craft_pillars", body: "| ROLE | Evidence reviewer |\n| DATA | Supplied documents |" },
    { key: "risk_register", body: "Do not expose private documents." },
    { key: "governance_signing", body: "Escalate material uncertainty to the operator." },
  ],
};
describe("nine-field SPC Cheat Sheet", () => {
  it("includes every required heading and distinguishes author, owner, lineage and skills", () => {
    const doc = spcCheatSheetDocument("Project", "source-id", source, {
      sourceName: "Project — Research SPC", target: "AZURE::AZURE_CONTAINER_APPS", now: new Date("2026-10-29T12:00:00Z"),
    });
    for (let i = 1; i <= 9; i++) expect(doc.markdown).toContain(`## ${i}.`);
    expect(doc.metadata).toMatchObject({
      spcName: "Research SPC", projectFileName: "Project — Research SPC",
      timestamp: "2026-10-29T12:00:00.000Z", target: "AZURE::AZURE_CONTAINER_APPS",
    });
    expect(doc.metadata.author).toContain("Source Author");
    expect(doc.metadata.owner).toContain("Enterprise Owner");
    expect(doc.metadata.lineage).toContain("Parent A");
    expect(doc.metadata.skills).toContain("Evidence reviewer");
    expect(doc.markdown).toContain("gateway/middleware");
    expect(doc.markdown).toContain("GRO");
    expect(doc.markdown).toContain("not proof");
  });
  it("does not invent authorship or infer legal ownership from the subscription", () => {
    const doc = spcCheatSheetDocument("Project", "id", {}, { creatorName: "Creator", organizationName: "Enterprise" });
    expect(doc.metadata.author).toContain("authorship is not established");
    expect(doc.metadata.owner).toContain("Enterprise workspace: Enterprise");
    expect(doc.metadata.owner).toContain("requires confirmation");
    expect(doc.metadata.skills).toContain("Not recorded");
    expect(doc.metadata.lineage).toContain("Not recorded");
    expect(doc.metadata.savant).toContain("No target selected");
  });
  it("retains all nine fields for long source content within the runtime schema bound", () => {
    const doc = spcCheatSheetDocument("P".repeat(200), "id", {
      name: "N".repeat(1000), author: "A".repeat(1000), owner: "O".repeat(1000), skills: "S".repeat(10000),
      sections: ["lineage_traceability", "dna_architecture", "risk_register", "governance_signing"].map(key => ({ key, body: "B".repeat(10000) })),
    }, { sourceName: "F".repeat(1000), target: "AWS::AWS_LAMBDA" });
    expect(doc.markdown.length).toBeLessThanOrEqual(6000);
    expect(doc.markdown).toContain("## 9. Owner");
    expect(doc.metadata.lineage.length).toBeGreaterThan(10000);
    expect(doc.markdown).toContain("[Excerpt; consult the full source SPC.]");
  });
  it("inherits valid selected targets and never claims a completed SAVANT verdict", () => {
    for (const target of ["AWS::AWS_LAMBDA", "SLACK::SLACK_AGENT", "LANGCHAIN::LANGCHAIN_APP"]) {
      const doc = spcCheatSheetDocument("P", "id", { colonizationTarget: target });
      expect(doc.metadata.target).toBe(target);
      expect(doc.metadata.savant).toContain("not installation");
    }
  });
});
