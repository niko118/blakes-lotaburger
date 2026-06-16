import type { AuthOptions, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { verifyPassword, getUserByEmail } from "./policy";
import {
  SESSION_MAX_AGE_SECONDS,
  SESSION_MAX_AGE_HOURS,
} from "./session-config";
import { db } from "@lib/server/db";
import { appUsers, appRoles } from "@lib/db/schema.auth";
import { eq } from "drizzle-orm";

// Bypass mode: skip database entirely when DEV_ADMIN_EMAIL + DEV_ADMIN_PASSWORD are set
// and DATABASE_URL is absent. Useful for apps that don't need a database at all.
const DEV_BYPASS =
  !!process.env.DEV_ADMIN_EMAIL &&
  !process.env.DATABASE_URL;

const DEV_ADMIN_ID = "dev-bypass-admin";

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Dev bypass: authenticate against env vars, no DB required
        if (DEV_BYPASS) {
          const emailMatch = credentials.email === process.env.DEV_ADMIN_EMAIL;
          const passwordMatch = credentials.password === process.env.DEV_ADMIN_PASSWORD;
          if (emailMatch && passwordMatch) {
            return {
              id: DEV_ADMIN_ID,
              email: process.env.DEV_ADMIN_EMAIL!,
              name: "Dev Admin",
            };
          }
          return null;
        }

        const user = await getUserByEmail(credentials.email);
        if (!user || !user.isActive) return null;
        if (!user.passwordHash) return null;

        const isValid = await verifyPassword(credentials.password, user.passwordHash);
        if (!isValid) return null;

        await db
          .update(appUsers)
          .set({ lastLoginAt: new Date() })
          .where(eq(appUsers.id, user.id));

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: User }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name ?? undefined;
      }

      if (token.email && typeof token.email === "string") {
        // Dev bypass: return hardcoded admin session without hitting the DB
        if (DEV_BYPASS && token.id === DEV_ADMIN_ID) {
          token.isAdmin = true;
          token.roleId = undefined;
          token.roleName = undefined;
          token.permissions = [];
          return token;
        }

        const [userData] = await db
          .select({
            id: appUsers.id,
            email: appUsers.email,
            name: appUsers.name,
            isAdmin: appUsers.isAdmin,
            roleId: appUsers.roleId,
            roleName: appRoles.name,
            permissions: appRoles.permissions,
          })
          .from(appUsers)
          .leftJoin(appRoles, eq(appUsers.roleId, appRoles.id))
          .where(eq(appUsers.email, token.email))
          .limit(1);

        if (userData) {
          token.id = userData.id;
          token.name = userData.name ?? undefined;
          token.isAdmin = userData.isAdmin;
          token.roleId = userData.roleId ?? undefined;
          token.roleName = userData.roleName ?? undefined;
          token.permissions = userData.permissions
            ? Array.isArray(userData.permissions)
              ? userData.permissions
              : JSON.parse(userData.permissions as string)
            : [];
        } else {
          token.isAdmin = false;
          token.roleId = null;
          token.roleName = null;
          token.permissions = [];
        }
      }

      return token;
    },
    async session({ session, token }: { session: any; token: JWT }) {
      if (session.user) {
        session.user.id = token.id || "";
        session.user.email = token.email || "";
        session.user.name = token.name || "";
        session.user.isAdmin = (token.isAdmin as boolean) || false;
        session.user.roleId = (token.roleId as string) || null;
        session.user.roleName = (token.roleName as string) || null;
        session.user.permissions = (token.permissions as string[]) || [];
      }
      session.maxAgeHours = SESSION_MAX_AGE_HOURS;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
