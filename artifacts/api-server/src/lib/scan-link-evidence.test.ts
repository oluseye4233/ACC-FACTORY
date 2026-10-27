import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
const mocks = vi.hoisted(() => ({ resolve: vi.fn(), get: vi.fn() }));
vi.mock("./f10", () => ({ resolveHttpsDestination: mocks.resolve }));
vi.mock("node:https", () => ({ default: { get: mocks.get } }));
import { collectScanLink, parseScanLinks } from "./scan-link-evidence";
beforeEach(() => vi.clearAllMocks());
describe("SCAN URL evidence boundaries", () => {
  it("normalizes and deduplicates without following fragments", () => {
    expect(parseScanLinks([" https://github.com/org/repo#readme ", "https://github.com/org/repo"])).toEqual(["https://github.com/org/repo"]);
  });
  it.each(["file:///etc/passwd", "ftp://example.com", "https://u:p@example.com", "https://example.com?api_key=secret"])(
    "rejects %s", url => expect(() => parseScanLinks([url])).toThrow(),
  );
  it("retains local HTTP references without DNS or network requests", async () => {
    expect(await collectScanLink("http://localhost:3000/")).toMatchObject({ status: "REFERENCE_ONLY" });
    expect(mocks.resolve).not.toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("never connects when HTTPS destination validation rejects private DNS", async () => {
    mocks.resolve.mockRejectedValue(new Error("private address"));
    expect(await collectScanLink("https://private.example/")).toMatchObject({ status: "UNAVAILABLE" });
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("pins the checked public address and strips executable page content", async () => {
    mocks.resolve.mockResolvedValue({ url: new URL("https://example.com/"), address: "93.184.216.34", family: 4 });
    mocks.get.mockImplementation((_url, options, callback) => {
      expect(options.family).toBe(4);
      const req = Object.assign(new EventEmitter(), { destroy: vi.fn() });
      const page = Object.assign(new EventEmitter(), {
        statusCode: 200, headers: { "content-type": "text/html" }, destroy: vi.fn(),
      });
      const dnsCallback = vi.fn();
      options.lookup("example.com", {}, dnsCallback);
      expect(dnsCallback).toHaveBeenCalledWith(null, "93.184.216.34", 4);
      queueMicrotask(() => {
        callback(page);
        page.emit("data", Buffer.from("<h1>Visible evidence</h1><script>privateInstruction()</script>"));
        page.emit("end"); req.emit("close");
      });
      return req;
    });
    const result = await collectScanLink("https://example.com/");
    expect(result.status).toBe("FETCHED");
    expect(result.text).toContain("Visible evidence");
    expect(result.text).not.toContain("privateInstruction");
  });
  it("does not follow redirects to another destination", async () => {
    mocks.resolve.mockResolvedValue({ url: new URL("https://example.com/"), address: "93.184.216.34", family: 4 });
    mocks.get.mockImplementation((_url, _options, callback) => {
      const req = Object.assign(new EventEmitter(), { destroy: vi.fn() });
      queueMicrotask(() => {
        callback({ statusCode: 302, headers: { location: "http://127.0.0.1/" }, resume: vi.fn() });
        req.emit("close");
      });
      return req;
    });
    expect(await collectScanLink("https://example.com/")).toMatchObject({ status: "UNAVAILABLE" });
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });
});
