# NCE App

NCE is an IELTS teaching platform I am building to keep courses, exam-style assignments, submissions, rubrics, grading, and feedback in one place.

The core workflow is simple:

- students see their IELTS work, submit answers, and review grades;
- teachers create real reading, listening, writing, and speaking tasks, then grade or review submissions;
- the AI feedback layer drafts IELTS writing feedback for teacher-controlled review or provisional visibility and generates objective explanations;
- admins keep users, courses, enrollments, and audit trails in order.

This is a full-stack TypeScript app: React/Vite on the frontend, Express on the backend, Prisma/PostgreSQL for data, and OpenAPI docs for the API contract.

## What Is Working Now

The public side has a CMS-backed homepage, about page, searchable course catalog, course details, login, registration, and Google OAuth callback routes.

The student side has dashboards, assignment lists, assignment details, submission flows, grades, feedback, notifications, and profile management.

The teacher side has course management, configurable course tabs, IELTS assignment authoring, draft autosave, preview mode, rubric selection, a submissions queue, grading, analytics, notifications, rubrics, and profile management.

The admin side has user, course, enrollment, audit log, dashboard, and settings screens.

The backend already has real modules for auth, users, courses, enrollments, assignments, submissions, grades, rubrics, notifications, notification preferences, navigation, dashboard widgets, CMS content, IELTS config, file metadata, audit logs, and background jobs.

## AI Feedback Layer

Current flow:

1. A teacher publishes an IELTS or NCE-style assignment with instructions, scoring criteria, and expected learning objectives.
2. A student submits a response.
3. Objective reading/listening work can be scored deterministically where answer keys exist.
4. The backend AI layer can draft IELTS writing feedback and reading/listening objective explanations through hosted OpenAI-compatible routes.
5. The teacher reviews, edits, accepts, or rejects writing feedback drafts when assignment policy requires review.
6. The student sees teacher-approved feedback, instant provisional feedback when enabled, grades, and deterministic scoring explanations.

## Stack

| Layer | Choices |
| --- | --- |
| Frontend | React 18, Vite 6, TypeScript, React Router, TanStack Query |
| UI | Tailwind CSS 4, Radix UI primitives, lucide-react, Tiptap, Recharts |
| Backend | Node.js 20+, Express 5, TypeScript, Zod, Pino |
| Data | PostgreSQL, Prisma 7, Prisma pg adapter, row-level security context |
| Auth | Password login, Google OAuth, RSA JWT access tokens, HTTP-only refresh cookies |
| AI | Hosted OpenAI-compatible provider routes, teacher-reviewed writing drafts, objective explanations, provider-free harness |
| Jobs | pg-boss workers for notification scheduling and delivery |
| Email | Brevo transactional email |
| Tests | Node test runner and c8 on the frontend; Vitest and Supertest on the backend |

## Run It Locally

You need Node.js 20+, npm, PostgreSQL, and `psql` access to create the app's local database roles.

Install dependencies from the repo root:

```bash
npm ci --ignore-scripts
npm --prefix backend ci
npm --prefix frontend ci
```

Create the backend environment file:

```bash
cp backend/.env.example backend/.env
```

Use your local database values in `backend/.env`. For the current Vite setup, make sure CORS points at port `3000`:

```dotenv
DATABASE_URL=postgres://postgres:postgres@localhost:5432/nce_app
DIRECT_URL=postgres://postgres:postgres@localhost:5432/nce_app
GOOGLE_REDIRECT_URI=http://localhost:4000/api/v1/auth/google/callback
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

`backend/.env.example` still lists Vite's default `5173`, but this project runs the frontend on `3000`.

Create stable local JWT keys:

```bash
mkdir -p backend/keys
openssl genrsa -out backend/keys/private.pem 2048
openssl rsa -in backend/keys/private.pem -pubout -out backend/keys/public.pem
```

Create the local database:

```bash
createdb nce_app
```

Create the runtime roles Prisma uses for RLS-aware requests:

```bash
psql postgres <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role;
  END IF;
END
$$;
SQL
```

Generate Prisma, run migrations, and seed the local app:

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
npm run seed:ielts-config
npm run seed:cms
npm run seed:navigation
npm run seed
npm run verify:ielts-config
```

Start the backend:

```bash
cd backend
npm run dev
```

The API runs on `http://localhost:4000`. The health check is:

```bash
curl http://localhost:4000/health
```

Start the frontend in another terminal:

```bash
cd frontend
npm run dev
```

The app runs on `http://localhost:3000`. `frontend/.env` should point at the versioned API base:

```dotenv
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

Run the classroom browser workflow from the repo root:

```bash
npm --prefix frontend run e2e
```

The Playwright workflow starts the Vite dev server on `http://127.0.0.1:3000`, uses isolated mocked classroom API state, and captures screenshots/traces when the teacher publish, student submit, teacher grade, or student feedback visibility path fails.

## Local Accounts

The main seed creates these accounts:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `rosa.admin@ielts.local` | `Passw0rd!` |
| Teacher | `sarah.tutor@ielts.local` | `Passw0rd!` |
| Student | `amelia.chan@ielts.local` | `Passw0rd!` |

It also creates extra teachers and students so course rosters, submissions, notifications, files, grades, and audit logs have realistic local data.

## Project Shape

```text
.
|-- frontend/
|   |-- src/routes/       public, student, teacher, and admin routes
|   |-- src/features/     domain modules used by the routes
|   |-- src/components/   layout, marketing, shared UI, and primitives
|   `-- tests/            frontend unit and behavior tests
|-- backend/
|   |-- src/app.ts        Express app, middleware, health check, /api/v1 mount
|   |-- src/server.ts     HTTP bootstrap, readiness checks, and job startup
|   |-- src/modules/      route/controller/schema/service modules
|   |-- src/prisma/       schema, migrations, generated client, and seeds
|   |-- src/jobs/         pg-boss notification workers
|   `-- tests/            Vitest coverage for config, routes, services, jobs, seeds
|-- docs/openapi/         OpenAPI paths and schemas
`-- .github/workflows/ci.yml
```

All API routes mount under `/api/v1`. The OpenAPI entry point is `docs/openapi/openapi.yaml`.

The Prisma client applies request-scoped database context. Public requests run as `anon`; authenticated requests run as `authenticated` with `app.current_user_id` and `app.current_user_role`; auth internals use `service_role` where needed.

## Useful Commands

Frontend commands, from `frontend/`:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite on port `3000`. |
| `npm run build` | Build into `frontend/build`. |
| `npm run lint` | Run ESLint with zero warnings allowed. |
| `npm run typecheck` | Run `tsc --noEmit`. |
| `npm test` | Run frontend tests. |
| `npm run test:coverage` | Run frontend tests with c8 coverage. |

Backend commands, from `backend/`:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Express API with `tsx watch`. |
| `npm run build` | Generate Prisma and compile TypeScript. |
| `npm start` | Run `dist/server.js`. |
| `npm run lint` | Run ESLint. |
| `npm test` | Generate Prisma and run Vitest with `NODE_ENV=test`. |
| `npm run test:coverage` | Run backend tests with coverage. |
| `npm run prisma:migrate` | Apply local development migrations. |
| `npm run seed:ielts-config` | Seed IELTS reference data required at startup. |
| `npm run seed:cms` | Seed homepage and about-page CMS content. |
| `npm run seed:navigation` | Seed permissions, navigation, and feature flags. |
| `npm run seed` | Reset and seed representative local app data. |
| `npm run verify:ielts-config` | Check that the active IELTS config is complete. |

## Testing

The GitHub Actions workflow runs:

- root install and high-severity npm audit;
- frontend install, audit, lint, typecheck, tests, coverage, and build;
- backend install, audit, Prisma generation, Postgres role bootstrap, migration deploy, CMS seed, lint, build, and tests.

The local pre-PR pass I usually want is:

```bash
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend test
npm --prefix frontend run build

npm --prefix backend run lint
npm --prefix backend run build
npm --prefix backend test
```

Backend tests apply deterministic defaults from `backend/tests/setup/testEnvDefaults.ts`. Database-backed paths still need PostgreSQL and the `anon`, `authenticated`, and `service_role` roles.

## Production Notes

Production needs:

- Node.js 20+ for the backend runtime;
- PostgreSQL with migrations applied through `npx prisma migrate deploy --config prisma.config.ts`;
- runtime roles `anon`, `authenticated`, and `service_role`;
- active IELTS reference data verified by `npm run verify:ielts-config`;
- explicit `CORS_ALLOWED_ORIGINS` because production refuses an empty allowlist;
- a real `TRUST_PROXY` list, not a boolean;
- RSA JWT key files or `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY`;
- Google OAuth credentials and redirect URI;
- Brevo sender credentials for email delivery;
- `NCE_ASSET_ROOT` pointing at mounted NCE audio files, with keys rooted under `nce/`;
- a built frontend with `VITE_API_BASE_URL` set to the deployed API base, including `/api/v1`.

The backend starts pg-boss workers outside `NODE_ENV=test`, so production scaling needs a deliberate worker plan.

## Current Limits

- File upload signing currently returns mock storage URLs and stores file metadata. Real object storage signing is still missing.
- The AI feedback layer is implemented for hosted OpenAI-compatible writing drafts and objective explanations, but speaking AI is deferred, advanced remediation is not built, and production use still needs real provider credentials plus route/image-capability validation.
- Google OAuth and Brevo email paths need real provider credentials.
- Some older package-local notes may lag behind this root README.

## License

MIT. See `LICENSE`.
