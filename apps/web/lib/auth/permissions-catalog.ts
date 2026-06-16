/**
 * Permissions Catalog
 *
 * This file defines all available permissions in the system.
 * Permissions follow the format: "concept.action"
 * Actions: view, edit, manage
 *
 * This is the single source of truth for permissions used across:
 * - Role creation/editing UI
 * - Permission validation in resolvers
 * - Route protection in middleware
 */

export interface PermissionDefinition {
  key: string;
  category: string;
  description: string;
}

export const PERMISSIONS_CATALOG: PermissionDefinition[] = [
  // Access Management
  {
    key: "users.view",
    category: "Access Management",
    description: "View users list",
  },
  {
    key: "users.manage",
    category: "Access Management",
    description: "Create, edit, and delete users",
  },
  {
    key: "roles.view",
    category: "Access Management",
    description: "View roles list",
  },
  {
    key: "roles.manage",
    category: "Access Management",
    description: "Create, edit, and delete roles",
  },

  // Dashboard
  {
    key: "dashboard.view",
    category: "Dashboard",
    description: "View main dashboard",
  },
];

/**
 * Group permissions by category for UI display
 * Example usage: Render permission checkboxes grouped by category frames
 */
export const PERMISSIONS_BY_CATEGORY = PERMISSIONS_CATALOG.reduce(
  (acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  },
  {} as Record<string, PermissionDefinition[]>
);

/**
 * Get all valid permission keys (for validation)
 */
export const VALID_PERMISSIONS = PERMISSIONS_CATALOG.map((p) => p.key);

/**
 * Check if a permission key exists in the catalog
 */
export function isValidPermission(permission: string): boolean {
  return VALID_PERMISSIONS.includes(permission);
}
