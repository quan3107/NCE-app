/**
 * Location: src/lib/ielts.ts
 * Purpose: Re-export IELTS assignment types and helpers from focused modules.
 * Why: Preserves the existing @lib/ielts import surface while keeping files small.
 */

export * from './ielts/types';
export * from './ielts/factory';
export * from './ielts/text';
export * from './ielts/questions';
export * from './ielts/normalization';
