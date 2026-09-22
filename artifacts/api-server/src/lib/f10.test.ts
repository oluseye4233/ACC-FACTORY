import { describe, expect, it } from "vitest";
import { deterministicIdempotencyKey, validateHttpsDestination, verifyPrerequisites } from "./f10";

const envelope = {
  machine_artifact_id: "a", mecha_run_id: "r", artifact_version: "1", media_type: "application/json",
  ucg_certificate: { verdict: "PASS", expires_at: "2099-01-01T00:00:00Z", signature: "sig" },
  spk_id: "spk", payload_hash: "a".repeat(64), artifact_signature: "sig",
  osiris_custody_attestation: { osiris_custody: true, expires_at: "2099-01-01T00:00:00Z", signature: "sig" },
};
describe("F10 boundary", () => {
  it("rejects non-HTTPS and private destinations, including DNS rebinding answers", async () => {
    await expect(validateHttpsDestination("http://example.com")).rejects.toThrow();
    await expect(validateHttpsDestination("https://127.0.0.1")).rejects.toThrow();
    await expect(validateHttpsDestination("https://[::1]")).rejects.toThrow();
    await expect(validateHttpsDestination("https://[::ffff:127.0.0.1]")).rejects.toThrow();
    await expect(validateHttpsDestination("https://target.example", async () => ["2001:db8::1"])).rejects.toThrow();
    await expect(validateHttpsDestination("https://target.example", async () => ["93.184.216.34", "10.0.0.4"])).rejects.toThrow();
  });
  it("derives stable logical delivery identity without bytes", () => {
    expect(deterministicIdempotencyKey("sha256:x", "tenant-dest", "intent"))
      .toBe(deterministicIdempotencyKey("sha256:x", "tenant-dest", "intent"));
    expect(deterministicIdempotencyKey("sha256:x", "tenant-dest", "intent"))
      .not.toBe(deterministicIdempotencyKey("sha256:y", "tenant-dest", "intent"));
  });
  it("blocks invalid custody, expiry and verdict before adapter I/O", () => {
    expect(verifyPrerequisites({ ...envelope, ucg_certificate: { ...envelope.ucg_certificate, verdict: "FAIL" } })).toContain("UCG verdict is not passing");
    expect(verifyPrerequisites({ ...envelope, osiris_custody_attestation: { ...envelope.osiris_custody_attestation, osiris_custody: false } })).toContain("OSIRIS custody is not active");
  });
});