/**
 * File: tests/setup/env.ts
 * Purpose: Apply backend test environment defaults before application modules load.
 * Why: Prevents missing local secrets from breaking Vitest collection.
 */
import { applyBackendTestEnvDefaults } from './testEnvDefaults.js'

applyBackendTestEnvDefaults()
