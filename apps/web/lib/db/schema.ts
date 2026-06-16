import {
  pgTable,
  integer,
  varchar,
  timestamp,
  index,
  text,
  serial,
} from "drizzle-orm/pg-core";

/**
 * API Credentials table
 *
 * Stores encrypted OAuth tokens for external API integrations.
 * Supports refresh token rotation and access token caching.
 */
export const apiCredentials = pgTable(
  "api_credentials",
  {
    id: serial("id").primaryKey(),
    integrationId: varchar("integration_id", { length: 100 }).notNull().unique(),
    integrationName: varchar("integration_name", { length: 255 }),

    // Encrypted tokens (AES-GCM)
    refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
    refreshTokenFingerprint: varchar("refresh_token_fingerprint", {
      length: 64,
    }),
    refreshExpiresAt: timestamp("refresh_expires_at"),
    accessTokenEncrypted: text("access_token_encrypted"),
    accessExpiresAt: timestamp("access_expires_at"),

    // Metadata
    lastAccessTtlSeconds: integer("last_access_ttl_seconds"),
    lastRefreshedAt: timestamp("last_refreshed_at"),
    rotatedAt: timestamp("rotated_at"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    integrationIdIdx: index("api_credentials_integration_id_idx").on(
      table.integrationId
    ),
  })
);

export type ApiCredential = typeof apiCredentials.$inferSelect;
export type NewApiCredential = typeof apiCredentials.$inferInsert;

// Re-export auth schema
export * from "./schema.auth";
