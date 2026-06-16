import { createYoga, createSchema, maskError } from "graphql-yoga";
import { GraphQLError } from "graphql";
import { typeDefs } from "@graphql/type-defs";
import { resolvers } from "@graphql/resolvers";
import { getServerSession } from "@lib/auth/session";
import type { Context } from "@graphql/types";

export const runtime = "nodejs";

const yoga = createYoga<Context>({
  schema: createSchema<Context>({
    typeDefs,
    resolvers,
  }),
  graphqlEndpoint: "/api/graphql",
  graphiql: process.env.NODE_ENV !== "production",
  fetchAPI: { Response, Request },

  // Custom error masking: allow GraphQLError through, mask others
  maskedErrors: {
    maskError(error, message, isDev): Error {
      // In development, show all errors
      if (isDev) {
        return error as Error;
      }

      // In production/preview:
      // Allow GraphQLError instances through (user-facing errors from resolvers)
      if (error instanceof GraphQLError) {
        return error;
      }

      // Mask unexpected errors (DB errors, system errors, etc.)
      return maskError(error, message, isDev);
    },
  },

  context: async (): Promise<Context> => {
    const session = await getServerSession();

    // Global authentication check - first line of defense
    // All GraphQL operations require authentication
    if (!session) {
      throw new GraphQLError("Unauthorized: Authentication required", {
        extensions: {
          code: "UNAUTHENTICATED",
          http: { status: 401 },
        },
      });
    }

    return { session };
  },
});

export async function GET(request: Request) {
  const response = await yoga.fetch(request);
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export async function POST(request: Request) {
  const response = await yoga.fetch(request);
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export async function OPTIONS(request: Request) {
  return yoga.fetch(request);
}
