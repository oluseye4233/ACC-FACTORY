import { z } from "zod/v4";

export class SynthesiaError extends Error {
  constructor(public uncertain: boolean) { super("Synthesia did not confirm the request. Check the connection and provider status."); }
}
const Video = z.object({
  id: z.uuid(), callbackId: z.string().optional(), status: z.string().optional(),
  visibility: z.enum(["public", "private"]).optional(), test: z.boolean().optional(),
});
export type SynthesiaVideo = z.infer<typeof Video>;
export const synthesiaConfigured = () => Boolean(process.env.SYNTHESIA_API_KEY?.trim());
export async function synthesiaRequest(method: "POST" | "GET" | "PATCH", videoId?: string, body?: unknown): Promise<SynthesiaVideo> {
  const key = process.env.SYNTHESIA_API_KEY;
  if (!key) throw new SynthesiaError(false);
  if (videoId) z.uuid().parse(videoId);
  let response: Response;
  try {
    response = await fetch(`https://api.synthesia.io/v2/videos${videoId ? `/${videoId}` : ""}${method === "GET" ? "?includeRejected=true" : ""}`, {
      method, redirect: "error", signal: AbortSignal.timeout(20_000),
      headers: { Authorization: key, "Content-Type": "application/json", Accept: "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch { throw new SynthesiaError(true); }
  if (!response.ok) throw new SynthesiaError(response.status >= 500 || response.status === 408);
  try { return Video.parse(await response.json()); }
  catch { throw new SynthesiaError(true); }
}
