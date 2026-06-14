/**
 * File: src/modules/ai-feedback/evaluation/index.ts
 * Purpose: Define default-off evaluation and research hooks for AI feedback.
 * Why: Verifier, uncertainty, calibration, shadow, and live benchmark work should remain opt-in after first release.
 */
export type EvaluationHookFlags = {
  verifier: boolean;
  uncertainty: boolean;
  calibration: boolean;
  shadowEvaluation: boolean;
  liveProviderBenchmarks: boolean;
};

export const DEFAULT_EVALUATION_HOOK_FLAGS: EvaluationHookFlags = {
  verifier: false,
  uncertainty: false,
  calibration: false,
  shadowEvaluation: false,
  liveProviderBenchmarks: false,
};

export function buildEvaluationHookConfig(
  overrides: Partial<EvaluationHookFlags> = {},
): EvaluationHookFlags {
  return {
    ...DEFAULT_EVALUATION_HOOK_FLAGS,
    ...overrides,
  };
}
