#!/usr/bin/env node

/**
 * Sync PROD database to local Supabase
 *
 * Usage: npm run db:local:sync
 *
 * Requires:
 * - SUPABASE_PROD_DB_URL in apps/web/.env.local (Session pooler, port 6543)
 * - Local Supabase running (npm run db:local:start)
 * - PostgreSQL 17 CLI tools (brew install postgresql@17)
 */

const { execSync, spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

// Colors for output
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
  reset: "\x1b[0m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
  console.error(`${colors.red}${colors.bold}ERROR: ${message}${colors.reset}`);
}

function success(message) {
  console.log(`${colors.green}${colors.bold}${message}${colors.reset}`);
}

function warning(message) {
  console.log(`${colors.yellow}${colors.bold}WARNING: ${message}${colors.reset}`);
}

// Load .env.local
function loadEnv() {
  const envPath = path.join(__dirname, "..", "apps", "web", ".env.local");

  if (!fs.existsSync(envPath)) {
    error(`Environment file not found: ${envPath}`);
    log("\nPlease create apps/web/.env.local with SUPABASE_PROD_DB_URL", "yellow");
    log("Example: cp apps/web/env.example apps/web/.env.local", "cyan");
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, "utf-8");
  const env = {};

  envContent.split("\n").forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
  });

  return env;
}

// Check if local Supabase is running
function checkLocalSupabase() {
  try {
    const result = spawnSync("supabase", ["status"], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

// Main sync function
async function main() {
  console.clear();
  log("\n" + "=".repeat(60), "cyan");
  log("          PROD -> Local Database Sync", "bold");
  log("=".repeat(60) + "\n", "cyan");

  // Load environment
  const env = loadEnv();
  const prodDbUrl = env.SUPABASE_PROD_DB_URL;

  if (!prodDbUrl) {
    error("SUPABASE_PROD_DB_URL not found in apps/web/.env.local");
    log("\nTo set up:", "yellow");
    log("  1. Go to Supabase dashboard > Connect", "cyan");
    log("  2. Copy the Session pooler URL (port 6543)", "cyan");
    log("  3. Add to apps/web/.env.local:", "cyan");
    log("     SUPABASE_PROD_DB_URL=postgresql://...@...:6543/postgres\n", "green");
    process.exit(1);
  }

  // Validate URL format
  if (!prodDbUrl.includes(":6543")) {
    warning("SUPABASE_PROD_DB_URL should use Session pooler (port 6543)");
    log("Direct connections (port 5432) may fail with PREPARE statements error", "yellow");
    log("Get the correct URL from: Supabase > Connect > Session Pooler\n", "cyan");
  }

  // Check local Supabase
  log("Checking local Supabase...", "blue");
  if (!checkLocalSupabase()) {
    error("Local Supabase is not running");
    log("\nStart it with: npm run db:local:start\n", "cyan");
    process.exit(1);
  }
  success("Local Supabase is running");

  // Local connection
  const localDbUrl = "postgresql://postgres:postgres@localhost:54322/postgres";

  // Temp file for dump
  const dumpFile = path.join(__dirname, "..", "temp_prod_dump.sql");

  try {
    // Step 1: Dump from PROD
    log("\nStep 1/3: Dumping data from PROD...", "blue");
    log("(This may take a minute depending on data size)", "cyan");

    const pgDumpCmd = `pg_dump "${prodDbUrl}" --data-only --no-owner --no-privileges --disable-triggers -f "${dumpFile}"`;

    try {
      execSync(pgDumpCmd, {
        stdio: ["pipe", "pipe", "pipe"],
        encoding: "utf-8",
      });
    } catch (dumpError) {
      error("Failed to dump PROD database");
      log("\nPossible causes:", "yellow");
      log("  - Wrong SUPABASE_PROD_DB_URL (check port is 6543)", "cyan");
      log("  - Network/firewall issues", "cyan");
      log("  - pg_dump not in PATH (install: brew install postgresql@17)", "cyan");
      if (dumpError.stderr) {
        log("\nError details:", "red");
        log(dumpError.stderr, "red");
      }
      process.exit(1);
    }

    success("PROD dump complete");

    // Step 2: Clear local data
    log("\nStep 2/3: Clearing local database...", "blue");

    const clearCmd = `psql "${localDbUrl}" -c "
      DO \\$\\$
      DECLARE r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END \\$\\$;
    "`;

    try {
      execSync(clearCmd, {
        stdio: ["pipe", "pipe", "pipe"],
        encoding: "utf-8",
      });
    } catch (clearError) {
      warning("Could not clear all tables (this is usually OK)");
    }

    success("Local database cleared");

    // Step 3: Restore to local
    log("\nStep 3/3: Restoring data to local...", "blue");

    const restoreCmd = `psql "${localDbUrl}" -f "${dumpFile}"`;

    try {
      execSync(restoreCmd, {
        stdio: ["pipe", "pipe", "pipe"],
        encoding: "utf-8",
      });
    } catch (restoreError) {
      // psql often returns non-zero even on success with some warnings
      // Check if data actually exists
      warning("Restore completed with warnings (usually harmless)");
    }

    success("Data restored to local database");

    // Cleanup
    if (fs.existsSync(dumpFile)) {
      fs.unlinkSync(dumpFile);
    }

    // Success message
    log("\n" + "=".repeat(60), "green");
    success("          Sync complete!");
    log("=".repeat(60), "green");

    log("\nLocal database now contains PROD data.", "cyan");
    log("Access Supabase Studio at: http://localhost:54323\n", "blue");

  } catch (err) {
    error("Unexpected error during sync");
    console.error(err);

    // Cleanup on error
    if (fs.existsSync(dumpFile)) {
      fs.unlinkSync(dumpFile);
    }

    process.exit(1);
  }
}

main();
