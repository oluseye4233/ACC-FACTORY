export type SseEvent = { event: string; data: unknown };

export async function streamSse(
  url: string,
  body: unknown,
  onEvent: (e: SseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err: Error & { status?: number; payload?: unknown } = new Error(
      `SSE request failed: ${res.status}`,
    );
    err.status = res.status;
    try {
      err.payload = JSON.parse(text);
    } catch {
      err.payload = text;
    }
    throw err;
  }

  if (!res.body) throw new Error("SSE response has no body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const drainFrame = (frame: string) => {
    if (!frame) return;
    let eventName = "message";
    const dataLines: string[] = [];
    for (const raw of frame.split("\n")) {
      const line = raw.replace(/\r$/, "");
      if (line.startsWith(":")) continue;
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
    }
    if (dataLines.length === 0) return;
    const dataStr = dataLines.join("\n");
    let parsed: unknown = dataStr;
    try {
      parsed = JSON.parse(dataStr);
    } catch {
      /* keep as string */
    }
    onEvent({ event: eventName, data: parsed });
  };

  const flushPending = () => {
    const re = /\r?\n\r?\n/;
    let match: RegExpExecArray | null;
    while ((match = re.exec(buffer))) {
      const frame = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + match[0].length);
      drainFrame(frame);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    flushPending();
  }
  buffer += decoder.decode();
  flushPending();
  if (buffer.trim()) drainFrame(buffer);
}

export function extractApiError(err: unknown): {
  status?: number;
  message: string;
} {
  if (err && typeof err === "object") {
    const anyErr = err as {
      status?: number;
      message?: string;
      payload?: { error?: string; message?: string };
    };
    const msg =
      anyErr.payload?.error ??
      anyErr.payload?.message ??
      anyErr.message ??
      "Unknown error";
    return { status: anyErr.status, message: String(msg) };
  }
  return { message: String(err) };
}
