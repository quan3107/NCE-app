<!--
File: backend/README.md
Purpose: Document the Express API setup, runtime configuration, scripts, and module layout.
Why: Helps backend contributors run and verify the API without relying on stale scaffold notes.
-->

# NCE Backend API

The backend is a Node.js 20+, Express 5, TypeScript API for the NCE English education platform. It provides versioned REST routes for authentication, courses, enrollments, IELTS assignments, submissions, grading, rubrics, notifications, file metadata, CMS content, app configuration, audit logs, and analytics.

## Prerequisites

- Node.js 20 or newer.
- npm.
- PostgreSQL database access.
- Local JWT private/public key files.
- Google OAuth credentials for Google sign-in flows.
- Brevo credentials for email delivery paths.

## Environment

Create `backend/.env` before running the API. The required values are validated in `src/config/env.ts`.

Required:

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
JWT_PRIVATE_KEY_PATH="path/to/private.pem"
JWT_PUBLIC_KEY_PATH="path/to/public.pem"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
BREVO_API_KEY="your-brevo-api-key"
BREVO_SENDER_NAME="NCE"
BREVO_SENDER_EMAIL="sender@example.com"
```

Optional:

```dotenv
NODE_ENV="development"
PORT="4000"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
GOOGLE_REDIRECT_URI="http://localhost:4000/api/v1/auth/google/callback"
LOG_LEVEL="info"
LOG_PRETTY="true"
PRISMA_TRANSACTION_MAX_WAIT_MS="5000"
PRISMA_TRANSACTION_TIMEOUT_MS="10000"
```

`DIRECT_URL` is used by Prisma CLI operations when present; otherwise Prisma falls back to `DATABASE_URL`.

## Setup

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
```

Seed local data outside production:

```bash
npm run seed
npm run seed:ielts-config
npm run verify:ielts-config
```

Start the API:

```bash
npm run dev
```

Default endpoints:

- Health check: `http://localhost:4000/health`
- API base: `http://localhost:4000/api/v1`

The health check reports IELTS configuration readiness. A local database without IELTS config can make `/health` return `503` even though the development server starts.

## Scripts

| Command                      | Purpose                                                     |
| ---------------------------- | ----------------------------------------------------------- |
| `npm run dev`                | Start `src/server.ts` with `tsx watch`.                     |
| `npm run build`              | Generate Prisma client and compile TypeScript to `dist/`.   |
| `npm start`                  | Run the compiled API from `dist/server.js`.                 |
| `npm test`                   | Generate Prisma client and run Vitest.                      |
| `npm run test:watch`         | Run Vitest in watch mode.                                   |
| `npm run test:coverage`      | Run tests with coverage.                                    |
| `npm run lint`               | Run ESLint.                                                 |
| `npm run format`             | Check Prettier formatting.                                  |
| `npm run format:write`       | Apply Prettier formatting.                                  |
| `npm run prisma:generate`    | Generate the Prisma client from `src/prisma/schema.prisma`. |
| `npm run prisma:migrate`     | Run Prisma migrations using `prisma.config.ts`.             |
| `npm run seed`               | Reset non-production data and seed representative app data. |
| `npm run seed:ielts-config`  | Seed IELTS metadata/configuration.                          |
| `npm run seed:ielts`         | Seed IELTS assignment fixtures.                             |
| `npm run seed:ielts-sandbox` | Seed IELTS sandbox data.                                    |
| `npm run seed:cms`           | Seed CMS content.                                           |
| `npm run seed:navigation`    | Seed navigation configuration.                              |

## API Surface

Routes are mounted in `src/modules/router.ts` under `/api/v1`.

- Auth and identity: `/auth`, `/me`
- Core learning data: `/users`, `/courses`, `/enrollments`, `/assignments`, `/submissions`, `/grades`
- Teaching tools: `/analytics`, `/rubrics`, `/rubrics/templates`
- App operations: `/notifications`, `/files`, `/audit-logs`
- Runtime configuration: `/config/dashboard-widgets`, `/config/file-upload-limits`, `/config/allowed-file-types`, `/config/notification-types`, `/config/course-management-tabs`, `/config/ielts`
- UI content/navigation: `/navigation`, `/cms`, `/me/dashboard-config`, `/me/notification-preferences`

The modular OpenAPI contract lives in `../docs/openapi/openapi.yaml`.

## Structure

```text
src/app.ts             Express middleware, /health, /api/v1 router mount, 404/error handling
src/server.ts          HTTP bootstrap, startup readiness checks, job runner startup, shutdown
src/config/            Environment parsing, logger, Prisma client config helpers
src/middleware/        Auth guard, role guard, RLS context, error handler
src/modules/           Feature routers, controllers, schemas, services, and type helpers
src/jobs/              Notification delivery and cleanup workers
src/prisma/            Prisma schema, generated client, seeds, verification scripts
src/utils/             Shared date, email, and HTTP error helpers
tests/                 Vitest and Supertest coverage for services, middleware, routes, seeds
```

## Data Model

The Prisma schema models users, identities, auth sessions, courses, enrollments, assignments, submissions, grades, rubrics, rubric templates, notifications, files, audit logs, dashboard preferences, navigation, CMS content, and IELTS configuration tables.

Seed scripts are guarded against production resets. Confirm `NODE_ENV` is not `production` and that `DATABASE_URL` points to disposable local data before running seed commands.

## Verification

Run the focused checks that match your change:

```bash
npm test
npm run build
npm run lint
npm run format
```

Some tests can supply dummy env values internally, but full server startup and integration-style flows still require the environment variables listed above.
