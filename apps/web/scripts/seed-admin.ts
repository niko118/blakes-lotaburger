#!/usr/bin/env node

/**
 * Seed Admin User Script
 *
 * Creates an initial admin user with a hashed password.
 *
 * Usage:
 *   npm run db:seed
 *   (Interactive prompts)
 *
 * Or with arguments:
 *   npm run db:seed -- \
 *     --email admin@example.com \
 *     --password "your-password-here" \
 *     --name "Admin User"
 */

import * as readline from "readline";
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { appUsers } from "../lib/db/schema.auth";
import { eq } from "drizzle-orm";

const SALT_ROUNDS = 12;

// Parse command line arguments
function parseArgs(): {
  email?: string;
  password?: string;
  name?: string;
} {
  const args = process.argv.slice(2);
  const parsed: {
    email?: string;
    password?: string;
    name?: string;
  } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--email" && args[i + 1]) {
      parsed.email = args[i + 1];
      i++;
    } else if (arg === "--password" && args[i + 1]) {
      parsed.password = args[i + 1];
      i++;
    } else if (arg === "--name" && args[i + 1]) {
      parsed.name = args[i + 1];
      i++;
    }
  }

  return parsed;
}

// Prompt user for input
function prompt(question: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log("=== Admin User Seeding Tool ===\n");

  // Check for database connection
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ Error: DATABASE_URL environment variable is not set.");
    console.error("\nSet it in your .env.local file:\n");
    console.error(
      "  DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres\n"
    );
    process.exit(1);
  }

  // Get values from args or prompts
  const args = parseArgs();

  let email = args.email;
  if (!email) {
    email = await prompt("Admin email: ");
    if (!email || !email.includes("@")) {
      console.error("❌ Error: Invalid email address.\n");
      process.exit(1);
    }
  }

  let password = args.password;
  if (!password) {
    password = await prompt("Admin password (min 8 characters): ");
    if (!password || password.length < 8) {
      console.error("❌ Error: Password must be at least 8 characters.\n");
      process.exit(1);
    }
  }

  let name = args.name;
  if (!name) {
    name = await prompt("Admin name (optional, press Enter to skip): ");
  }

  // Connect to database
  console.log("\n🔌 Connecting to database...");
  const client = postgres(databaseUrl, { prepare: false });
  const db = drizzle(client);

  try {
    // Check if user already exists
    const existingUser = await db
      .select()
      .from(appUsers)
      .where(eq(appUsers.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      console.log(`\n⚠️  User with email "${email}" already exists.`);

      const update = await prompt("Update password? (y/n): ");
      if (update.toLowerCase() !== "y") {
        console.log("Exiting without changes.\n");
        await client.end();
        process.exit(0);
      }

      // Update existing user
      console.log("\n🔐 Hashing password...");
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      await db
        .update(appUsers)
        .set({
          passwordHash,
          name: name || existingUser[0].name,
          updatedAt: new Date(),
        })
        .where(eq(appUsers.email, email));

      console.log(`\n✅ Password updated for user "${email}"!\n`);
    } else {
      // Create new user
      console.log("\n🔐 Hashing password...");
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      await db.insert(appUsers).values({
        email,
        passwordHash,
        name: name || null,
        isAdmin: true,
        isActive: true,
      });

      console.log(`\n✅ Admin user created successfully!`);
      console.log(`   Email: ${email}`);
      console.log(`   Name: ${name || "(not set)"}`);
      console.log(`   Admin: Yes`);
      console.log(`   Active: Yes\n`);
    }
  } catch (error) {
    console.error("\n❌ Database error:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the script
main().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});
