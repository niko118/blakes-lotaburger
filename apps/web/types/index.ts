/**
 * Application Types
 *
 * This file contains all shared TypeScript types used across the application.
 */

// ============================================================================
// User & Role Types
// ============================================================================

export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
  role: Role | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Auth Types
// ============================================================================

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResult {
  success: boolean;
}

// ============================================================================
// Reports Types
// ============================================================================

export interface ReportGroup {
  id: string;
  name: string;
  parentId: number | null;
  reportType: string;
  sortOrder: number;
  subtotalAfter: boolean;
  contributesAs: string | null; // 'revenue' | 'cost' | null (P&L sections only)
  eliminateCommissary: boolean;
  children: ReportGroup[];
}

export interface AccountMapping {
  id: string;
  accountName: string;
  groupId: number | null;
  group: ReportGroup | null;
  reportType: string | null;
  ignored: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountMappingCheckResult {
  unmappedAccounts: string[];
  totalChecked: number;
}

// ============================================================================
// API Credentials Types (for external API integrations)
// ============================================================================

export interface ApiCredential {
  id: number;
  integrationId: string;
  integrationName: string | null;
  accessExpiresAt: string | null;
  lastRefreshedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
