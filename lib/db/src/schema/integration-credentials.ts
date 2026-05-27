import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Per-user credentials for outbound third-party integrations
 * (e.g. publishing an SPC to Ark.Onecraft Sphinx Marketplace).
 *
 * The API key is stored as `enc:<iv-hex>:<ciphertext-hex>:<authTag-hex>`,
 * encrypted with AES-256-GCM using a key derived from SESSION_SECRET.
 * Only the first 8 chars of the plaintext are kept verbatim in `keyPrefix`
 * so the UI can render `sphinx_live_••••••a3f2` without ever decrypting.
 *
 * `lastListingMetadata` is an opaque JSON blob the provider returns
 * after a successful publish (e.g. `{listingId, listingUrl}`). It is per
 * credential, not per artifact — per-artifact listing pointers live on
 * `harness_artifacts.artifactContent.sphinxListing`.
 */
export const INTEGRATION_PROVIDERS = ["sphinx"] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export const integrationCredentialsTable = pgTable(
  "integration_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().$type<IntegrationProvider>(),
    label: text("label"),
    keyPrefix: text("key_prefix").notNull(),
    keyEncrypted: text("key_encrypted").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    userProviderUniq: uniqueIndex("integration_credentials_user_provider_uniq").on(
      t.userId,
      t.provider,
    ),
    userIdx: index("integration_credentials_user_id_idx").on(t.userId),
  }),
);

export type IntegrationCredential = typeof integrationCredentialsTable.$inferSelect;
