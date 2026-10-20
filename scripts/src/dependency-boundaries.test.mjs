import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const apiPackage = new URL("../../artifacts/api-server/package.json", import.meta.url);
const apiRequire = createRequire(apiPackage);

test("proxy default literal path filter does not expand request-path braces", async () => {
  // The application has no pathFilter option, so HPM uses its literal "/" default.
  // This tests that boundary, NOT whether the installed braces package is patched.
  const entry = apiRequire.resolve("http-proxy-middleware");
  const { matchPathFilter } = await import(
    pathToFileURL(join(dirname(entry), "path-filter.js")).href
  );
  const hostilePath = "/" + "{".repeat(12_000) + "a,b" + "}".repeat(12_000);
  assert.equal(matchPathFilter(undefined, hostilePath, {}), true);
  assert.equal(matchPathFilter(undefined, "/v1/client?next=%7Ba,b%7D", {}), true);
});

test("Mammoth library extracts DOCX without loading CLI argparse or sprintf-js", () => {
  // Use an isolated process so denying CLI-only dependencies cannot affect other
  // tests. Exercise a real in-memory DOCX, not a mock of the extractor.
  const output = execFileSync(process.execPath, ["-e", `
    const { createRequire } = require("node:module");
    const Module = require("node:module");
    const load = Module._load;
    Module._load = function(id, ...args) {
      if (id === "argparse" || id === "sprintf-js") {
        throw new Error("Unexpected CLI dependency loaded: " + id);
      }
      return load.call(this, id, ...args);
    };
    const appRequire = createRequire(${JSON.stringify(apiPackage.pathname)});
    const { zipSync, strToU8 } = appRequire("fflate");
    const document = zipSync({
      "[Content_Types].xml": strToU8(
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '</Types>'
      ),
      "word/document.xml": strToU8(
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
        '<w:body><w:p><w:r><w:t>Dependency boundary check</w:t></w:r></w:p></w:body></w:document>'
      )
    });
    appRequire("mammoth").extractRawText({buffer: Buffer.from(document)})
      .then(result => {
        require("node:assert/strict").equal(result.value.trim(), "Dependency boundary check");
        console.log("DOCX_LIBRARY_ONLY_OK");
      })
      .catch(error => { console.error(error); process.exitCode = 1; });
  `], { encoding: "utf8", timeout: 15_000 });
  assert.match(output, /DOCX_LIBRARY_ONLY_OK/);
});
