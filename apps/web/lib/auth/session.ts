import "server-only";
import { getServerSession as nextAuthGetServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authOptions } from "./auth-options";

export async function getServerSession(): Promise<Session | null> {
  return await nextAuthGetServerSession(authOptions);
}

export async function requireAuth(): Promise<Session> {
  const session = await getServerSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

/**
 * Require the user to be an admin
 */
export async function requireAdmin(): Promise<Session> {
  const session = await requireAuth();

  if (!session.user?.isAdmin) {
    throw new Error("Forbidden: Admin access required");
  }

  return session;
}

/**
 * Require the user to have a specific permission
 */
export async function requirePermission(permission: string): Promise<Session> {
  const session = await requireAuth();

  // Admins have all permissions
  if (session.user?.isAdmin) {
    return session;
  }

  const permissions = session.user?.permissions || [];
  if (!permissions.includes(permission)) {
    throw new Error(`Forbidden: Permission "${permission}" required`);
  }

  return session;
}
