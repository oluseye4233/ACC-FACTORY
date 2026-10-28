import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { createServer } from "node:http";
import { imprimaDownloadGate } from "../src/lib/imprima-download-gate";
const app = express();
app.use(imprimaDownloadGate);
app.get("/artifact/file", (_req, res) => res.attachment("old.pdf").send("PRIVATE-ARTIFACT-BYTES"));
app.get("/artifact/stream", (_req, res) => { res.attachment("old.zip"); res.write("PRIVATE-ARTIFACT-BYTES"); res.end(); });
app.get("/me/export", (_req, res) => res.attachment("privacy.json").send("ACCOUNT-EXPORT"));
const server = createServer(app);
let base: string;
beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  base = `http://127.0.0.1:${address.port}`;
});
afterAll(() => new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve())));
describe("central publication download gate", () => {
  for (const path of ["/artifact/file", "/artifact/stream"]) it(`blocks legacy bytes at ${path}`, async () => {
    const response = await fetch(`${base}${path}`);
    expect(response.status).toBe(428);
    expect(response.headers.get("Content-Disposition")).toBeNull();
    const body = await response.text();
    expect(body).toContain("IMPRIMA_PUBLICATION_REQUIRED");
    expect(body).not.toContain("PRIVATE-ARTIFACT-BYTES");
  });
  it("preserves account privacy exports", async () => {
    const response = await fetch(`${base}/me/export`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ACCOUNT-EXPORT");
  });
});
