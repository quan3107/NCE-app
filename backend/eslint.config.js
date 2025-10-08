/**
 * File: eslint.config.js
 * Purpose: Lint backend JavaScript using ESLint flat config.
 */
import js from '@eslint/js'
import globals from 'globals'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['node_modules', 'dist']),
  {
    files: ['**/*.js'],
    ignores: ['node_modules/**'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
])
