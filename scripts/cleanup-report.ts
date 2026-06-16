#!/usr/bin/env node
import { execSync } from "child_process";
import { readdirSync, statSync } from "fs";
import { join } from "path";

function runCommand(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf-8", stdio: "pipe" });
  } catch (err: any) {
    return err.stdout || "";
  }
}

function findEmptyDirs(dir: string, exclude: string[] = []): string[] {
  const empty: string[] = [];

  try {
    const entries = readdirSync(dir);

    if (entries.length === 0 && !exclude.some((e) => dir.includes(e))) {
      return [dir];
    }

    entries.forEach((entry) => {
      const path = join(dir, entry);
      try {
        if (statSync(path).isDirectory()) {
          empty.push(...findEmptyDirs(path, exclude));
        }
      } catch {
        // Skip inaccessible directories
      }
    });
  } catch {
    // Skip if directory doesn't exist or is inaccessible
  }

  return empty;
}

console.log("🔍 Running cleanup scan...\n");

// ESLint
console.log("📋 ESLint Warnings:");
const lintOutput = runCommand("npm run -w web lint");
console.log(lintOutput || "✅ No issues");

// Knip (dead code)
console.log("\n🔎 Dead Code (knip):");
const knipOutput = runCommand("npm run -w web deadcode");
console.log(knipOutput || "✅ No unused exports");

// Depcheck
console.log("\n📦 Unused Dependencies (depcheck):");
const depcheckOutput = runCommand("npm run -w web deps:unused");
console.log(depcheckOutput || "✅ All deps used");

// Empty directories
console.log("\n📁 Empty Directories:");
const emptyDirs = findEmptyDirs("apps/web", ["node_modules", ".next", "out"]);
if (emptyDirs.length === 0) {
  console.log("✅ No empty directories");
} else {
  console.log("Consider removing:\n", emptyDirs.join("\n "));
}

console.log("\n✨ Cleanup scan complete!");
