<!--
File: docs/npm-security-update-path-2026-05-25.md
Purpose: Document the npm security update path applied to this project.
Why: Keeps dependency hardening traceable to recent advisories and local package evidence.
-->

# npm Security Update Path - 2026-05-25

## Summary

This branch applies the safe npm update path under the latest Node Current runtime:

- Node used: `v26.2.0`
- npm used: `11.15.0`
- Branch: `npm-security-updates-2026-05`

The update avoids broad major migrations. It tracks npm lockfiles, repairs the missing lockfile state, patches direct advisory exposure, and pins a vulnerable Prisma toolchain transitive with an npm override.

## Recent Incident Exposure

Internet and local package checks found no current manifest evidence for these recent npm compromise families:

| Incident family | Repo evidence |
| --- | --- |
| TanStack Router/Start Mini Shai-Hulud packages | No affected Router/Start package names found. |
| `@antv`, `echarts-for-react`, `size-sensor` | No package-name matches found. |
| Axios malicious versions | No `axios` or `plain-crypto-js` package-name matches found. |
| Nx S1ngularity packages | No `nx` or `@nx/*` package-name matches found. |
| OpenSearch, Mistral, UiPath, Guardrails, Squawk indicators | No package-name matches found. |

`@tanstack/react-query` is present in the frontend, but it is not listed in the TanStack Router/Start GHSA affected package table. TanStack's postmortem also identifies the Query family as clean.

Lockfiles were absent on `origin/main`, so historical install exposure cannot be proven from the repository alone. If CI or developer machines installed affected packages during the incident windows, rotate exposed secrets for those hosts.

## Applied Updates

### Repository-level

- Stopped ignoring npm lockfiles so installs become reproducible and auditable.
- Added a root `package-lock.json`.
- Updated root `@types/node` to the latest available package line: `^25.9.1`.

### Frontend

| Package | Previous | Updated | Reason |
| --- | --- | --- | --- |
| `vite` | `6.3.5` | `6.4.2` | Clears Vite 6 advisory set including arbitrary file read via dev server WebSocket. |

The frontend lockfile now resolves the declared dependency set without major framework migration. React remains on 18, React Router on 6, Tiptap on 2, and Vite on 6.

### Backend

| Package | Previous | Updated | Reason |
| --- | --- | --- | --- |
| `prisma` | `^7.3.0` | `^7.8.0` | Aligns Prisma CLI with current safe 7.x. |
| `@prisma/client` | `^7.3.0` | `^7.8.0` | Keeps Prisma client aligned with CLI. |
| `@prisma/adapter-pg` | `^7.3.0` | `^7.8.0` | Keeps adapter aligned with Prisma client. |
| `express` | `^5.1.0` | `^5.2.1` | Pulls current Express 5 patch line. |
| `cors` | `^2.8.5` | `^2.8.6` | Non-major patch update. |
| `dotenv` | `^17.2.3` | `^17.4.2` | Non-major patch update. |
| `helmet` | `^8.1.0` | `^8.2.0` | Non-major patch update. |
| `jose` | `^6.1.0` | `^6.2.3` | Non-major patch update. |
| `jsonwebtoken` | `^9.0.2` | `^9.0.3` | Non-major patch update. |
| `openid-client` | `^6.8.1` | `^6.8.4` | Non-major patch update. |
| `pg` | `^8.16.3` | `^8.21.0` | Non-major patch update. |
| `pg-boss` | `^11.0.5` | `^11.1.2` | Stays on v11, avoids v12 migration. |
| `pino` | `^10.0.0` | `^10.3.1` | Non-major patch update. |
| `zod` | `^4.1.11` | `^4.4.3` | Non-major patch update. |
| `@hono/node-server` | transitive | `1.19.13` override | Clears Prisma dev-tooling audit path. |

Backend dev dependencies were also raised to current non-major safe lines, while avoiding ESLint 10, TypeScript 6, Vitest 4, and pg-boss 12.

## Verification Commands

Run under Node `v26.2.0` and npm `11.15.0`:

```powershell
npm audit
npm audit signatures

npm --prefix frontend ci --ignore-scripts
npm --prefix frontend audit
npm --prefix frontend audit signatures
npm --prefix frontend test
npm --prefix frontend run build

npm --prefix backend ci --ignore-scripts
npm --prefix backend audit
npm --prefix backend audit signatures
npm --prefix backend run prisma:generate
npm --prefix backend run build
npm --prefix backend run lint
npm --prefix backend test
```

## Local Verification Results

All commands below were run with Node `v26.2.0` and npm `11.15.0`.

| Command | Result |
| --- | --- |
| `npm ci --ignore-scripts` | Passed; root install audited 3 packages with 0 vulnerabilities. |
| `npm audit` | Passed; 0 vulnerabilities. |
| `npm audit signatures` | Passed; 2 packages had verified registry signatures and 1 package had a verified attestation. |
| `npm --prefix frontend ci --ignore-scripts` | Passed; 313 packages audited with 0 vulnerabilities. |
| `npm --prefix frontend audit` | Passed; 0 vulnerabilities. |
| `npm --prefix frontend audit signatures` | Passed; 312 packages had verified registry signatures and 48 packages had verified attestations. |
| `npm --prefix frontend test` | Passed; 57 tests passed. |
| `npm --prefix frontend run build` | Passed; Vite built successfully with the existing large-chunk warning. |
| `npm --prefix backend ci --ignore-scripts` | Passed; 491 packages audited with 0 vulnerabilities. |
| `npm --prefix backend audit` | Passed; 0 vulnerabilities. |
| `npm --prefix backend audit signatures` | Passed; 490 packages had verified registry signatures and 100 packages had verified attestations. |
| `npm --prefix backend run build` | Passed with test env variables and `DIRECT_URL` set. |
| `npm --prefix backend run lint` | Passed with 0 errors and 5 existing warnings. |
| `npm --prefix backend test` | Passed; 28 test files and 94 tests passed. |

Backend Prisma commands require `DIRECT_URL`. Local backend verification used dummy test URLs and dummy external-service env values. Some route tests log expected `ECONNREFUSED` messages because they exercise fallback/error handling without a local Postgres server.

## Sources

- GitHub Changelog: [Staged publishing and new install-time controls for npm](https://github.blog/changelog/2026-05-22-staged-publishing-and-new-install-time-controls-for-npm/)
- npm Docs: [Trusted publishing for npm packages](https://docs.npmjs.com/trusted-publishers/)
- npm Docs: [Verifying ECDSA registry signatures](https://docs.npmjs.com/verifying-registry-signatures)
- Node.js: [Node.js releases](https://nodejs.org/en/about/previous-releases)
- GitHub Advisory: [Malware in @tanstack/* packages](https://github.com/advisories/GHSA-g7cv-rxg3-hmpx)
- TanStack: [npm supply-chain compromise postmortem](https://tanstack.com/blog/npm-supply-chain-compromise-postmortem)
- Microsoft Security: [Mini Shai Hulud compromised @antv npm packages](https://www.microsoft.com/en-us/security/blog/2026/05/20/mini-shai-hulud-compromised-antv-npm-packages-enable-ci-cd-credential-theft/)
- GitHub Advisory: [Malware in axios](https://github.com/advisories/GHSA-fw8c-xr5c-95f9)
- Nx: [S1ngularity postmortem](https://nx.dev/blog/s1ngularity-postmortem)
- GitHub Advisory: [Vite arbitrary file read via dev server WebSocket](https://github.com/advisories/GHSA-p9ff-h696-f583)
- GitHub Advisory: [Rollup arbitrary file write](https://github.com/advisories/GHSA-mw96-cpmx-2vgc)
- GitHub Advisory: [Picomatch ReDoS](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj)
- GitHub Advisory: [PostCSS XSS in stringify output](https://github.com/advisories/GHSA-qx2v-qp2m-jg93)
