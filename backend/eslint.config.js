/**
 * File: eslint.config.js
 * Purpose: Lint backend TypeScript/JavaScript using ESLint flat config.
 * Why: Maintains code quality with sensible defaults during the TS migration.
 */
import js from "@eslint/js";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

const tsRecommendedRules = tseslint.configs.recommended.rules ?? {};
const prismaGeneratedImportRestriction = [
  "error",
  {
    patterns: [
      {
        group: [
          "**/prisma/generated/client/client.js",
          "**/generated/client/client.js",
        ],
        message:
          "Import Prisma exports from src/prisma/index.js (or src/prisma/generated.js within Prisma boundary files).",
      },
    ],
  },
];

export default defineConfig([
  globalIgnores(["node_modules", "dist"]),
  {
    files: ["**/*.ts"],
    ignores: ["node_modules/**"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tsRecommendedRules,
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^ignored" },
      ],
      "no-restricted-imports": prismaGeneratedImportRestriction,
      "no-console": "off",
    },
  },
  {
    files: ["**/*.js"],
    ignores: ["node_modules/**"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-restricted-imports": prismaGeneratedImportRestriction,
      "no-console": "off",
    },
  },
  {
    files: ["src/prisma/generated.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
]);
