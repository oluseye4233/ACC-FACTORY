// Generates a one-page, color-coded ATANDA function status map.
// Run with: node scripts/src/build-atanda-function-status-map.mjs
// Output: docs/ATANDA_Function_Status_Map.pdf

import { createRequire } from "node:module";
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const exportRequire = createRequire(resolve(repoRoot, "lib/export/package.json"));
const PDFDocument = exportRequire("pdfkit");
const output = resolve(repoRoot, "docs/ATANDA_Function_Status_Map.pdf");
mkdirSync(dirname(output), { recursive: true });

const C = {
  navy: "#0B1D3A",
  teal: "#1F7A8C",
  green: "#167447",
  greenFill: "#E8F6EE",
  red: "#B42318",
  redFill: "#FDECEC",
  amber: "#A15C00",
  amberFill: "#FFF4D6",
  grey: "#52606D",
  light: "#D9E2EC",
  white: "#FFFFFF",
};

const doc = new PDFDocument({
  size: "TABLOID",
  layout: "landscape",
  margins: { top: 38, bottom: 34, left: 42, right: 42 },
  info: {
    Title: "ATANDA Function Status Map",
    Author: "ATANDA Command Centre",
    Subject: "Color-coded visual map of active and inactive ATANDA functions.",
  },
});
doc.pipe(createWriteStream(output));

function text(value, x, y, width, size = 9, color = C.navy, font = "Helvetica") {
  doc.fillColor(color).font(font).fontSize(size).text(value, x, y, {
    width,
    lineGap: 1.5,
    align: "left",
  });
}

function box({ x, y, w, h, id, title, note, status = "active" }) {
  const active = status === "active";
  const color = active ? C.green : C.red;
  const fill = active ? C.greenFill : C.redFill;
  doc.save().roundedRect(x, y, w, h, 8).fillColor(fill).fill().strokeColor(color).lineWidth(1.5).stroke().restore();
  doc.save().fillColor(color).roundedRect(x + 10, y + 10, 62, 20, 10).fill().restore();
  text(active ? "ACTIVE" : "INACTIVE", x + 16, y + 15, 52, 8, C.white, "Helvetica-Bold");
  text(id, x + 82, y + 10, w - 92, 11, color, "Helvetica-Bold");
  text(title, x + 10, y + 39, w - 20, 11, C.navy, "Helvetica-Bold");
  text(note, x + 10, y + 58, w - 20, 7.7, C.grey);
}

function arrow(x1, y1, x2, y2, dashed = false, color = C.teal) {
  doc.save().strokeColor(color).lineWidth(1.6);
  if (dashed) doc.dash(5, { space: 4 });
  doc.moveTo(x1, y1).lineTo(x2, y2).stroke();
  doc.undash().fillColor(color)
    .polygon([x2, y2], [x2 - 7, y2 - 4], [x2 - 7, y2 + 4]).fill().restore();
}

// Header and legend
text("ATANDA", 42, 30, 200, 26, C.navy, "Helvetica-Bold");
text("FUNCTION STATUS MAP", 42, 60, 420, 24, C.teal, "Helvetica-Bold");
text("Current implemented availability - September 2026", 42, 91, 420, 11, C.grey);

doc.save().roundedRect(740, 38, 435, 62, 8).fillColor("#F7F9FC").fill().strokeColor(C.light).stroke().restore();
doc.save().fillColor(C.greenFill).strokeColor(C.green).roundedRect(758, 52, 93, 26, 7).fillAndStroke().restore();
text("ACTIVE", 779, 60, 55, 9, C.green, "Helvetica-Bold");
text("Implemented operational surface", 862, 57, 145, 8.5, C.grey);
doc.save().fillColor(C.redFill).strokeColor(C.red).roundedRect(1014, 52, 93, 26, 7).fillAndStroke().restore();
text("INACTIVE", 1027, 60, 68, 9, C.red, "Helvetica-Bold");
text("Planned, dormant, or incomplete", 862, 75, 250, 8.5, C.grey);

// Main flow
text("CORE SYSTEM FLOW", 42, 122, 250, 12, C.navy, "Helvetica-Bold");
const top = 148;
const w = 145;
const h = 92;
const gap = 17;
const xs = Array.from({ length: 7 }, (_, i) => 42 + i * (w + gap));

const core = [
  { id: "F0", title: "ADVISORY / SOLVA", note: "User-facing advisory route; deviation return point.", status: "active" },
  { id: "F1-F7", title: "PRODUCTION RAIL", note: "Implemented session cockpit from diagnosis through certification.", status: "active" },
  { id: "F8", title: "CODE DJ", note: "Certified codebase generation, ZIP, IDE, and GitHub handoff.", status: "active" },
  { id: "F9", title: "MECHA MACHINE FLOOR", note: "Contract/backend surface; no complete user-facing stage route.", status: "inactive" },
  { id: "F9.5", title: "OSIRIS CUSTODY", note: "Operational API/admin custody and attestation surface.", status: "active" },
  { id: "F10", title: "RELEASE GATEWAY", note: "ZIP/GitHub handoff plus native provider deployment.", status: "active" },
  { id: "MONITOR", title: "EXECUTION STATUS", note: "ACK separated from ACCEPTED, RUNNING, COMPLETED, and FAILED.", status: "active" },
];

core.forEach((item, i) => box({ x: xs[i], y: top, w, h, ...item }));
for (let i = 0; i < xs.length - 1; i += 1) {
  arrow(xs[i] + w, top + h / 2, xs[i + 1], top + h / 2, false, core[i + 1].status === "inactive" ? C.red : C.teal);
}
arrow(xs[4], top + h - 3, xs[0] + w / 2, top + h + 38, true, C.amber);
text("OSIRIS deviation returns through SOLVA", 238, top + h + 23, 260, 8, C.amber, "Helvetica-Bold");

// Active embedded/advisory functions
text("ACTIVE ADVISORY, ASSURANCE & ACCESS FUNCTIONS", 42, 304, 500, 12, C.navy, "Helvetica-Bold");
const activeCards = [
  ["F6-VDJ", "VIBE ORACLE", "Embedded IDE and coding approach recommendations."],
  ["ATLAS 360", "PLAN / SCAN", "Read-only planning and assurance views."],
  ["F8-HDJ", "HOST ORACLE", "Embedded deployment-host ranking."],
  ["MATHMON / PFP", "ASSURANCE OVERLAYS", "Certification math and PDD/code drift checks."],
  ["SPC PLAYER", "CAPABILITY COCKPIT", "Plan-first runs and consented HTTPS delivery."],
  ["PUBLIC", "VERIFY + FREE TOOLS", "Verification, Test Your Agent, and Savings Calculator."],
];
activeCards.forEach(([id, title, note], i) => {
  const col = i % 3;
  const row = Math.floor(i / 3);
  box({ x: 42 + col * 365, y: 330 + row * 108, w: 342, h: 92, id, title, note, status: "active" });
});

// Inactive/planned functions
text("INACTIVE, DORMANT OR INCOMPLETE FUNCTIONS", 42, 558, 480, 12, C.navy, "Helvetica-Bold");
const inactiveCards = [
  ["F1000", "REDEMPTION", "Legacy component/backend exists; no registered user-facing route."],
  ["BILLING", "PRICING / SUBSCRIPTIONS", "Dormant feature flag; no registered pricing page."],
  ["SPHINX", "EXTERNAL MARKETPLACE", "Connection seam exists; marketplace is not live."],
  ["ARK IMPORT", "ASCENSION IMPORT", "Ascension route is active, but Ark import is unavailable when disconnected."],
];
inactiveCards.forEach(([id, title, note], i) => {
  box({ x: 42 + i * 283, y: 584, w: 260, h: 92, id, title, note, status: "inactive" });
});

// F10 lane strip
doc.save().roundedRect(42, 690, 1133, 58, 8).fillColor("#F7F9FC").fill().strokeColor(C.light).stroke().restore();
text("F10 ACTIVE LANES", 58, 704, 130, 10, C.teal, "Helvetica-Bold");
text("1  SIGNED F9 RELEASE", 210, 702, 190, 9.5, C.green, "Helvetica-Bold");
text("Receipt proves delivery only", 210, 720, 190, 8, C.grey);
text("2  ZIP / GITHUB HANDOFF", 475, 702, 210, 9.5, C.green, "Helvetica-Bold");
text("Deterministic bundle and push result", 475, 720, 220, 8, C.grey);
text("3  PROVIDER DEPLOYMENT", 755, 702, 210, 9.5, C.green, "Helvetica-Bold");
text("AWS / Azure / OpenAI / Gemini", 755, 720, 210, 8, C.grey);
text("STATUS", 1030, 702, 80, 9.5, C.green, "Helvetica-Bold");
text("ACK != execution", 1030, 720, 120, 8, C.grey);

doc.end();
console.log(output);