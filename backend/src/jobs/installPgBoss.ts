/**
 * File: src/jobs/installPgBoss.ts
 * Purpose: Install or upgrade pg-boss with the deployment-only database owner.
 * Why: The long-running worker identity must not receive schema migration rights.
 */
import PgBoss from 'pg-boss'

const directUrl = process.env.DIRECT_URL
if (!directUrl) {
  throw new Error('DIRECT_URL is required to install or upgrade pg-boss.')
}

const boss = new PgBoss({
  application_name: 'nce-app-pgboss-migration',
  connectionString: directUrl,
  schedule: false,
  supervise: false,
})

try {
  await boss.start()
} finally {
  await boss.stop({ graceful: true, wait: true })
}
