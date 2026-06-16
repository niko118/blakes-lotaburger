/**
 * Permission Helper Functions
 *
 * These functions provide permission checking capabilities throughout the application.
 * They implement the "admin bypass" pattern where admin users (isAdmin=true)
 * automatically pass all permission checks.
 *
 * Usage:
 * - Server-side: Use in GraphQL resolvers and API routes
 * - Client-side: Use in components for conditional rendering
 */

import { GraphQLError } from "graphql";

/**
 * User shape for permission checks
 * Can be session.user or any object with these fields
 */
export interface PermissionUser {
  isAdmin: boolean;
  permissions: string[];
}

/**
 * Check if user has a specific permission
 *
 * @param user - User object with isAdmin and permissions
 * @param permission - Permission key (e.g., "items.view")
 * @returns true if user has permission or is admin
 *
 * @example
 * if (hasPermission(ctx.session.user, "items.view")) {
 *   // User can view items data
 * }
 */
export function hasPermission(
  user: PermissionUser,
  permission: string
): boolean {
  // Admin bypass: always return true
  if (user.isAdmin) return true;

  // Check if user has permission
  return user.permissions.includes(permission);
}

/**
 * Check if user has ANY of the specified permissions
 *
 * @param user - User object with isAdmin and permissions
 * @param permissions - Array of permission keys
 * @returns true if user has at least one permission or is admin
 *
 * @example
 * if (hasAnyPermission(user, ["items.view", "items.edit"])) {
 *   // User can either view or edit items data
 * }
 */
export function hasAnyPermission(
  user: PermissionUser,
  permissions: string[]
): boolean {
  // Admin bypass: always return true
  if (user.isAdmin) return true;

  // Check if user has at least one permission
  return permissions.some((p) => user.permissions.includes(p));
}

/**
 * Check if user has ALL of the specified permissions
 *
 * @param user - User object with isAdmin and permissions
 * @param permissions - Array of permission keys
 * @returns true if user has all permissions or is admin
 *
 * @example
 * if (hasAllPermissions(user, ["items.view", "reports.view"])) {
 *   // User can view both items and reports data
 * }
 */
export function hasAllPermissions(
  user: PermissionUser,
  permissions: string[]
): boolean {
  // Admin bypass: always return true
  if (user.isAdmin) return true;

  // Check if user has all permissions
  return permissions.every((p) => user.permissions.includes(p));
}

/**
 * Require a specific permission or throw GraphQLError
 * Use this in GraphQL resolvers to enforce permissions
 *
 * @param user - User object with isAdmin and permissions
 * @param permission - Permission key (e.g., "roles.manage")
 * @throws GraphQLError with 403 status if permission check fails
 *
 * @example
 * // In GraphQL resolver
 * export const roleResolvers = {
 *   Query: {
 *     roles: async (_: unknown, __: unknown, ctx: Context) => {
 *       requirePermission(ctx.session.user, "roles.manage");
 *       // ... rest of resolver
 *     }
 *   }
 * }
 */
export function requirePermission(
  user: PermissionUser,
  permission: string
): void {
  if (!hasPermission(user, permission)) {
    throw new GraphQLError(
      `Forbidden: Missing required permission '${permission}'`,
      {
        extensions: {
          code: "FORBIDDEN",
          http: { status: 403 },
        },
      }
    );
  }
}

/**
 * Require ANY of the specified permissions or throw GraphQLError
 *
 * @param user - User object with isAdmin and permissions
 * @param permissions - Array of permission keys
 * @throws GraphQLError with 403 status if permission check fails
 *
 * @example
 * requireAnyPermission(user, ["items.view", "items.edit"]);
 */
export function requireAnyPermission(
  user: PermissionUser,
  permissions: string[]
): void {
  if (!hasAnyPermission(user, permissions)) {
    throw new GraphQLError(
      `Forbidden: Missing one of required permissions: ${permissions.join(", ")}`,
      {
        extensions: {
          code: "FORBIDDEN",
          http: { status: 403 },
        },
      }
    );
  }
}

/**
 * Require ALL of the specified permissions or throw GraphQLError
 *
 * @param user - User object with isAdmin and permissions
 * @param permissions - Array of permission keys
 * @throws GraphQLError with 403 status if permission check fails
 *
 * @example
 * requireAllPermissions(user, ["items.view", "reports.view"]);
 */
export function requireAllPermissions(
  user: PermissionUser,
  permissions: string[]
): void {
  if (!hasAllPermissions(user, permissions)) {
    throw new GraphQLError(
      `Forbidden: Missing required permissions: ${permissions.join(", ")}`,
      {
        extensions: {
          code: "FORBIDDEN",
          http: { status: 403 },
        },
      }
    );
  }
}
