export type BadgeFormat = "png" | "jpeg" | "svg";

export type StandardBadgeId = "ASPE" | "AISA" | "AISE";
export type SeniorBadgeId = "AISA_PWDD" | "AISE_BUILD";
export type CertificateBadgeId = StandardBadgeId | SeniorBadgeId;

export interface BadgeCertificateOptions {
  badgeId: CertificateBadgeId;
  badgeFullName: string;
  description: string;
  recipientName: string;
  recipientEmail?: string | null;
  unlockedAt?: string | null;
  format: BadgeFormat;
  /** When set, renders the distinct "Senior · Advanced Systems" variant. */
  senior?: {
    /** e.g. "3 PWDD-stage projects certified" or "Verified live build". */
    thresholdNote: string;
    /** Optional verified URL printed near the footer (Engineer cert). */
    verifiedUrl?: string | null;
    /** Optional short evidence excerpt (Engineer cert). Will be truncated. */
    evidenceExcerpt?: string | null;
  };
}

const CANVAS_SIZE = 1400;
const PRODUCT_LINE = "ATANDA COMMAND CENTRE";
const ISSUER_LINE = "FORGE.BONSAI HARNESS";
const TAGLINE = "AWARDED TO";
const DATE_LINE = "UNLOCKED ON";
const SENIOR_RIBBON = "SENIOR · ADVANCED SYSTEMS";
const EVIDENCE_MAX = 180;

const LOGO_URL = `${import.meta.env.BASE_URL}atanda-logo.png`;
const LOGO_RATIO = 1.5; // atanda-logo.png is 1920×1280

const MARK_URL = `${import.meta.env.BASE_URL}atanda-mark.png`;
const MARK_RATIO = 5.05; // trimmed atanda-mark.png is 1454×288

// Professional ink palette — black text on white.
const INK = "#111111";
const INK_SOFT = "rgba(17,17,17,0.72)";
const INK_FAINT = "rgba(17,17,17,0.5)";
const INK_LINE = "rgba(17,17,17,0.55)";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return new Date().toISOString().slice(0, 10);
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function shortId(badgeId: string, recipient: string, unlockedAt: string): string {
  const raw = `${badgeId}|${recipient}|${unlockedAt}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  const positive = Math.abs(hash).toString(16).toUpperCase().padStart(8, "0");
  return positive.slice(0, 8);
}

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

async function fetchAsDataUrl(src: string): Promise<string> {
  const res = await fetch(src);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = meta.match(/data:(.*?);base64/)?.[1] ?? "application/octet-stream";
  const bin = atob(b64 ?? "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Returns the largest font size (in px) for the given weight/family that fits
 * `text` within `maxWidth`, between `min` and `max`. Mutates ctx.font.
 */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  max: number,
  min: number,
  weight: string,
  family: string,
): number {
  let px = max;
  ctx.font = `${weight} ${px}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && px > min) {
    px -= 2;
    ctx.font = `${weight} ${px}px ${family}`;
  }
  return px;
}

async function renderCanvas(opts: BadgeCertificateOptions): Promise<HTMLCanvasElement> {
  const size = CANVAS_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const isSenior = !!opts.senior;

  // White background.
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, size, size);

  // Black border frame.
  const border = Math.round(size * 0.012);
  ctx.strokeStyle = INK;
  ctx.lineWidth = border;
  ctx.strokeRect(border / 2, border / 2, size - border, size - border);

  // Inner thin line.
  ctx.strokeStyle = INK_LINE;
  ctx.lineWidth = 1.5;
  const inset = Math.round(size * 0.05);
  ctx.strokeRect(inset, inset, size - inset * 2, size - inset * 2);

  // Senior decorative second inner frame.
  if (isSenior) {
    ctx.strokeStyle = "rgba(17,17,17,0.28)";
    ctx.lineWidth = 1;
    const inset2 = inset + 14;
    ctx.strokeRect(inset2, inset2, size - inset2 * 2, size - inset2 * 2);
  }

  // Logo top-left (small), with issuer lines to its right.
  const pad = Math.round(size * 0.022);
  const logoH = Math.round(size * 0.08);
  const logoW = Math.round(logoH * LOGO_RATIO);
  const logoX = inset + pad;
  const logoY = inset + pad;
  try {
    const logo = await loadImage(LOGO_URL);
    ctx.drawImage(logo, logoX, logoY, logoW, logoH);
  } catch {
    // Logo is decorative; skip silently if it fails to load.
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const headTextX = logoX + logoW + Math.round(pad * 0.7);
  ctx.fillStyle = INK;
  ctx.font = `600 ${Math.round(size * 0.018)}px ui-monospace, "SFMono-Regular", Menlo, monospace`;
  ctx.fillText(PRODUCT_LINE, headTextX, logoY + Math.round(logoH * 0.46));
  ctx.fillStyle = INK_SOFT;
  ctx.font = `400 ${Math.round(size * 0.013)}px ui-monospace, monospace`;
  ctx.fillText(ISSUER_LINE, headTextX, logoY + Math.round(logoH * 0.82));

  // Senior ribbon, top-right.
  if (isSenior) {
    ctx.textAlign = "right";
    ctx.fillStyle = INK;
    ctx.font = `700 ${Math.round(size * 0.016)}px ui-monospace, monospace`;
    ctx.fillText(SENIOR_RIBBON, size - inset - pad, logoY + Math.round(logoH * 0.55));
  }

  // Centred content.
  ctx.textAlign = "center";
  const cx = size / 2;

  // Big badge code. Senior IDs are longer (AISA_PWDD / AISE_BUILD) → auto-fit.
  ctx.fillStyle = INK;
  const maxBadgeWidth = size * 0.82;
  const badgeMax = Math.round(size * (isSenior ? 0.14 : 0.22));
  const badgeMin = Math.round(size * 0.08);
  fitFont(
    ctx,
    opts.badgeId,
    maxBadgeWidth,
    badgeMax,
    badgeMin,
    "800",
    '"Georgia", "Times New Roman", serif',
  );
  ctx.fillText(opts.badgeId, cx, size * 0.42);

  // Badge full name underneath.
  ctx.fillStyle = INK_SOFT;
  fitFont(
    ctx,
    opts.badgeFullName.toUpperCase(),
    size * 0.82,
    Math.round(size * 0.028),
    Math.round(size * 0.018),
    "600",
    "ui-monospace, monospace",
  );
  ctx.fillText(opts.badgeFullName.toUpperCase(), cx, size * 0.48);

  // Description (wrapped, italic serif).
  ctx.fillStyle = INK_SOFT;
  ctx.font = `italic 400 ${Math.round(size * 0.02)}px Georgia, serif`;
  const descLines = wrapText(ctx, opts.description, size * 0.72);
  let lineY = size * 0.54;
  for (const line of descLines.slice(0, 3)) {
    ctx.fillText(line, cx, lineY);
    lineY += size * 0.028;
  }

  // Senior threshold note + optional evidence excerpt sit between description and divider.
  if (isSenior && opts.senior) {
    ctx.fillStyle = INK;
    ctx.font = `700 ${Math.round(size * 0.018)}px ui-monospace, monospace`;
    ctx.fillText(opts.senior.thresholdNote.toUpperCase(), cx, size * 0.615);

    if (opts.senior.evidenceExcerpt) {
      ctx.fillStyle = INK_SOFT;
      ctx.font = `italic 400 ${Math.round(size * 0.018)}px Georgia, serif`;
      const excerpt = `"${truncate(opts.senior.evidenceExcerpt, EVIDENCE_MAX)}"`;
      const exLines = wrapText(ctx, excerpt, size * 0.7);
      let y = size * 0.64;
      for (const line of exLines.slice(0, 2)) {
        ctx.fillText(line, cx, y);
        y += size * 0.024;
      }
    }
  }

  // Divider.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.18, size * 0.69);
  ctx.lineTo(cx + size * 0.18, size * 0.69);
  ctx.stroke();

  // "AWARDED TO" label.
  ctx.fillStyle = INK_SOFT;
  ctx.font = `600 ${Math.round(size * 0.018)}px ui-monospace, monospace`;
  ctx.fillText(TAGLINE, cx, size * 0.735);

  // Recipient name.
  ctx.fillStyle = INK;
  const recipient = opts.recipientName.trim() || "Operator";
  fitFont(
    ctx,
    recipient,
    size * 0.82,
    Math.round(size * 0.06),
    24,
    "700",
    '"Georgia", serif',
  );
  ctx.fillText(recipient, cx, size * 0.795);

  // Optional email subline.
  if (opts.recipientEmail) {
    ctx.fillStyle = INK_FAINT;
    ctx.font = `400 ${Math.round(size * 0.018)}px ui-monospace, monospace`;
    ctx.fillText(opts.recipientEmail, cx, size * 0.825);
  }

  // Verified URL (Engineer cert) printed above date.
  if (isSenior && opts.senior?.verifiedUrl) {
    ctx.fillStyle = INK;
    ctx.font = `600 ${Math.round(size * 0.014)}px ui-monospace, monospace`;
    ctx.fillText("VERIFIED LIVE URL", cx, size * 0.855);
    ctx.fillStyle = INK_SOFT;
    fitFont(
      ctx,
      opts.senior.verifiedUrl,
      size * 0.82,
      Math.round(size * 0.02),
      Math.round(size * 0.013),
      "400",
      "ui-monospace, monospace",
    );
    ctx.fillText(opts.senior.verifiedUrl, cx, size * 0.88);
  }

  // Date + ID footer.
  const unlocked = formatDate(opts.unlockedAt);
  const id = shortId(opts.badgeId, recipient, unlocked);

  const dateY = isSenior && opts.senior?.verifiedUrl ? size * 0.905 : size * 0.88;
  const valueY = isSenior && opts.senior?.verifiedUrl ? size * 0.935 : size * 0.915;

  ctx.fillStyle = INK_SOFT;
  ctx.font = `600 ${Math.round(size * 0.016)}px ui-monospace, monospace`;
  ctx.fillText(DATE_LINE, cx, dateY);

  ctx.fillStyle = INK;
  ctx.font = `600 ${Math.round(size * 0.026)}px ui-monospace, monospace`;
  ctx.fillText(unlocked, cx, valueY);

  ctx.fillStyle = INK_FAINT;
  ctx.font = `400 ${Math.round(size * 0.015)}px ui-monospace, monospace`;
  ctx.textAlign = "right";
  ctx.fillText(`CERT ID  ${id}`, size - inset - 8, size - inset - 12);
  ctx.textAlign = "left";
  ctx.fillText("atanda.command-centre", inset + 8, size - inset - 12);

  // Colour mark, bottom-right footer (above the CERT ID line).
  const markW = Math.round(size * 0.16);
  const markH = Math.round(markW / MARK_RATIO);
  const markX = size - inset - 8 - markW;
  const markY = size - inset - 12 - markH - Math.round(size * 0.022);
  try {
    const mark = await loadImage(MARK_URL);
    ctx.drawImage(mark, markX, markY, markW, markH);
  } catch {
    // Mark is decorative; skip silently if it fails to load.
  }

  return canvas;
}

function safeFilename(badgeId: string, recipient: string, ext: string): string {
  const slug = recipient
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "operator";
  return `atanda-${badgeId.toLowerCase()}-${slug}.${ext}`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      case "'":
        return "&apos;";
      default:
        return c;
    }
  });
}

async function buildSvg(opts: BadgeCertificateOptions): Promise<string> {
  const size = CANVAS_SIZE;
  const logoDataUrl = await fetchAsDataUrl(LOGO_URL);
  const markDataUrl = await fetchAsDataUrl(MARK_URL);
  const unlocked = formatDate(opts.unlockedAt);
  const recipient = opts.recipientName.trim() || "Operator";
  const id = shortId(opts.badgeId, recipient, unlocked);
  const inset = Math.round(size * 0.05);
  const isSenior = !!opts.senior;
  const border = Math.round(size * 0.012);

  const pad = Math.round(size * 0.022);
  const logoH = Math.round(size * 0.08);
  const logoW = Math.round(logoH * LOGO_RATIO);
  const logoX = inset + pad;
  const logoY = inset + pad;
  const headTextX = logoX + logoW + Math.round(pad * 0.7);

  const badgeFontPx = Math.round(size * (isSenior ? 0.14 : 0.22));

  const innerSeniorFrame = isSenior
    ? `<rect x="${inset + 14}" y="${inset + 14}" width="${size - (inset + 14) * 2}" height="${size - (inset + 14) * 2}" fill="none" stroke="rgba(17,17,17,0.28)" stroke-width="1"/>`
    : "";

  const seniorRibbon = isSenior
    ? `<text x="${size - inset - pad}" y="${logoY + Math.round(logoH * 0.55)}" text-anchor="end" font-family="ui-monospace, Menlo, monospace" font-weight="700" font-size="${Math.round(size * 0.016)}" fill="${INK}">${escapeXml(SENIOR_RIBBON)}</text>`
    : "";

  const thresholdLine = isSenior && opts.senior
    ? `<text x="50%" y="${size * 0.615}" text-anchor="middle" font-family="ui-monospace, monospace" font-weight="700" font-size="${Math.round(size * 0.018)}" fill="${INK}">${escapeXml(opts.senior.thresholdNote.toUpperCase())}</text>`
    : "";

  const evidenceExcerpt = isSenior && opts.senior?.evidenceExcerpt
    ? `<text x="50%" y="${size * 0.64}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="${Math.round(size * 0.018)}" fill="${INK_SOFT}">"${escapeXml(truncate(opts.senior.evidenceExcerpt, EVIDENCE_MAX))}"</text>`
    : "";

  const verifiedUrlBlock = isSenior && opts.senior?.verifiedUrl
    ? `<text x="50%" y="${size * 0.855}" text-anchor="middle" font-family="ui-monospace, monospace" font-weight="600" font-size="${Math.round(size * 0.014)}" fill="${INK}">VERIFIED LIVE URL</text>
  <text x="50%" y="${size * 0.88}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="${Math.round(size * 0.018)}" fill="${INK_SOFT}">${escapeXml(opts.senior.verifiedUrl)}</text>`
    : "";

  const hasVerifiedUrl = isSenior && !!opts.senior?.verifiedUrl;
  const dateY = hasVerifiedUrl ? size * 0.905 : size * 0.88;
  const valueY = hasVerifiedUrl ? size * 0.935 : size * 0.915;

  const markW = Math.round(size * 0.16);
  const markH = Math.round(markW / MARK_RATIO);
  const markX = size - inset - 8 - markW;
  const markY = size - inset - 12 - markH - Math.round(size * 0.022);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect x="0" y="0" width="${size}" height="${size}" fill="#FFFFFF"/>
  <rect x="${border / 2}" y="${border / 2}" width="${size - border}" height="${size - border}" fill="none" stroke="${INK}" stroke-width="${border}"/>
  <rect x="${inset}" y="${inset}" width="${size - inset * 2}" height="${size - inset * 2}" fill="none" stroke="${INK_LINE}" stroke-width="1.5"/>
  ${innerSeniorFrame}
  <image href="${logoDataUrl}" x="${logoX}" y="${logoY}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMidYMid meet"/>
  <text x="${headTextX}" y="${logoY + Math.round(logoH * 0.46)}" font-family="ui-monospace, Menlo, monospace" font-weight="600" font-size="${Math.round(size * 0.018)}" fill="${INK}">${escapeXml(PRODUCT_LINE)}</text>
  <text x="${headTextX}" y="${logoY + Math.round(logoH * 0.82)}" font-family="ui-monospace, monospace" font-size="${Math.round(size * 0.013)}" fill="${INK_SOFT}">${escapeXml(ISSUER_LINE)}</text>
  ${seniorRibbon}
  <text x="50%" y="${size * 0.42}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="800" font-size="${badgeFontPx}" textLength="${size * 0.82}" lengthAdjust="spacingAndGlyphs" fill="${INK}">${escapeXml(opts.badgeId)}</text>
  <text x="50%" y="${size * 0.48}" text-anchor="middle" font-family="ui-monospace, monospace" font-weight="600" font-size="${Math.round(size * 0.028)}" fill="${INK_SOFT}">${escapeXml(opts.badgeFullName.toUpperCase())}</text>
  <text x="50%" y="${size * 0.54}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="${Math.round(size * 0.02)}" fill="${INK_SOFT}">${escapeXml(opts.description)}</text>
  ${thresholdLine}
  ${evidenceExcerpt}
  <line x1="${size * 0.32}" y1="${size * 0.69}" x2="${size * 0.68}" y2="${size * 0.69}" stroke="${INK}" stroke-width="2"/>
  <text x="50%" y="${size * 0.735}" text-anchor="middle" font-family="ui-monospace, monospace" font-weight="600" font-size="${Math.round(size * 0.018)}" fill="${INK_SOFT}">${escapeXml(TAGLINE)}</text>
  <text x="50%" y="${size * 0.795}" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="${Math.round(size * 0.06)}" fill="${INK}">${escapeXml(recipient)}</text>
  ${opts.recipientEmail ? `<text x="50%" y="${size * 0.825}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="${Math.round(size * 0.018)}" fill="${INK_FAINT}">${escapeXml(opts.recipientEmail)}</text>` : ""}
  ${verifiedUrlBlock}
  <text x="50%" y="${dateY}" text-anchor="middle" font-family="ui-monospace, monospace" font-weight="600" font-size="${Math.round(size * 0.016)}" fill="${INK_SOFT}">${escapeXml(DATE_LINE)}</text>
  <text x="50%" y="${valueY}" text-anchor="middle" font-family="ui-monospace, monospace" font-weight="600" font-size="${Math.round(size * 0.026)}" fill="${INK}">${escapeXml(unlocked)}</text>
  <image href="${markDataUrl}" x="${markX}" y="${markY}" width="${markW}" height="${markH}" preserveAspectRatio="xMidYMid meet"/>
  <text x="${size - inset - 8}" y="${size - inset - 12}" text-anchor="end" font-family="ui-monospace, monospace" font-size="${Math.round(size * 0.015)}" fill="${INK_FAINT}">CERT ID  ${escapeXml(id)}</text>
  <text x="${inset + 8}" y="${size - inset - 12}" font-family="ui-monospace, monospace" font-size="${Math.round(size * 0.015)}" fill="${INK_FAINT}">atanda.command-centre</text>
</svg>`;
}

export async function downloadBadgeCertificate(opts: BadgeCertificateOptions): Promise<void> {
  if (opts.format === "svg") {
    const svg = await buildSvg(opts);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    downloadBlob(blob, safeFilename(opts.badgeId, opts.recipientName, "svg"));
    return;
  }
  const canvas = await renderCanvas(opts);
  const mime = opts.format === "jpeg" ? "image/jpeg" : "image/png";
  const ext = opts.format === "jpeg" ? "jpg" : "png";
  const quality = opts.format === "jpeg" ? 0.92 : undefined;
  const dataUrl = canvas.toDataURL(mime, quality);
  const blob = dataUrlToBlob(dataUrl);
  downloadBlob(blob, safeFilename(opts.badgeId, opts.recipientName, ext));
}
