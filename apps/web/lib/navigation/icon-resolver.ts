/**
 * Icon Resolver
 *
 * Maps string icon names to Lucide React components.
 * This abstraction allows the navigation config to be imported in
 * middleware (Edge Runtime) without pulling in React components.
 *
 * Usage:
 *   import { resolveIcon } from "@lib/navigation/icon-resolver";
 *   const Icon = resolveIcon("Home");
 *   <Icon className="h-4 w-4" />
 *
 * To add a new icon: import it below, add to IconName, and add to iconMap.
 */

import {
  Home,
  FileText,
  Shield,
  Building,
  Building2,
  LayoutDashboard,
  Users,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type IconName =
  | "Home"
  | "FileText"
  | "Shield"
  | "Building"
  | "Building2"
  | "LayoutDashboard"
  | "Users"
  | "Settings"
  | "ShieldCheck";

const iconMap: Record<IconName, LucideIcon> = {
  Home,
  FileText,
  Shield,
  Building,
  Building2,
  LayoutDashboard,
  Users,
  Settings,
  ShieldCheck,
};

const DEFAULT_ICON = LayoutDashboard;

export function resolveIcon(name: IconName | string | undefined): LucideIcon {
  if (!name) return DEFAULT_ICON;
  return iconMap[name as IconName] || DEFAULT_ICON;
}
