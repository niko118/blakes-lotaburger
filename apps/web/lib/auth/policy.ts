import "server-only";
import { db } from "@lib/server/db";
import { appUsers } from "@lib/db/schema.auth";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string) {
  const normalizedEmail = email.toLowerCase();

  const [user] = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.email, normalizedEmail))
    .limit(1);

  return user || null;
}

/**
 * Check if user email is allowed to sign in
 * - open mode: always returns true
 * - restricted mode: checks app_users table
 */
export async function isSignInAllowed(email: string): Promise<boolean> {
  const authMode = process.env.AUTH_MODE || "restricted";

  if (authMode !== "restricted") {
    return true;
  }

  const user = await getUserByEmail(email);
  return user !== null && user.isActive;
}

/**
 * Check if user is admin based on ADMIN_EMAILS env var
 * Used for initial admin setup
 */
export function isAdminByEmail(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return adminEmails.includes(email.toLowerCase());
}
