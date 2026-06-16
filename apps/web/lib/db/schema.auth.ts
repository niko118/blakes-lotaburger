import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  index,
  text,
  jsonb,
} from "drizzle-orm/pg-core";

/**
 * Roles table
 *
 * Stores custom roles with permission arrays.
 */
export const appRoles = pgTable(
  "app_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    description: text("description"),
    permissions: jsonb("permissions").notNull().default("[]"), // Array of permission strings
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    nameIdx: index("app_roles_name_idx").on(table.name),
  })
);

/**
 * Users table
 *
 * Stores application users with credentials authentication.
 */
export const appUsers = pgTable(
  "app_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }),
    passwordHash: varchar("password_hash", { length: 255 }), // bcrypt hash
    isAdmin: boolean("is_admin").notNull().default(false),
    roleId: uuid("role_id"), // References app_roles.id (no FK constraint)
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: index("app_users_email_idx").on(table.email),
    roleIdIdx: index("app_users_role_id_idx").on(table.roleId),
  })
);

export type AppRole = typeof appRoles.$inferSelect;
export type NewAppRole = typeof appRoles.$inferInsert;
export type AppUser = typeof appUsers.$inferSelect;
export type NewAppUser = typeof appUsers.$inferInsert;
