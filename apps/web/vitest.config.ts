import { defineConfig } from "vitest/config";
import path from "path";
import { config } from "dotenv";

// Load .env.local for tests (Vitest doesn't load it automatically like Next.js does)
config({ path: path.resolve(__dirname, ".env.local") });

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "@lib": path.resolve(__dirname, "./lib"),
      "@app-types": path.resolve(__dirname, "./types"),
      // Mock server-only package to allow tests to run in Node.js environment
      "server-only": path.resolve(
        __dirname,
        "./lib/server/external/__tests__/__mocks__/server-only.ts"
      ),
    },
  },
});

