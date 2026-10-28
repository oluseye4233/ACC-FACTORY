import { readFileSync } from "node:fs";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import express from "express";
import { describe, expect, it } from "vitest";
import { GetPlatformServicesResponse } from "@workspace/api-zod";
import { getPlatformServiceInventory } from "../src/lib/platform-services";
import router from "../src/routes/platform-services";

describe("go-live inventory contract", () => {
  it("covers every frozen stage/function contract exactly once", () => {
    const plan = readFileSync(new URL("../../../docs/ARK_Final_Go_Live_A_B_C_Plan_2026-10-28.md", import.meta.url), "utf8");
    const ids = [...plan.matchAll(/^\| ([SX]\d+) \|/gm)].map((match) => match[1]);
    const inventory = getPlatformServiceInventory();
    expect(inventory.totalServices).toBe(35);
    expect(inventory.stageServices).toBe(14);
    expect(inventory.supportingServices).toBe(21);
    expect(inventory.services.map((service) => service.id).sort()).toEqual(ids.sort());
    expect(new Set(ids).size).toBe(35);
    expect(inventory.services.filter((service) => service.scope === "STAGE").map((service) => service.stage))
      .toEqual(["F0", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F9.5", "F10", "F11", "F12"]);
  });

  it("validates the exact generated public response contract", () => {
    expect(GetPlatformServicesResponse.safeParse(getPlatformServiceInventory()).success).toBe(true);
  });

  it("never upgrades acceptance from request time, a source definition or an existing route", () => {
    const inventory = getPlatformServiceInventory(new Date("2026-10-28T22:00:00Z"));
    expect(inventory.generatedAt).toBe("2026-10-28T22:00:00.000Z");
    expect(inventory.localAccepted).toBe(0);
    expect(inventory.productionAccepted).toBe(0);
    for (const service of inventory.services) {
      expect(service.evidenceCheckedAt).toBeNull();
      expect(service.localAcceptance).toBe("NOT_VERIFIED");
      expect(service.productionAcceptance).toBe("NOT_VERIFIED");
      expect(service.sourceEligibility).toBe("NOT_EVALUATED");
      expect(service.entitlement).toBe("NOT_EVALUATED");
      expect(service.assessmentStatus).toBe("NOT_EVALUATED");
      expect(service.deliveryStatus).toBe("NOT_EVALUATED");
      expect(service.operationStatus).toBe("NOT_EVALUATED");
      expect(service.requiredEvidence.length).toBeGreaterThan(0);
    }
  });

  it("keeps missing F12 and protected qualifications distinct from bounded services", () => {
    const services = getPlatformServiceInventory().services;
    expect(services.find((service) => service.stage === "F12")).toMatchObject({
      implementation: "PLANNED", serviceReadiness: "PLANNED", href: null,
    });
    expect(services.find((service) => service.id === "X03")).toMatchObject({
      serviceMode: "INTERNAL", serviceReadiness: "EXISTING_UNVERIFIED",
    });
    expect(services.find((service) => service.stage === "F10")?.limitations).toMatch(/not a deployment/i);
    expect(services.find((service) => service.id === "X09")?.limitations).toMatch(/public launch requires explicit authorization/i);
    expect(services.find((service) => service.id === "S00")?.serviceReadiness).toBe("PARTIAL");
  });

  it("only links to existing application routes, not invented stage screens", () => {
    const app = readFileSync(new URL("../../command-centre/src/App.tsx", import.meta.url), "utf8");
    const routes = new Set([...app.matchAll(/<Route path="([^"]+)"/g)].map((match) => match[1]));
    for (const service of getPlatformServiceInventory().services) {
      if (service.href) expect(routes.has(service.href.split(/[?#]/)[0]), service.href).toBe(true);
    }
  });

  it("returns fresh independent snapshots", () => {
    const first = getPlatformServiceInventory();
    first.services[0].title = "changed";
    first.services[0].requiredEvidence.splice(0);
    expect(getPlatformServiceInventory().services[0].title).toBe("F0 Advisory");
    expect(getPlatformServiceInventory().services[0].requiredEvidence.length).toBeGreaterThan(0);
  });

  it("serves definitions without authentication, account data, runtime configuration or cache", async () => {
    const app = express().use("/api", router);
    const server = app.listen(0, "127.0.0.1");
    try {
      await once(server, "listening");
      const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/platform-services`);
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      const body = await response.json();
      expect(GetPlatformServicesResponse.safeParse(body).success).toBe(true);
      expect(JSON.stringify(body)).not.toMatch(/postgres(?:ql)?:\/\/|sk_live_|authorizationRef|objectKey|userId|APP_DB_PASSWORD|SESSION_SECRET/);
      expect(body.totalServices).toBe(35);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
