/**
 * File: eslint.config.js
 * Purpose: Lint frontend TypeScript, TSX, and JavaScript files with a flat ESLint config.
 * Why: Adds the missing frontend quality gate required by PR-02.
 */
import js from '@eslint/js';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

const tsRecommendedRules = tseslint.configs.recommended.rules ?? {};

export default defineConfig([
  globalIgnores(['build', 'coverage', 'node_modules']),
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['build/**', 'node_modules/**'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tsRecommendedRules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^ignored' },
      ],
      'no-console': 'off',
    },
  },
  {
    files: ['**/*.js'],
    ignores: ['build/**', 'node_modules/**'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
]);
