/**
 * Centralized Navigation Configuration
 *
 * Single source of truth for sidebar navigation and middleware route permissions.
 *
 * When adding a new module:
 * 1. Add it to the `navigation` array below
 * 2. Sidebar and middleware route permissions auto-update
 */

import type { IconName } from "./icon-resolver";

export interface NavChild {
  name: string;
  href: string;
  icon?: IconName;
  requiredPermission?: string;
}

export interface NavItem {
  name: string;
  icon: IconName;
  description: string;
  href?: string;
  children?: NavChild[];
  adminOnly?: boolean;
}

export const navigation: NavItem[] = [
  {
    name: "Dashboard",
    icon: "Home",
    description: "System overview",
    href: "/dashboard",
  },
  {
    name: "Reports",
    icon: "BarChart2",
    description: "Financial reports for the period",
    children: [
      {
        name: "Upload Files",
        href: "/reports/upload",
        icon: "Upload",
      },
      {
        name: "Account Mapping",
        href: "/reports/mapping",
        icon: "Layers",
        requiredPermission: "reports.manage",
      },
      {
        name: "Report Structure",
        href: "/reports/structure",
        icon: "ListTree",
        requiredPermission: "reports.manage",
      },
    ],
  },
  {
    name: "Access Management",
    icon: "Shield",
    description: "Manage users, roles and permissions",
    adminOnly: true,
    children: [
      {
        name: "Users",
        href: "/admin/users",
        icon: "Users",
        requiredPermission: "users.manage",
      },
      {
        name: "Roles",
        href: "/admin/roles",
        icon: "ShieldCheck",
        requiredPermission: "roles.manage",
      },
    ],
  },
];

/**
 * Auto-generated route permissions for middleware.
 * Groups routes by their required permissions.
 */
function generateRoutePermissions(): Record<string, string[]> {
  const routePerms: Record<string, string[]> = {};

  for (const item of navigation) {
    if (item.children) {
      for (const child of item.children) {
        if (child.requiredPermission) {
          if (!routePerms[child.href]) {
            routePerms[child.href] = [];
          }
          if (!routePerms[child.href].includes(child.requiredPermission)) {
            routePerms[child.href].push(child.requiredPermission);
          }
        }
      }
    }
  }

  // Sort by path length descending (more specific routes first)
  return Object.fromEntries(
    Object.entries(routePerms).sort(([a], [b]) => b.length - a.length)
  );
}

export const ROUTE_PERMISSIONS = generateRoutePermissions();

export const PUBLIC_ROUTES = [
  "/",
  "/dashboard",
  "/permission-denied",
];
