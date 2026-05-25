<!--
File: PROGRESS.md
Purpose: Track high-level progress updates for the English education app, split by backend and frontend.
Why: Provides shared visibility into recent dependency hardening work per project guidelines.
-->

# Progress Log

## Backend

- **2026-05-25:** Created the `npm-security-updates-2026-05` branch for the safe npm update path using Node `v26.2.0` and npm `11.15.0`. Added backend lockfile tracking, updated Prisma packages to `7.8.0`, updated Express/runtime dependencies along non-major lines, added an `@hono/node-server@1.19.13` override to clear the Prisma dev-tooling audit path, and replaced an explicit `any` in the Prisma RLS delegate wrapper so lint has no errors.

## Frontend

- **2026-05-25:** Created the `npm-security-updates-2026-05` branch for the safe npm update path using Node `v26.2.0` and npm `11.15.0`. Added frontend lockfile tracking, patched Vite from `6.3.5` to `6.4.2`, and kept major framework lines stable while regenerating the frontend lockfile.
