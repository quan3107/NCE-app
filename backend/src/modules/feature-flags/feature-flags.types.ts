/**
 * File: src/modules/feature-flags/feature-flags.types.ts
 * Purpose: Define types for the feature flags module.
 * Why: Keeps feature flag-related types centralized and consistent.
 */

export type FeatureFlag = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
};

export type FeatureFlagRole = {
  id: string;
  featureFlagId: string;
  role: string;
};

export type FeatureFlagsMap = Record<string, boolean>;
