import badgeBg from "@assets/copilot_image_1779143975171_1779147194124.jpeg";

export type BadgeFormat = "png" | "jpeg" | "svg";

export interface BadgeCertificateOptions {
  badgeId: "ASPE" | "AISA" | "AISE";
  badgeFullName: string;
  description: string;
  recipientName: string;
  recipientEmail?: string | null;
  unlockedAt?: string | null;
  format: BadgeFormat;
}

const CANVAS_SIZE = 1400;
const PRODUCT_LINE = "ATANDA COMMAND CENTRE";
const ISSUER_LINE = "FORGE.BONSAI HARNESS";
const TAGLINE = "AWARDED TO";
const DATE_LINE = "UNLOCKED ON";

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

async function renderCanvas(opts: BadgeCertificateOptions): Promise<HTMLCanvasElement> {
  const size = CANVAS_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // Background image, full bleed with center-crop "cover" math.
  const bg = await loadImage(badgeBg);
  const scale = Math.max(size / bg.width, size / bg.height);
  const drawW = bg.width * scale;
  const drawH = bg.height * scale;
  const dx = (size - drawW) / 2;
  const dy = (size - drawH) / 2;
  ctx.drawImage(bg, dx, dy, drawW, drawH);

  // Dark vignette overlay so text reads.
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, "rgba(8, 10, 16, 0.55)");
  grad.addColorStop(0.45, "rgba(8, 10, 16, 0.35)");
  grad.addColorStop(1, "rgba(8, 10, 16, 0.85)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Gold border frame.
  const border = Math.round(size * 0.018);
  ctx.strokeStyle = "rgba(234, 200, 84, 0.85)";
  ctx.lineWidth = border;
  ctx.strokeRect(border / 2, border / 2, size - border, size - border);

  // Inner thin line.
  ctx.strokeStyle = "rgba(234, 200, 84, 0.35)";
  ctx.lineWidth = 2;
  const inset = Math.round(size * 0.045);
  ctx.strokeRect(inset, inset, size - inset * 2, size - inset * 2);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const cx = size / 2;

  // Top: product line.
  ctx.fillStyle = "rgba(234, 200, 84, 0.85)";
  ctx.font = `600 ${Math.round(size * 0.022)}px ui-monospace, "SFMono-Regular", Menlo, monospace`;
  ctx.fillText(PRODUCT_LINE, cx, size * 0.13);

  ctx.fillStyle = "rgba(220, 220, 220, 0.55)";
  ctx.font = `400 ${Math.round(size * 0.014)}px ui-monospace, monospace`;
  ctx.fillText(ISSUER_LINE, cx, size * 0.16);

  // Big badge code.
  ctx.fillStyle = "#FFE07A";
  ctx.font = `800 ${Math.round(size * 0.22)}px "Georgia", "Times New Roman", serif`;
  ctx.fillText(opts.badgeId, cx, size * 0.42);

  // Badge full name underneath.
  ctx.fillStyle = "rgba(245, 245, 245, 0.92)";
  ctx.font = `600 ${Math.round(size * 0.028)}px ui-monospace, monospace`;
  ctx.fillText(opts.badgeFullName.toUpperCase(), cx, size * 0.48);

  // Description (wrapped, italic serif).
  ctx.fillStyle = "rgba(220, 220, 220, 0.75)";
  ctx.font = `italic 400 ${Math.round(size * 0.02)}px Georgia, serif`;
  const descLines = wrapText(ctx, opts.description, size * 0.72);
  let lineY = size * 0.54;
  for (const line of descLines.slice(0, 3)) {
    ctx.fillText(line, cx, lineY);
    lineY += size * 0.028;
  }

  // Divider.
  ctx.strokeStyle = "rgba(234, 200, 84, 0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.18, size * 0.66);
  ctx.lineTo(cx + size * 0.18, size * 0.66);
  ctx.stroke();

  // "AWARDED TO" label.
  ctx.fillStyle = "rgba(234, 200, 84, 0.8)";
  ctx.font = `600 ${Math.round(size * 0.018)}px ui-monospace, monospace`;
  ctx.fillText(TAGLINE, cx, size * 0.71);

  // Recipient name.
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `700 ${Math.round(size * 0.06)}px "Georgia", serif`;
  const recipient = opts.recipientName.trim() || "Operator";
  const maxNameWidth = size * 0.82;
  let nameFontPx = Math.round(size * 0.06);
  while (ctx.measureText(recipient).width > maxNameWidth && nameFontPx > 24) {
    nameFontPx -= 2;
    ctx.font = `700 ${nameFontPx}px "Georgia", serif`;
  }
  ctx.fillText(recipient, cx, size * 0.78);

  // Optional email subline.
  if (opts.recipientEmail) {
    ctx.fillStyle = "rgba(220, 220, 220, 0.6)";
    ctx.font = `400 ${Math.round(size * 0.018)}px ui-monospace, monospace`;
    ctx.fillText(opts.recipientEmail, cx, size * 0.815);
  }

  // Date + ID footer.
  const unlocked = formatDate(opts.unlockedAt);
  const id = shortId(opts.badgeId, recipient, unlocked);

  ctx.fillStyle = "rgba(234, 200, 84, 0.7)";
  ctx.font = `600 ${Math.round(size * 0.016)}px ui-monospace, monospace`;
  ctx.fillText(DATE_LINE, cx, size * 0.88);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `600 ${Math.round(size * 0.026)}px ui-monospace, monospace`;
  ctx.fillText(unlocked, cx, size * 0.915);

  ctx.fillStyle = "rgba(220, 220, 220, 0.55)";
  ctx.font = `400 ${Math.round(size * 0.015)}px ui-monospace, monospace`;
  ctx.textAlign = "right";
  ctx.fillText(`CERT ID  ${id}`, size - inset - 8, size - inset - 12);
  ctx.textAlign = "left";
  ctx.fillText("atanda.command-centre", inset + 8, size - inset - 12);

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
  const bgDataUrl = await fetchAsDataUrl(badgeBg);
  const unlocked = formatDate(opts.unlockedAt);
  const recipient = opts.recipientName.trim() || "Operator";
  const id = shortId(opts.badgeId, recipient, unlocked);
  const inset = Math.round(size * 0.045);
  const border = Math.round(size * 0.018);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="vignette" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(8,10,16,0.55)"/>
      <stop offset="45%" stop-color="rgba(8,10,16,0.35)"/>
      <stop offset="100%" stop-color="rgba(8,10,16,0.85)"/>
    </linearGradient>
  </defs>
  <image href="${bgDataUrl}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice"/>
  <rect x="0" y="0" width="${size}" height="${size}" fill="url(#vignette)"/>
  <rect x="${border / 2}" y="${border / 2}" width="${size - border}" height="${size - border}" fill="none" stroke="rgba(234,200,84,0.85)" stroke-width="${border}"/>
  <rect x="${inset}" y="${inset}" width="${size - inset * 2}" height="${size - inset * 2}" fill="none" stroke="rgba(234,200,84,0.35)" stroke-width="2"/>
  <text x="50%" y="${size * 0.13}" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-weight="600" font-size="${Math.round(size * 0.022)}" fill="rgba(234,200,84,0.85)">${escapeXml(PRODUCT_LINE)}</text>
  <text x="50%" y="${size * 0.16}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="${Math.round(size * 0.014)}" fill="rgba(220,220,220,0.55)">${escapeXml(ISSUER_LINE)}</text>
  <text x="50%" y="${size * 0.42}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="800" font-size="${Math.round(size * 0.22)}" fill="#FFE07A">${escapeXml(opts.badgeId)}</text>
  <text x="50%" y="${size * 0.48}" text-anchor="middle" font-family="ui-monospace, monospace" font-weight="600" font-size="${Math.round(size * 0.028)}" fill="rgba(245,245,245,0.92)">${escapeXml(opts.badgeFullName.toUpperCase())}</text>
  <text x="50%" y="${size * 0.54}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="${Math.round(size * 0.02)}" fill="rgba(220,220,220,0.75)">${escapeXml(opts.description)}</text>
  <line x1="${size * 0.32}" y1="${size * 0.66}" x2="${size * 0.68}" y2="${size * 0.66}" stroke="rgba(234,200,84,0.6)" stroke-width="2"/>
  <text x="50%" y="${size * 0.71}" text-anchor="middle" font-family="ui-monospace, monospace" font-weight="600" font-size="${Math.round(size * 0.018)}" fill="rgba(234,200,84,0.8)">${escapeXml(TAGLINE)}</text>
  <text x="50%" y="${size * 0.78}" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="${Math.round(size * 0.06)}" fill="#FFFFFF">${escapeXml(recipient)}</text>
  ${opts.recipientEmail ? `<text x="50%" y="${size * 0.815}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="${Math.round(size * 0.018)}" fill="rgba(220,220,220,0.6)">${escapeXml(opts.recipientEmail)}</text>` : ""}
  <text x="50%" y="${size * 0.88}" text-anchor="middle" font-family="ui-monospace, monospace" font-weight="600" font-size="${Math.round(size * 0.016)}" fill="rgba(234,200,84,0.7)">${escapeXml(DATE_LINE)}</text>
  <text x="50%" y="${size * 0.915}" text-anchor="middle" font-family="ui-monospace, monospace" font-weight="600" font-size="${Math.round(size * 0.026)}" fill="#FFFFFF">${escapeXml(unlocked)}</text>
  <text x="${size - inset - 8}" y="${size - inset - 12}" text-anchor="end" font-family="ui-monospace, monospace" font-size="${Math.round(size * 0.015)}" fill="rgba(220,220,220,0.55)">CERT ID  ${escapeXml(id)}</text>
  <text x="${inset + 8}" y="${size - inset - 12}" font-family="ui-monospace, monospace" font-size="${Math.round(size * 0.015)}" fill="rgba(220,220,220,0.55)">atanda.command-centre</text>
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
