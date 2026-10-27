import https from "node:https";
import { resolveHttpsDestination } from "./f10";

export function parseScanLinks(links: string[]): string[] {
  return [...new Set(links.map(raw => {
    const url = new URL(raw.trim());
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
      throw new Error("Use HTTP/HTTPS links without embedded usernames or passwords");
    }
    for (const key of url.searchParams.keys()) {
      if (/token|secret|password|signature|api[_-]?key/i.test(key)) {
        throw new Error("Do not submit credential-bearing or signed private URLs");
      }
    }
    url.hash = "";
    return url.href;
  }))];
}

export type ScanLinkEvidence = {
  url: string; status: "FETCHED" | "REFERENCE_ONLY" | "UNAVAILABLE";
  coverage: string; text?: string;
};

export async function collectScanLink(url: string): Promise<ScanLinkEvidence> {
  if (!url.startsWith("https:")) return {
    url, status: "REFERENCE_ONLY",
    coverage: "HTTP/local reference retained, not fetched. Use a public HTTPS tunnel for live inspection. No application or code was verified.",
  };
  try {
    // Reuse the release gateway's private/reserved-address checks. Pin the exact
    // checked DNS address; do not follow redirects or forward authentication.
    const checked = await resolveHttpsDestination(url);
    const text = await new Promise<string>((resolve, reject) => {
      const request = https.get(checked.url, {
        family: checked.family,
        headers: { "user-agent": "ATANDA-ATLAS-SCAN/1.0", accept: "text/html,text/plain,text/markdown,application/json", "accept-encoding": "identity" },
        lookup: (_host, _options, callback) => callback(null, checked.address, checked.family),
      }, response => {
        if (response.statusCode !== 200) {
          response.resume(); reject(new Error(`HTTP ${response.statusCode}; redirects and authenticated pages are not followed`)); return;
        }
        const contentType = String(response.headers["content-type"] ?? "");
        if (!/^(text\/|application\/json)/i.test(contentType)) {
          response.destroy(); reject(new Error("Only text pages can be inspected")); return;
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 256 * 1024) {
            response.destroy(new Error("Page exceeds the 256 KiB evidence limit")); return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")
          .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 12000)));
        response.on("error", reject);
      });
      const deadline = setTimeout(() => request.destroy(new Error("Page retrieval timed out")), 12000);
      request.on("close", () => clearTimeout(deadline));
      request.on("error", reject);
    });
    return { url, status: "FETCHED", coverage: "Read-only page snapshot, capped at 12,000 text characters. Repository pages do not constitute a full source-code audit; no scripts, tests or local services were executed.", text };
  } catch {
    return { url, status: "UNAVAILABLE", coverage: "Not inspected: private/local address, unsupported port, retrieval failure, redirect, login requirement or oversized page. Provide a public HTTPS page or supporting context. No verification is implied." };
  }
}
