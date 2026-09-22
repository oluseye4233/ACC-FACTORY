import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Orval gives a path+query operation's path schema and query type the same
// export name. Keep the generated query type under an alias so the package
// barrel can continue exporting both generated surfaces.
const here = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.resolve(here, "..", "api-zod", "src", "generated", "types", "index.ts");
const apiPath = path.resolve(here, "..", "api-zod", "src", "generated", "api.ts");
const reactApiPath = path.resolve(
  here,
  "..",
  "api-client-react",
  "src",
  "generated",
  "api.ts",
);
const reactSchemasPath = path.resolve(
  here,
  "..",
  "api-client-react",
  "src",
  "generated",
  "api.schemas.ts",
);
let source = await readFile(indexPath, "utf8");
const target = "export * from './harnessPddViewParams';";
const replacement =
  "export type { HarnessPddViewParams as PddViewFormatParams } from './harnessPddViewParams';";
if (source.includes(target)) {
  source = source.replace(target, replacement);
}

// OpenAPI's additionalProperties:false is emitted by Orval as a regular
// zod.object, whose default behaviour strips unknown keys. The v4 score
// contract must reject (rather than silently strip) a composite score field.
source = source.replace(
  /\.optional\(\)\.describe\('Optional separate axes only; composite scores are prohibited\.'\)/g,
  ".strict().optional().describe('Optional separate axes only; composite scores are prohibited.')",
);
await writeFile(indexPath, source);

let apiSource = await readFile(apiPath, "utf8");
apiSource = apiSource.replace(
  /\.optional\(\)\.describe\('Optional separate axes only; composite scores are prohibited\.'\)/g,
  ".strict().optional().describe('Optional separate axes only; composite scores are prohibited.')",
);
apiSource = apiSource.replace(
  /\}\)\.describe\('Draft output package only; composite score fields are prohibited\.'\)\.nullable\(\)/g,
  "}).strict().describe('Draft output package only; composite score fields are prohibited.').nullable()",
);
await writeFile(apiPath, `${apiSource.trimEnd()}\n`);

// Orval currently leaves several empty lines after the final generated
// operation. Keep generated output stable and diff-check clean on every
// codegen run rather than hand-editing the generated file.
const reactApiSource = await readFile(reactApiPath, "utf8");
await writeFile(reactApiPath, `${reactApiSource.trimEnd()}\n`);
const reactSchemasSource = await readFile(reactSchemasPath, "utf8");
await writeFile(reactSchemasPath, `${reactSchemasSource.trimEnd()}\n`);