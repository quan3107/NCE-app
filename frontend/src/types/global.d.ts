/**
 * Location: src/types/global.d.ts
 * Purpose: Extend TypeScript globals for the refactored frontend.
 * Why: Provides shared ambient declarations without scattering them across features.
 */

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
