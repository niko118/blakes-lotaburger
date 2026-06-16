import { eq } from "drizzle-orm";
import { GraphQLError } from "graphql";
import { db } from "@lib/server/db";
import { appUsers } from "@lib/db/schema.auth";
import type { Context } from "../types";
import { hashPassword, verifyPassword } from "@lib/auth/policy";

const MIN_PASSWORD_LENGTH = 8;

export const authResolvers = {
  Mutation: {
    changeMyPassword: async (
      _: unknown,
      { input }: { input: { currentPassword: string; newPassword: string } },
      ctx: Context
    ) => {
      const { currentPassword, newPassword } = input;
      const userId = ctx.session.user.id;

      if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
        throw new GraphQLError(
          `New password must be at least ${MIN_PASSWORD_LENGTH} characters`,
          { extensions: { code: "BAD_REQUEST", http: { status: 400 } } }
        );
      }

      const [user] = await db
        .select()
        .from(appUsers)
        .where(eq(appUsers.id, userId))
        .limit(1);

      if (!user) {
        throw new GraphQLError("User not found", {
          extensions: { code: "NOT_FOUND", http: { status: 404 } },
        });
      }

      if (!user.passwordHash) {
        throw new GraphQLError("Cannot change password for this account type", {
          extensions: { code: "BAD_REQUEST", http: { status: 400 } },
        });
      }

      const isValid = await verifyPassword(currentPassword, user.passwordHash);
      if (!isValid) {
        throw new GraphQLError("Current password is incorrect", {
          extensions: { code: "UNAUTHORIZED", http: { status: 401 } },
        });
      }

      const newPasswordHash = await hashPassword(newPassword);
      await db
        .update(appUsers)
        .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
        .where(eq(appUsers.id, userId));

      return { success: true };
    },
  },
};
