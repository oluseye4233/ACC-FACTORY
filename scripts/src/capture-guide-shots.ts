/// <reference lib="dom" />
/**
 * Captures real screenshots (and a few scroll-through GIFs) of every feature
 * workspace for the /guide walkthrough cards.
 *
 * - Logs in through the real staff gate (POST /api/auth/login) inside the
 *   browser context using STAFF_ACCESS_CODE from the environment.
 * - Screenshots each walkthrough route at 1440x900 into attached_assets/guide/.
 * - For GIF_ROUTES, records a slow scroll through the page and assembles an
 *   animated GIF with the system ffmpeg (palette pass for quality).
 *
 * Run: pnpm --filter @workspace/scripts run capture-guide-shots
 * Requires: dev workflows running (proxy on localhost:80), chromium on PATH.
 */
import { execFile } from "node:child_process";
import { mkdir, rm, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import puppeteer, { type Browser, type Page } from "puppeteer-core";

const execFileAsync = promisify(execFile);

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = path.join(repoRoot, "attached_assets", "guide");

const BASE = "http://localhost:80";

/** Walkthrough id -> route, mirroring WALKTHROUGHS in pages/guide.tsx. */
const ROUTES: ReadonlyArray<{ id: string; route: string }> = [
  { id: "command", route: "/command" },
  { id: "sessions", route: "/session/new" },
  { id: "f0", route: "/f0" },
  { id: "ingest", route: "/ingest" },
  { id: "cartridge", route: "/cartridge" },
  { id: "exemplars", route: "/exemplars" },
  { id: "prompts", route: "/prompts" },
  { id: "quests", route: "/quests" },
  { id: "ascension", route: "/ascension" },
  { id: "activity", route: "/me/activity" },
  { id: "costs", route: "/me/costs" },
  { id: "account", route: "/account" },
  { id: "verify", route: "/verify" },
];

/** Routes that also get an animated scroll-through GIF. */
const GIF_ROUTES = new Set(["command", "sessions", "f0", "ascension"]);

const VIEWPORT = { width: 1440, height: 900 } as const;
const GIF_WIDTH = 880;
const GIF_FPS = 5;
const GIF_FRAMES = 18;

async function findChromium(): Promise<string> {
  const candidate = process.env.CHROMIUM_BIN;
  if (candidate) return candidate;
  const { stdout } = await execFileAsync("which", ["chromium"]);
  const bin = stdout.trim();
  if (!bin) throw new Error("chromium not found on PATH; set CHROMIUM_BIN");
  return bin;
}

async function login(page: Page): Promise<void> {
  const code = process.env.STAFF_ACCESS_CODE;
  if (!code) throw new Error("STAFF_ACCESS_CODE is not set in the environment");
  await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 60_000 });
  const result = await page.evaluate(async (accessCode: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code: accessCode, name: "Guide Shots Bot" }),
    });
    return { ok: res.ok, status: res.status };
  }, code);
  if (!result.ok) {
    throw new Error(`staff login failed with HTTP ${result.status}`);
  }
  console.log("[capture-guide-shots] staff login OK");
}

async function settle(page: Page): Promise<void> {
  // Let streaming panes, fonts, and skeleton loaders settle.
  await new Promise((r) => setTimeout(r, 2500));
  await page.evaluate(() => (document as Document).fonts?.ready);
}

const force = process.argv.includes("--force");

async function exists(file: string): Promise<boolean> {
  return stat(file).then(
    () => true,
    () => false,
  );
}

async function captureStill(page: Page, id: string, route: string): Promise<void> {
  const file = path.join(outDir, `${id}.png`);
  if (!force && (await exists(file))) {
    console.log(`[capture-guide-shots] skip  ${id}.png (exists)`);
    return;
  }
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle2", timeout: 60_000 });
  await settle(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: file as `${string}.png`, type: "png" });
  const size = (await stat(file)).size;
  console.log(`[capture-guide-shots] still ${id}.png (${Math.round(size / 1024)} KB)`);
}

async function captureGif(page: Page, id: string, route: string): Promise<void> {
  const gifPath = path.join(outDir, `${id}.gif`);
  if (!force && (await exists(gifPath))) {
    console.log(`[capture-guide-shots] skip  ${id}.gif (exists)`);
    return;
  }
  const framesDir = path.join("/tmp", `guide-gif-${id}`);
  await rm(framesDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });

  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle2", timeout: 60_000 });
  await settle(page);

  const scrollable = await page.evaluate(() => {
    window.scrollTo(0, 0);
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  });
  const step = scrollable > 0 ? scrollable / (GIF_FRAMES - 1) : 0;

  for (let i = 0; i < GIF_FRAMES; i++) {
    await page.evaluate((y: number) => window.scrollTo({ top: y }), Math.round(i * step));
    await new Promise((r) => setTimeout(r, 180));
    const framePath = path.join(framesDir, `frame${String(i).padStart(3, "0")}.png`);
    await page.screenshot({ path: framePath as `${string}.png`, type: "png" });
  }

  await execFileAsync("ffmpeg", [
    "-y",
    "-framerate",
    String(GIF_FPS),
    "-i",
    path.join(framesDir, "frame%03d.png"),
    "-vf",
    `scale=${GIF_WIDTH}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4`,
    "-loop",
    "0",
    gifPath,
  ]);
  await rm(framesDir, { recursive: true, force: true });
  const size = (await stat(gifPath)).size;
  console.log(`[capture-guide-shots] gif   ${id}.gif (${Math.round(size / 1024)} KB)`);
}

async function main(): Promise<void> {
  await mkdir(outDir, { recursive: true });
  const executablePath = await findChromium();
  const browser: Browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars", "--force-color-profile=srgb"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ ...VIEWPORT, deviceScaleFactor: 1 });
    await login(page);

    for (const { id, route } of ROUTES) {
      await captureStill(page, id, route);
      if (GIF_ROUTES.has(id)) {
        await captureGif(page, id, route);
      }
    }
  } finally {
    await browser.close();
  }
  const files = await readdir(outDir);
  console.log(`[capture-guide-shots] done — ${files.length} files in attached_assets/guide/`);
}

main().catch((err) => {
  console.error("[capture-guide-shots] failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
