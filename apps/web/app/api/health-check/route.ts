import { NextResponse } from "next/server";
import { db } from "@lib/server/db";
import { appUsers } from "@lib/db/schema.auth";

export const runtime = "nodejs";

/**
 * Health check endpoint for monitoring
 *
 * Checks:
 * - Database connection
 * - Basic table access
 */
export async function GET() {
  const checks = {
    database: false,
    details: {} as Record<string, unknown>,
  };

  try {
    // Check database connection by counting users
    const users = await db.select().from(appUsers).limit(1);
    checks.database = true;
    checks.details.connected = true;
    checks.details.hasUsers = users.length > 0;
  } catch (error) {
    checks.details.databaseError =
      error instanceof Error ? error.message : String(error);
  }

  const healthy = checks.database;

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: healthy ? 200 : 503 }
  );
}
