import type { Session } from "next-auth";

/**
 * GraphQL Context type
 * Contains session information from getServerSession
 * MANDATORY: All resolvers must use this Context type
 * 
 * Note: Session is guaranteed to be present because the GraphQL route
 * enforces authentication at the entry point (see /api/graphql/route.ts).
 * All GraphQL operations require authentication.
 */
export interface Context {
  session: Session;
}
