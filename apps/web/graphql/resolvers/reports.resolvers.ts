import { GraphQLError } from "graphql";
import { db } from "@lib/server/db";
import { reportGroups, accountMappings } from "@lib/db/schema";
import { eq, isNull, and, inArray, max, count } from "drizzle-orm";
import type { Context } from "../types";

export const reportsResolvers = {
  Query: {
    reportGroups: async (_: unknown, { reportType }: { reportType?: string }, ctx: Context) => {
      ctx.session; // auth required
      const where = reportType ? eq(reportGroups.reportType, reportType) : undefined;
      const rows = where
        ? await db.select().from(reportGroups).where(where).orderBy(reportGroups.sortOrder)
        : await db.select().from(reportGroups).orderBy(reportGroups.sortOrder);

      // Return only top-level sections; children resolved via field resolver
      return rows.filter((r) => r.parentId === null);
    },

    accountMappings: async (
      _: unknown,
      { groupId, unmappedOnly }: { groupId?: number; unmappedOnly?: boolean },
      ctx: Context
    ) => {
      ctx.session;
      if (unmappedOnly) {
        return db
          .select()
          .from(accountMappings)
          .where(and(isNull(accountMappings.groupId), eq(accountMappings.ignored, false)))
          .orderBy(accountMappings.accountName);
      }
      if (groupId !== undefined) {
        return db
          .select()
          .from(accountMappings)
          .where(eq(accountMappings.groupId, groupId))
          .orderBy(accountMappings.accountName);
      }
      return db.select().from(accountMappings).orderBy(accountMappings.accountName);
    },

    checkAccountMappings: async (
      _: unknown,
      { accountNames }: { accountNames: string[] },
      ctx: Context
    ) => {
      ctx.session;
      if (accountNames.length === 0) {
        return { unmappedAccounts: [], totalChecked: 0 };
      }

      const existing = await db
        .select({ accountName: accountMappings.accountName, groupId: accountMappings.groupId, ignored: accountMappings.ignored })
        .from(accountMappings)
        .where(inArray(accountMappings.accountName, accountNames));

      const knownMap = new Map(existing.map((r) => [r.accountName, r]));
      const unmappedAccounts: string[] = [];

      for (const name of accountNames) {
        const entry = knownMap.get(name);
        if (!entry) {
          unmappedAccounts.push(name); // not in DB at all
        } else if (!entry.ignored && entry.groupId === null) {
          unmappedAccounts.push(name); // in DB but not assigned and not ignored
        }
      }

      return { unmappedAccounts, totalChecked: accountNames.length };
    },
  },

  Mutation: {
    createReportGroup: async (
      _: unknown,
      { input }: { input: { name: string; parentId?: number | null; reportType: string; sortOrder?: number | null; subtotalAfter?: boolean } },
      ctx: Context
    ) => {
      ctx.session;
      // If sortOrder not provided, append after existing siblings
      let sortOrder = input.sortOrder ?? null;
      if (sortOrder === null) {
        const [agg] = await db
          .select({ maxSort: max(reportGroups.sortOrder) })
          .from(reportGroups)
          .where(
            input.parentId
              ? eq(reportGroups.parentId, input.parentId)
              : isNull(reportGroups.parentId)
          );
        sortOrder = (agg?.maxSort ?? 0) + 10;
      }

      const [created] = await db
        .insert(reportGroups)
        .values({
          name: input.name,
          parentId: input.parentId ?? null,
          reportType: input.reportType,
          sortOrder,
          subtotalAfter: input.subtotalAfter ?? false,
        })
        .returning();
      return created;
    },

    updateReportGroup: async (
      _: unknown,
      { id, input }: { id: string; input: { name?: string; parentId?: number | null; sortOrder?: number; subtotalAfter?: boolean } },
      ctx: Context
    ) => {
      ctx.session;
      const patch: Partial<typeof reportGroups.$inferInsert> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.parentId !== undefined) patch.parentId = input.parentId;
      if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
      if (input.subtotalAfter !== undefined) patch.subtotalAfter = input.subtotalAfter;

      const [updated] = await db
        .update(reportGroups)
        .set(patch)
        .where(eq(reportGroups.id, Number(id)))
        .returning();
      return updated;
    },

    // Persist drag-and-drop reordering. Each item carries its new sortOrder;
    // parentId is set only when provided (group moved to another section).
    reorderReportGroups: async (
      _: unknown,
      { items }: { items: { id: string; sortOrder: number; parentId?: number | null }[] },
      ctx: Context
    ) => {
      ctx.session;
      if (items.length === 0) return true;

      await db.transaction(async (tx) => {
        for (const item of items) {
          const patch: Partial<typeof reportGroups.$inferInsert> = { sortOrder: item.sortOrder };
          if (item.parentId !== undefined) patch.parentId = item.parentId;
          await tx
            .update(reportGroups)
            .set(patch)
            .where(eq(reportGroups.id, Number(item.id)));
        }
      });

      return true;
    },

    deleteReportGroup: async (
      _: unknown,
      { id }: { id: string },
      ctx: Context
    ) => {
      ctx.session;
      const numId = Number(id);

      // For leaf groups: block if any accounts are mapped to it
      const [{ mappedCount }] = await db
        .select({ mappedCount: count() })
        .from(accountMappings)
        .where(eq(accountMappings.groupId, numId));

      if (mappedCount > 0) {
        throw new GraphQLError(
          `Cannot delete: ${mappedCount} account${mappedCount === 1 ? " is" : "s are"} mapped to this group. Re-assign or ignore them first.`,
          { extensions: { code: "LINKED_ACCOUNTS" } }
        );
      }

      // For sections: block if any child group has mapped accounts
      const children = await db
        .select({ id: reportGroups.id })
        .from(reportGroups)
        .where(eq(reportGroups.parentId, numId));

      if (children.length > 0) {
        const childIds = children.map((c) => c.id);
        const [{ childMapped }] = await db
          .select({ childMapped: count() })
          .from(accountMappings)
          .where(inArray(accountMappings.groupId, childIds));

        if (childMapped > 0) {
          throw new GraphQLError(
            `Cannot delete: ${childMapped} account${childMapped === 1 ? " is" : "s are"} mapped to groups inside this section. Re-assign or ignore them first.`,
            { extensions: { code: "LINKED_ACCOUNTS" } }
          );
        }

        // Safe to delete children (no linked accounts)
        await db.delete(reportGroups).where(inArray(reportGroups.id, childIds));
      }

      await db.delete(reportGroups).where(eq(reportGroups.id, numId));
      return true;
    },

    updateAccountMapping: async (
      _: unknown,
      { accountName, input }: { accountName: string; input: { groupId?: number | null; ignored?: boolean } },
      ctx: Context
    ) => {
      ctx.session;
      const now = new Date();

      // When a group is assigned, sync the account's statement to that group's
      // reportType so a mapped account is always classified consistently with
      // its group (a group can only belong to one statement).
      let reportType: string | undefined;
      if (input.groupId != null) {
        const [group] = await db
          .select({ reportType: reportGroups.reportType })
          .from(reportGroups)
          .where(eq(reportGroups.id, input.groupId))
          .limit(1);
        reportType = group?.reportType;
      }

      const [result] = await db
        .insert(accountMappings)
        .values({
          accountName,
          groupId: input.groupId ?? null,
          ignored: input.ignored ?? false,
          ...(reportType ? { reportType } : {}),
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: accountMappings.accountName,
          set: {
            groupId: input.groupId ?? null,
            ignored: input.ignored ?? false,
            ...(reportType ? { reportType } : {}),
            updatedAt: now,
          },
        })
        .returning();
      return result;
    },
  },

  // Field resolvers
  ReportGroup: {
    children: async (parent: { id: number }, _: unknown, ctx: Context) => {
      ctx.session;
      return db
        .select()
        .from(reportGroups)
        .where(eq(reportGroups.parentId, parent.id))
        .orderBy(reportGroups.sortOrder);
    },
  },

  AccountMapping: {
    group: async (parent: { groupId: number | null }, _: unknown, ctx: Context) => {
      ctx.session;
      if (!parent.groupId) return null;
      const [group] = await db
        .select()
        .from(reportGroups)
        .where(eq(reportGroups.id, parent.groupId))
        .limit(1);
      return group ?? null;
    },
  },
};
