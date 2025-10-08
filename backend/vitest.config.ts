/**
 * File: vitest.config.ts
 * Purpose: Configure Vitest for backend TypeScript tests in a Node environment.
 * Why: Ensures the test runner understands `.ts` sources after the TypeScript migration.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
