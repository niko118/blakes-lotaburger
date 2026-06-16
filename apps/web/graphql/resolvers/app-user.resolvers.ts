/**
 * AppUser GraphQL Resolvers
 *
 * Uses permission-based authorization via 'users.manage' permission.
 * Admin-specific operations require isAdmin=true.
 */

import { eq, or, ilike, sql, inArray } from "drizzle-orm";
import { GraphQLError } from "graphql";
import { db } from "@lib/server/db";
import { appUsers, appRoles } from "@lib/db/schema.auth";
import type { Context } from "../types";
import { requirePermission } from "@lib/auth/permissions";
import { hashPassword } from "@lib/auth/policy";

// Simple email format validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const appUserResolvers = {
  Query: {
    appUsers: async (_: unknown, args: { search?: string }, ctx: Context) => {
      requirePermission(ctx.session.user, "users.manage");

      // 1. Fetch all users with search filter
      const users = await (async () => {
        if (args.search) {
          const searchTerm = `%${args.search}%`;
          return db
            .select()
            .from(appUsers)
            .where(
              or(ilike(appUsers.email, searchTerm), ilike(appUsers.name, searchTerm))
            );
        }
        return db.select().from(appUsers);
      })();

      // 2. Bulk fetch roles (avoid N+1)
      const roleIds = [...new Set(users.map((u) => u.roleId).filter(Boolean))];
      const roles =
        roleIds.length > 0
          ? await db.select().from(appRoles).where(inArray(appRoles.id, roleIds as string[]))
          : [];
      const roleMap = new Map(roles.map((r) => [r.id, r]));

      // 3. Combine results
      return users.map((user) => ({
        ...user,
        role: user.roleId ? roleMap.get(user.roleId) : null,
      }));
    },

    appUser: async (_: unknown, { id }: { id: string }, ctx: Context) => {
      requirePermission(ctx.session.user, "users.manage");

      const result = await db.select().from(appUsers).where(eq(appUsers.id, id)).limit(1);

      if (!result[0]) return null;

      // Fetch role if user has one
      let role = null;
      if (result[0].roleId) {
        const [fetchedRole] = await db
          .select()
          .from(appRoles)
          .where(eq(appRoles.id, result[0].roleId))
          .limit(1);
        role = fetchedRole || null;
      }

      return { ...result[0], role };
    },
  },

  Mutation: {
    createAppUser: async (
      _: unknown,
      {
        input,
      }: {
        input: {
          email: string;
          name?: string;
          password: string;
          isAdmin?: boolean;
          roleId?: string;
          isActive?: boolean;
        };
      },
      ctx: Context
    ) => {
      requirePermission(ctx.session.user, "users.manage");
      const { user: currentUser } = ctx.session;

      const { email, name, password, isAdmin, roleId, isActive } = input;

      // Validation: Email format
      if (!email || !EMAIL_REGEX.test(email)) {
        throw new GraphQLError("Invalid email format", {
          extensions: { code: "BAD_REQUEST", http: { status: 400 } },
        });
      }

      // Validation: Only admins can create other admins
      if (isAdmin && !currentUser.isAdmin) {
        throw new GraphQLError("Only admins can create admin users", {
          extensions: { code: "FORBIDDEN", http: { status: 403 } },
        });
      }

      // Validation: Non-admin users MUST have roleId
      if (!isAdmin && !roleId) {
        throw new GraphQLError("Non-admin users must have a role assigned", {
          extensions: { code: "BAD_REQUEST", http: { status: 400 } },
        });
      }

      // Validation: Admin users must have roleId=null
      if (isAdmin && roleId) {
        throw new GraphQLError("Admin users cannot have a role assigned", {
          extensions: { code: "BAD_REQUEST", http: { status: 400 } },
        });
      }

      // Validation: Verify roleId exists if provided
      if (roleId) {
        const [roleExists] = await db
          .select({ id: appRoles.id })
          .from(appRoles)
          .where(eq(appRoles.id, roleId))
          .limit(1);

        if (!roleExists) {
          throw new GraphQLError("Role not found", {
            extensions: { code: "NOT_FOUND", http: { status: 404 } },
          });
        }
      }

      // Validation: Password required
      if (!password || password.length < 8) {
        throw new GraphQLError("Password must be at least 8 characters", {
          extensions: { code: "BAD_REQUEST", http: { status: 400 } },
        });
      }

      const normalizedEmail = email.toLowerCase();
      const passwordHash = await hashPassword(password);

      try {
        // Create user
        const isAdminValue = isAdmin === true;
        const isActiveValue = isActive === true || isActive === undefined;

        const [newUser] = await db
          .insert(appUsers)
          .values({
            email: normalizedEmail,
            name: name?.trim() || null,
            passwordHash,
            isAdmin: sql`${isAdminValue}::boolean`,
            roleId: isAdminValue ? null : roleId || null,
            isActive: sql`${isActiveValue}::boolean`,
          })
          .returning();

        // Fetch role for response
        let role = null;
        if (newUser.roleId) {
          const [fetchedRole] = await db
            .select()
            .from(appRoles)
            .where(eq(appRoles.id, newUser.roleId))
            .limit(1);
          role = fetchedRole || null;
        }

        return {
          ...newUser,
          role,
        };
      } catch (error: unknown) {
        // Handle unique constraint violation (PostgreSQL error code 23505)
        // Drizzle may wrap the error in different ways, so check multiple sources
        const pgCode =
          (error as { code?: string })?.code ||
          (error as { cause?: { code?: string } })?.cause?.code;
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Check for unique constraint violation
        if (pgCode === "23505" || errorMessage.includes("duplicate key") || errorMessage.includes("unique constraint")) {
          throw new GraphQLError("User with this email already exists", {
            extensions: { code: "CONFLICT", http: { status: 409 } },
          });
        }
        throw error;
      }
    },

    updateAppUser: async (
      _: unknown,
      {
        id,
        input,
      }: {
        id: string;
        input: {
          name?: string;
          password?: string;
          isAdmin?: boolean;
          roleId?: string;
          isActive?: boolean;
        };
      },
      ctx: Context
    ) => {
      requirePermission(ctx.session.user, "users.manage");
      const { user: currentUser } = ctx.session;

      const { name, password, isAdmin, roleId, isActive } = input;

      // Fetch existing user
      const [existingUser] = await db.select().from(appUsers).where(eq(appUsers.id, id)).limit(1);

      if (!existingUser) {
        throw new GraphQLError("User not found", {
          extensions: { code: "NOT_FOUND", http: { status: 404 } },
        });
      }

      // Validation: Only admins can modify isAdmin flag
      if (isAdmin !== undefined && !currentUser.isAdmin) {
        throw new GraphQLError("Only admins can modify admin status", {
          extensions: { code: "FORBIDDEN", http: { status: 403 } },
        });
      }

      // Validation: Cannot remove own admin status
      if (existingUser.id === currentUser.id && existingUser.isAdmin && isAdmin === false) {
        throw new GraphQLError("Cannot remove your own admin status", {
          extensions: { code: "FORBIDDEN", http: { status: 403 } },
        });
      }

      // Validation: Verify roleId exists if provided
      if (roleId !== undefined && roleId !== null) {
        const [roleExists] = await db
          .select({ id: appRoles.id })
          .from(appRoles)
          .where(eq(appRoles.id, roleId))
          .limit(1);

        if (!roleExists) {
          throw new GraphQLError("Role not found", {
            extensions: { code: "NOT_FOUND", http: { status: 404 } },
          });
        }
      }

      // Validation: Cannot deactivate own account
      if (existingUser.id === currentUser.id && isActive === false) {
        throw new GraphQLError("Cannot deactivate your own account. Ask another admin to deactivate you.", {
          extensions: { code: "FORBIDDEN", http: { status: 403 } },
        });
      }

      // Validation: Password minimum length if provided
      if (password !== undefined && password.length < 8) {
        throw new GraphQLError("Password must be at least 8 characters", {
          extensions: { code: "BAD_REQUEST", http: { status: 400 } },
        });
      }

      // Build update object
      const updateData: Record<string, unknown> = {};

      if (name !== undefined) updateData.name = name?.trim() || null;
      if (password !== undefined) updateData.passwordHash = await hashPassword(password);
      if (isAdmin !== undefined) {
        const isAdminValue = isAdmin === true;
        updateData.isAdmin = sql`${isAdminValue}::boolean`;
        // If becoming admin, clear roleId
        if (isAdminValue) {
          updateData.roleId = null;
        }
      }

      // Only update roleId if user is not an admin
      const finalIsAdmin = isAdmin !== undefined ? isAdmin : existingUser.isAdmin;
      if (roleId !== undefined && !finalIsAdmin) {
        updateData.roleId = roleId;
      }

      if (isActive !== undefined) {
        updateData.isActive = sql`${isActive === true}::boolean`;
      }
      updateData.updatedAt = new Date();

      // Update user
      const [updatedUser] = await db.update(appUsers).set(updateData).where(eq(appUsers.id, id)).returning();

      // Fetch role for response
      let role = null;
      if (updatedUser.roleId) {
        const [fetchedRole] = await db
          .select()
          .from(appRoles)
          .where(eq(appRoles.id, updatedUser.roleId))
          .limit(1);
        role = fetchedRole || null;
      }

      return {
        ...updatedUser,
        role,
      };
    },

    deleteAppUser: async (_: unknown, { id }: { id: string }, ctx: Context) => {
      requirePermission(ctx.session.user, "users.manage");
      const { user: currentUser } = ctx.session;

      if (currentUser.id === id) {
        throw new GraphQLError("Cannot delete your own account", {
          extensions: { code: "FORBIDDEN", http: { status: 403 } },
        });
      }

      const [existingUser] = await db.select().from(appUsers).where(eq(appUsers.id, id)).limit(1);

      if (!existingUser) {
        throw new GraphQLError("User not found", {
          extensions: { code: "NOT_FOUND", http: { status: 404 } },
        });
      }

      // Validation: Non-admin users cannot delete admins
      if (!currentUser.isAdmin && existingUser.isAdmin) {
        throw new GraphQLError("Only admins can delete admin accounts", {
          extensions: { code: "FORBIDDEN", http: { status: 403 } },
        });
      }

      // Validation: Cannot delete last admin
      if (existingUser.isAdmin) {
        const adminCount = await db
          .select({ count: sql<number>`count(*)::integer` })
          .from(appUsers)
          .where(eq(appUsers.isAdmin, true));

        if (Number(adminCount[0].count) <= 1) {
          throw new GraphQLError("Cannot delete the last admin user", {
            extensions: { code: "FORBIDDEN", http: { status: 403 } },
          });
        }
      }

      await db.delete(appUsers).where(eq(appUsers.id, id));
      return true;
    },
  },

  // Field resolvers
  AppUser: {},
};
