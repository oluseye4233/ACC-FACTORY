import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { HarnessSession } from "@workspace/db";
import { serializeSession } from "../src/routes/sessions";

function validSession(): HarnessSession {
  const now = new Date("2026-09-22T12:00:00.000Z");
  return {
    id: randomUUID(),
    userId: randomUUID(),
    sessionName: "  Planning session  ",
    status: " ACTIVE ",
    origin: "manual",
    preferredModelProvider: "claude",
    ingestionId: null,
    cartridgeId: null,
    orgId: null,
    orgVisible: false,
    createdAt: now,
    updatedAt: now,
  };
}

describe("session response contract", () => {
  it("normalizes surrounding whitespace while returning complete session records", () => {
    const response = serializeSession(validSession());

    expect(response).toMatchObject({
      sessionName: "Planning session",
      status: "ACTIVE",
      origin: "manual",
      ingestionId: null,
      cartridgeId: null,
      orgId: null,
      orgVisible: false,
    });
    expect(response.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(response.createdAt).toBe("2026-09-22T12:00:00.000Z");
    expect(response.updatedAt).toBe("2026-09-22T12:00:00.000Z");
  });

  it.each([
    ["missing identifier", { id: undefined }],
    ["invalid identifier", { id: "not-a-uuid" }],
    ["missing name", { sessionName: undefined }],
    ["blank name", { sessionName: "   " }],
    ["missing status", { status: undefined }],
    ["blank status", { status: " \t" }],
    ["invalid origin", { origin: "imported" }],
    ["invalid provider", { preferredModelProvider: "unknown" }],
    ["invalid timestamp", { createdAt: new Date("invalid") }],
    ["missing timestamp", { updatedAt: undefined }],
  ])("rejects %s before it reaches an API consumer", (_reason, partial) => {
    const malformed = { ...validSession(), ...partial } as HarnessSession;

    expect(() => serializeSession(malformed)).toThrow();
  });

  it("does not hide an invalid row by filtering it from a response", () => {
    const malformed = {
      ...validSession(),
      userId: "not-a-uuid",
    } as HarnessSession;

    expect(() => [validSession(), malformed].map(serializeSession)).toThrow();
  });
});