// drizzle-kit must NEVER manage the ARK security schemas. `push` diffs the
// database against TypeScript and would drop policies and triggers it does not
// know about. schemaFilter keeps drizzle-kit inside `public`.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./shared/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
  schemaFilter: ["public"],          // NOT imprima, short_sprints, app or ark_meta
});
