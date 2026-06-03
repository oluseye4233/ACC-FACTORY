import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

// Resolve outputs from the repo root, not the script's cwd (pnpm --filter runs
// scripts from the package directory).
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Generate the single F1000 ("First 1000") soft-launch QR code. It encodes the
 * public promo landing (/f1000); the unique 1..1000 invite code is handed out
 * server-side when the visitor taps "Claim my invite", so this one static QR
 * serves the Book and the landing page alike.
 */

const TARGET_URL =
  process.env.F1000_QR_URL ?? "https://command-centre-plan.replit.app/f1000";

const OUTPUTS = [
  resolve(REPO_ROOT, "artifacts/command-centre/public/f1000-qr.png"),
  resolve(REPO_ROOT, "exports/f1000-qr.png"),
];

async function main(): Promise<void> {
  for (const out of OUTPUTS) {
    await mkdir(dirname(out), { recursive: true });
    await QRCode.toFile(out, TARGET_URL, {
      type: "png",
      errorCorrectionLevel: "H",
      width: 1024,
      margin: 2,
      color: {
        dark: "#0D0D0D",
        light: "#FFFFFF",
      },
    });
    console.log(`[f1000-qr] wrote ${out}`);
  }
  console.log(`[f1000-qr] encodes: ${TARGET_URL}`);
}

main().catch((err) => {
  console.error("[f1000-qr] failed:", err);
  process.exit(1);
});
