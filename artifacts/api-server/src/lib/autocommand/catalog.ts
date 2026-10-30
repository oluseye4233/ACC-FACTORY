export const AUTO_COMMAND_PACKAGES = [
  { id: "BASIC_AGENT", name: "Basic AI Agent", priceCents: 1000, available: true,
    description: "A focused agent specification for a clearly defined task.",
    artifacts: ["MA specification", "Micro PDD"] },
  { id: "ADVANCED_AGENT", name: "Advanced AI Agent", priceCents: 2500, available: true,
    description: "A structured SPC specification for a more capable AI agent.",
    artifacts: ["SPC specification", "SPC Cheat Sheet"] },
  { id: "WEB_APPLICATION", name: "AI-native Web Application", priceCents: 5000, available: true,
    description: "A governed specification package for an AI-native web application.",
    artifacts: ["SPC specification", "PDD", "MVP PDD"] },
  { id: "FIRMWARE", name: "Firmware", priceCents: null, available: false,
    description: "Future offering. Not available to order.", artifacts: [] },
  { id: "ROBOTWARE", name: "RobotWare", priceCents: null, available: false,
    description: "Future offering. Not available to order.", artifacts: [] },
  { id: "CHIPWARE", name: "ChipWare", priceCents: null, available: false,
    description: "Future offering. Not available to order.", artifacts: [] },
] as const;

export const AUTO_COMMAND_DOCUMENT_TYPES = [
  { id: "BUSINESS_ANALYSIS", name: "Business analysis" },
  { id: "BUSINESS_PLAN", name: "Business plan" },
  { id: "BUSINESS_CASE", name: "Business case" },
  { id: "FEASIBILITY_STUDY", name: "Feasibility study" },
  { id: "PRODUCT_BRIEF", name: "Product brief" },
] as const;

export const AUTO_COMMAND_TARGETS = [
  "IDE", "VIBE_CODING_APP", "LANGCHAIN", "AWS", "OPENAI_AGENTS",
  "GOOGLE_GEMINI_STUDIO", "MICROSOFT_COPILOT_AZURE", "CLAUDE_SKILLS",
] as const;

/** Deliberately not an activation flag: checkout requires a reviewed fulfillment implementation. */
export const AUTO_COMMAND_READINESS = {
  intakeEnabled: true,
  checkoutEnabled: false,
  automaticProductionEnabled: false,
  emailDeliveryEnabled: false,
  blockers: [
    "Automatic F-stage orchestration and saved-job recovery are not connected yet.",
    "One-time checkout, verified-email promotion claims and payment confirmation are not connected yet.",
    "IMPRIMA package rendering, publication authorization and email-delivery acceptance are not connected yet.",
  ],
};

export function packageFor(type: string) {
  const item = AUTO_COMMAND_PACKAGES.find(item => item.id === type && item.available);
  if (!item || item.priceCents === null) throw new Error("Choose an available specification package.");
  return item;
}

export function autoCommandCatalog() {
  return {
    name: "ATANDA AutoCommand",
    currency: "USD",
    packages: AUTO_COMMAND_PACKAGES,
    documentTypes: AUTO_COMMAND_DOCUMENT_TYPES,
    targets: AUTO_COMMAND_TARGETS,
    commonArtifacts: [
      "Editable F0 business-document draft (.docx) for human completion",
      "General implementation Cheat Sheet",
      "Declared owner, creator and source provenance",
    ],
    promotion: {
      policy: "FIRST_PACKAGE_PER_VERIFIED_EMAIL",
      description: "Your first specification package is free, once per verified email address. Final eligibility is checked at checkout.",
    },
    readiness: AUTO_COMMAND_READINESS,
  };
}
