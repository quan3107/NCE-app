

# English Education Backend

Node.js 20 + Express 5 + TypeScript scaffold providing REST APIs for the English education platform.

## Setup
```bash
npm install
npm run prisma:generate
```

Create a `.env` based on `.env.example`, then start the dev server:
```bash
npm run dev
```

To produce production-ready output run:
```bash
npm run build
npm start
```

## Database Seeding
1. Confirm `NODE_ENV` is not set to `production` and the database URL points to a disposable environment.
2. Run `npm run seed` to reset the schema and load representative users, courses, and assignment fixtures.
3. Review the per-table summary log to verify the seed executed successfully.
> Note: The seed script skips .env loading if the optional "dotenv" dependency is absent, so CI environments must export the required variables upfront.

## Tests & Quality
- `npm test` - runs Vitest in the Node environment.
- `npm run lint` - applies ESLint checks.
- `npm run format` - verifies Prettier formatting.

## Structure
- `src/app.ts` - Express app factory.
- `src/server.ts` - HTTP bootstrapper (invoked by dev/start scripts).
- `src/modules/` - Feature modules (auth, users, courses, assignments, submissions, grades, notifications).
- `src/jobs/` - pg-boss workers.
- `src/prisma/` - Prisma schema and migrations.
- `tests/` - Vitest + Supertest suites.

