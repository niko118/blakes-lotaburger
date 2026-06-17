import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

/**
 * Report group hierarchy for financial report output structure.
 * Top-level entries (parentId = null) are sections (e.g. "Sales", "Food Cost").
 * Children are groups that map to output line items in Summary P&L.
 */
export const reportGroups = pgTable(
  "report_groups",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    parentId: integer("parent_id"), // null = top-level section
    reportType: varchar("report_type", { length: 20 }).notNull(), // 'pnl' | 'bs'
    sortOrder: integer("sort_order").notNull(),
    // When true, the report emits an intermediate subtotal of the section
    // accumulated up to and including this group (e.g. "Total Food Cost" for
    // raw food only, before Beverage Cost and Freight are added).
    subtotalAfter: boolean("subtotal_after").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    reportTypeIdx: index("report_groups_report_type_idx").on(table.reportType),
    parentIdIdx: index("report_groups_parent_id_idx").on(table.parentId),
  })
);

/**
 * Maps atomic R365 account names to report groups.
 * An unmapped account (groupId = null, ignored = false) triggers a warning
 * that blocks report generation until resolved.
 */
export const accountMappings = pgTable(
  "account_mappings",
  {
    id: serial("id").primaryKey(),
    accountName: varchar("account_name", { length: 500 }).notNull().unique(),
    groupId: integer("group_id"), // null = unmapped
    // Statement the account belongs to ('pnl' | 'bs'). Set from the source file
    // on import; lets unmapped accounts be classified before they have a group.
    reportType: varchar("report_type", { length: 20 }),
    ignored: boolean("ignored").notNull().default(false), // explicitly excluded from reports
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    accountNameIdx: index("account_mappings_account_name_idx").on(table.accountName),
    groupIdIdx: index("account_mappings_group_id_idx").on(table.groupId),
  })
);

export type ReportGroup = typeof reportGroups.$inferSelect;
export type NewReportGroup = typeof reportGroups.$inferInsert;
export type AccountMapping = typeof accountMappings.$inferSelect;
export type NewAccountMapping = typeof accountMappings.$inferInsert;
