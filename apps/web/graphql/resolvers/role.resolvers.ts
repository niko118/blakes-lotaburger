/**
 * Role Resolvers
 *
 * Handles CRUD operations for custom roles.
 * Uses permission-based authorization via 'roles.manage' permission.
 */

import type { Context } from "../types";
import { GraphQLError } from "graphql";
import { db } from "@lib/server/db";
import { appRoles, appUsers } from "@lib/db/schema.auth";
import { eq, asc, sql } from "drizzle-orm";
import { VALID_PERMISSIONS } from "@lib/auth/permissions-catalog";
import { requirePermission } from "@lib/auth/permissions";

interface CreateRoleInput {
  name: string;
  description?: string | null;
  permissions: string[];
}

interface UpdateRoleInput {
  name?: string;
  description?: string | null;
  permissions?: string[];
}

export const roleResolvers = {
  Query: {
    /**
     * List all roles
     */
    roles: async (_: unknown, __: unknown, ctx: Context) => {
      requirePermission(ctx.session.user, "roles.manage");

      return await db.select().from(appRoles).orderBy(asc(appRoles.name));
    },

    /**
     * Get single role by ID
     */
    role: async (_: unknown, { id }: { id: string }, ctx: Context) => {
      requirePermission(ctx.session.user, "roles.manage");

      const [role] = await db
        .select()
        .from(appRoles)
        .where(eq(appRoles.id, id))
        .limit(1);

      if (!role) {
        throw new GraphQLError("Role not found", {
          extensions: { code: "NOT_FOUND", http: { status: 404 } },
        });
      }

      return role;
    },
  },

  Mutation: {
    /**
     * Create new role
     */
    createRole: async (
      _: unknown,
      { input }: { input: CreateRoleInput },
      ctx: Context
    ) => {
      requirePermission(ctx.session.user, "roles.manage");

      // Validate permissions array not empty
      if (!input.permissions || input.permissions.length === 0) {
        throw new GraphQLError("Role must have at least one permission", {
          extensions: { code: "BAD_REQUEST", http: { status: 400 } },
        });
      }

      // Validate all permissions are from valid catalog
      const invalidPerms = input.permissions.filter(
        (p) => !VALID_PERMISSIONS.includes(p)
      );
      if (invalidPerms.length > 0) {
        throw new GraphQLError(
          `Invalid permissions: ${invalidPerms.join(", ")}`,
          {
            extensions: { code: "BAD_REQUEST", http: { status: 400 } },
          }
        );
      }

      try {
        const [newRole] = await db
          .insert(appRoles)
          .values({
            name: input.name.trim(),
            description: input.description?.trim() || null,
            permissions: input.permissions,
          })
          .returning();

        return newRole;
      } catch (error: unknown) {
        // Handle unique constraint violation (PostgreSQL error code 23505)
        // Drizzle may wrap the error in different ways, so check multiple sources
        const pgCode =
          (error as { code?: string })?.code ||
          (error as { cause?: { code?: string } })?.cause?.code;
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Check for unique constraint violation
        if (pgCode === "23505" || errorMessage.includes("duplicate key") || errorMessage.includes("unique constraint")) {
          throw new GraphQLError(`Role with name '${input.name}' already exists`, {
            extensions: { code: "CONFLICT", http: { status: 409 } },
          });
        }
        throw error;
      }
    },

    /**
     * Update existing role
     */
    updateRole: async (
      _: unknown,
      { id, input }: { id: string; input: UpdateRoleInput },
      ctx: Context
    ) => {
      requirePermission(ctx.session.user, "roles.manage");

      // Check if role exists
      const [existing] = await db
        .select()
        .from(appRoles)
        .where(eq(appRoles.id, id))
        .limit(1);

      if (!existing) {
        throw new GraphQLError("Role not found", {
          extensions: { code: "NOT_FOUND", http: { status: 404 } },
        });
      }

      // Validate permissions if provided
      if (input.permissions) {
        if (input.permissions.length === 0) {
          throw new GraphQLError("Role must have at least one permission", {
            extensions: { code: "BAD_REQUEST", http: { status: 400 } },
          });
        }

        const invalidPerms = input.permissions.filter(
          (p) => !VALID_PERMISSIONS.includes(p)
        );
        if (invalidPerms.length > 0) {
          throw new GraphQLError(
            `Invalid permissions: ${invalidPerms.join(", ")}`,
            {
              extensions: { code: "BAD_REQUEST", http: { status: 400 } },
            }
          );
        }
      }

      try {
        const updateData: Record<string, unknown> = {
          updatedAt: new Date(),
        };

        if (input.name !== undefined) {
          updateData.name = input.name.trim();
        }
        if (input.description !== undefined) {
          updateData.description = input.description?.trim() || null;
        }
        if (input.permissions !== undefined) {
          updateData.permissions = input.permissions;
        }

        const [updated] = await db
          .update(appRoles)
          .set(updateData)
          .where(eq(appRoles.id, id))
          .returning();

        return updated;
      } catch (error: unknown) {
        // Handle unique constraint violation (PostgreSQL error code 23505)
        // Drizzle may wrap the error in different ways, so check multiple sources
        const pgCode =
          (error as { code?: string })?.code ||
          (error as { cause?: { code?: string } })?.cause?.code;
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Check for unique constraint violation
        if (pgCode === "23505" || errorMessage.includes("duplicate key") || errorMessage.includes("unique constraint")) {
          throw new GraphQLError(`Role with name '${input.name}' already exists`, {
            extensions: { code: "CONFLICT", http: { status: 409 } },
          });
        }
        throw error;
      }
    },

    /**
     * Delete role
     */
    deleteRole: async (
      _: unknown,
      { id }: { id: string },
      ctx: Context
    ) => {
      requirePermission(ctx.session.user, "roles.manage");

      // Check if role exists
      const [existing] = await db
        .select()
        .from(appRoles)
        .where(eq(appRoles.id, id))
        .limit(1);

      if (!existing) {
        throw new GraphQLError("Role not found", {
          extensions: { code: "NOT_FOUND", http: { status: 404 } },
        });
      }

      // Check if any users are assigned to this role
      const usersWithRole = await db
        .select({ count: sql<number>`COUNT(*)::integer` })
        .from(appUsers)
        .where(eq(appUsers.roleId, id));

      const userCount = Number(usersWithRole[0]?.count || 0);
      if (userCount > 0) {
        throw new GraphQLError(
          `Cannot delete role: ${userCount} user(s) are currently assigned to it`,
          { extensions: { code: "CONFLICT", http: { status: 409 } } }
        );
      }

      await db.delete(appRoles).where(eq(appRoles.id, id));

      return true;
    },
  },

  // Field resolvers
  Role: {
    /**
     * Parse permissions from JSONB
     * Drizzle returns JSONB as parsed array, but handle both cases
     */
    permissions: (parent: { permissions: string[] | string }) => {
      if (Array.isArray(parent.permissions)) {
        return parent.permissions;
      }
      try {
        return JSON.parse(parent.permissions);
      } catch {
        return [];
      }
    },
  },
};
