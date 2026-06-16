import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@lib/db/schema";

// Bypass mode: when DEV_ADMIN_EMAIL is set and there's no DATABASE_URL,
// the app runs without a database. Useful for apps that don't need a DB.
const DEV_BYPASS =
  !!process.env.DEV_ADMIN_EMAIL &&
  !process.env.DATABASE_URL;

const globalForDb = global as unknown as {
  __sql?: ReturnType<typeof postgres>;
  __bypassLogged?: boolean;
};

if (!process.env.DATABASE_URL && !DEV_BYPASS) {
  throw new Error(
    "DATABASE_URL is not defined.\n" +
    "Options:\n" +
    "  1. Set DATABASE_URL to connect to a database.\n" +
    "  2. Set DEV_ADMIN_EMAIL + DEV_ADMIN_PASSWORD in .env.local to run without a database (dev only)."
  );
}

if (DEV_BYPASS && !globalForDb.__bypassLogged) {
  globalForDb.__bypassLogged = true;
  console.warn(
    "[DEV BYPASS] Running without a database. DB-dependent features will not work."
  );
}

if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "development") {
  console.warn(
    `[DB] Running in Vercel (${process.env.VERCEL_ENV}) - Migrations are disabled. ` +
    `Migrations must be run via GitHub Actions only.`
  );
}

type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

function createBypassProxy(): DrizzleDB {
  return new Proxy({} as DrizzleDB, {
    get(_, prop) {
      if (typeof prop === "symbol") return undefined;
      throw new Error(
        `[DEV BYPASS] Cannot call db.${String(prop)}() — no database configured.\n` +
        "Set DATABASE_URL in .env.local to enable database features."
      );
    },
  });
}

export const sql = DEV_BYPASS
  ? undefined
  : (globalForDb.__sql ??
      postgres(process.env.DATABASE_URL!, {
        prepare: false,
        ssl: (process.env.DATABASE_URL!.includes("localhost") || process.env.DATABASE_URL!.includes("127.0.0.1")) ? false : "require",
      }));

if (sql && !globalForDb.__sql) globalForDb.__sql = sql;

export const db: DrizzleDB = DEV_BYPASS
  ? createBypassProxy()
  : drizzle(sql!, { schema });

if (typeof process.env.VERCEL_ENV !== "undefined") {
  Object.defineProperty(db, "migrate", {
    get() {
      throw new Error(
        "❌ MIGRATION BLOCKED: Migrations cannot be run from application runtime code.\n" +
        "Migrations are executed exclusively via GitHub Actions:\n" +
        "  - DEV: .github/workflows/deploy-dev.yml (on push to 'dev' or PRs to 'master')\n" +
        "  - PROD: .github/workflows/deploy-prod.yml (on push to 'master' branch)\n" +
        "For local development, use: npm run -w web db:migrate"
      );
    },
    set() {
      throw new Error("❌ Cannot override migration safety guard");
    },
    configurable: false,
    enumerable: false,
  });
}
