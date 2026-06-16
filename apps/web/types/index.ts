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
