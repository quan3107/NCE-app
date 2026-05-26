# NCE English Education Platform

NCE is a full-stack web app for IELTS-focused English instruction. It centralizes course management, assignment authoring, student submissions, grading, notifications, and role-based dashboards for teachers, students, and admins.

The repository is a two-app monorepo:

- `frontend/` contains the React/Vite user interface.
- `backend/` contains the Express API, Prisma data model, background jobs, and tests.

## Product Scope

- Teacher workflows for courses, IELTS reading/listening/writing/speaking assignments, submissions, grading, rubrics, analytics, and course management tabs.
- Student workflows for dashboards, assignments, submission detail, grades, notifications, and profile pages.
- Admin workflows for users, courses, enrollments, audit logs, settings, and dashboard overview pages.
- Public pages for home, about, contact, course catalog, course detail, login, registration, and Google OAuth callback.
- Backend APIs for auth, users, courses, enrollments, assignments, submissions, grades, rubrics, notifications, files, CMS content, navigation, dashboard config, IELTS config, audit logs, and analytics.

## Tech Stack

| Area     | Tools                                                                                                |
| -------- | ---------------------------------------------------------------------------------------------------- |
| Frontend | React 18, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS 4, Radix UI, TipTap, Recharts |
| Backend  | Node.js 20+, Express 5, TypeScript, Prisma 7, PostgreSQL, Zod, JWT/OAuth, Pino, pg-boss              |
| Testing  | Frontend Node test runner through `tsx --test`, backend Vitest and Supertest                         |
| Docs     | Modular OpenAPI files in `docs/openapi/`, product notes in `docs/`                                   |

## Prerequisites

- Node.js 20 or newer for the backend.
- npm for package installation and scripts.
- PostgreSQL for the backend database.
- Local JWT key files for access-token signing.
- Google OAuth and Brevo credentials when running the full auth/email flows.

## Environment

Create `backend/.env` before starting the API. There is no committed `.env.example` yet, so use `backend/src/config/env.ts` and `backend/prisma.config.ts` as the source of truth.

Required backend variables:

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

Optional backend variables:

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

Create `frontend/.env` if the frontend should call the local API:

```dotenv
VITE_API_BASE_URL="http://localhost:4000/api/v1"
```

## Run Locally

Install dependencies in each app:

```bash
cd backend
npm install
npm run prisma:generate
```

```bash
cd frontend
npm install
```

Prepare the database after `DATABASE_URL` is configured:

```bash
cd backend
npm run prisma:migrate
npm run seed
npm run seed:ielts-config
```

Run the apps in separate terminals:

```bash
cd backend
npm run dev
```

```bash
cd frontend
npm run dev
```

Default local URLs:

- Frontend: `http://localhost:3000`
- Backend health check: `http://localhost:4000/health`
- API base: `http://localhost:4000/api/v1`

## Useful Scripts

Backend:

| Command                       | Purpose                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`                 | Start the Express API with `tsx watch`.                                      |
| `npm run build`               | Generate Prisma client and compile TypeScript.                               |
| `npm start`                   | Run the compiled server from `dist/server.js`.                               |
| `npm test`                    | Generate Prisma client and run Vitest.                                       |
| `npm run test:coverage`       | Run backend tests with coverage.                                             |
| `npm run lint`                | Run ESLint.                                                                  |
| `npm run format`              | Check Prettier formatting.                                                   |
| `npm run prisma:migrate`      | Run Prisma migrations with `backend/prisma.config.ts`.                       |
| `npm run seed`                | Reset non-production data and seed representative users/courses/assignments. |
| `npm run seed:ielts-config`   | Seed IELTS configuration needed by readiness checks.                         |
| `npm run verify:ielts-config` | Check seeded IELTS config shape.                                             |

Frontend:

| Command         | Purpose                                                   |
| --------------- | --------------------------------------------------------- |
| `npm run dev`   | Start the Vite dev server on port 3000.                   |
| `npm run build` | Build the production frontend into `frontend/build`.      |
| `npm test`      | Run frontend tests with Node's test runner through `tsx`. |

## Repository Layout

```text
backend/
  src/app.ts                 Express app, middleware, /health, /api/v1 mount
  src/server.ts              HTTP bootstrap, startup checks, job runner startup
  src/config/                Environment and logger configuration
  src/middleware/            Auth, role, RLS context, and error middleware
  src/modules/               Feature routers, controllers, schemas, services
  src/jobs/                  Notification and cleanup job workers
  src/prisma/                Prisma schema, generated client, seed scripts
  tests/                     Backend unit and route tests

frontend/
  src/routes/                Public and role-protected route components
  src/features/              Domain modules for assignments, courses, config, etc.
  src/components/            Shared layout, UI primitives, and marketing components
  src/lib/                   API client, auth state, query client, shared helpers
  src/styles/                Tailwind entry and split feature styles
  tests/                     Frontend API/helper tests

docs/
  openapi/                   Modular OpenAPI 3 contract
  ui-mockups/                Screenshot mockups for key app screens
  PRD.md                     Product requirements and user journeys
```

## API Documentation

The OpenAPI entry point is `docs/openapi/openapi.yaml`. It references path and schema files under `docs/openapi/paths/` and `docs/openapi/schemas/`.

The running API mounts versioned routes under `/api/v1`; the health check lives at `/health`.

## Current Status

This is an active full-stack learning-platform project. The frontend contains role-based route surfaces and live API hooks, while the backend contains implemented service modules, validation schemas, Prisma models, route tests, seeding scripts, and background job scaffolding.

Known setup gaps:

- No committed `.env.example` files are present yet.
- The root `package.json` does not define a single command for starting both apps.
- Local auth/email flows require developer-provided Google OAuth, Brevo, and JWT key material.

## License

This project is licensed under the terms in `LICENSE`.
