/**
 * File: vitest.config.js
 * Purpose: Configure Vitest for backend Node.js environment tests.
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
})
