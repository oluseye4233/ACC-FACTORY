import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { configureRequestBodyParsers } from "../src/middlewares/requestBody";

describe("production request body limits", () => {
  let server: ReturnType<ReturnType<typeof express>["listen"]>;
  let base: string;
  beforeAll(async () => {
    const app = express();
    configureRequestBodyParsers(app);
    app.post("/api/integrations/github/push-codebase", (req, res) => { res.json({ length: req.body.content.length }); });
    app.post("/api/ordinary", (_req, res) => { res.json({ ok: true }); });
    server = app.listen(0);
    await new Promise<void>(resolve => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as import("node:net").AddressInfo).port}`;
  });
  afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve())); });
  const post = (path: string, body: string) => fetch(`${base}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body,
  });
  it("accepts GitHub bodies larger than the default 100 KB", async () => {
    const res = await post("/api/integrations/github/push-codebase", JSON.stringify({ content: "x".repeat(150_000) }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ length: 150_000 });
  });
  it("accepts JSON escaping overhead for a valid 2 MB source", async () => {
    const res = await post("/api/integrations/github/push-codebase", JSON.stringify({ content: "\u0000".repeat(2_000_000) }));
    expect(res.status).toBe(200);
  });
  it("does not increase limits for unrelated endpoints", async () => {
    const res = await post("/api/ordinary", JSON.stringify({ content: "x".repeat(150_000) }));
    expect(res.status).toBe(413);
    expect((await res.json()).code).toBe("REQUEST_TOO_LARGE");
  });
  it("returns JSON for a GitHub transport overflow", async () => {
    const res = await post("/api/integrations/github/push-codebase", JSON.stringify({ content: "x".repeat(17 * 1024 * 1024) }));
    expect(res.status).toBe(413);
    expect((await res.json()).code).toBe("REQUEST_TOO_LARGE");
  });
  it("returns JSON for malformed input", async () => {
    const res = await post("/api/ordinary", "{");
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_JSON");
  });
});
