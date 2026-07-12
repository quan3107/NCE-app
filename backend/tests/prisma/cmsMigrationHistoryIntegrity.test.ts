/**
 * Location: tests/prisma/cmsMigrationHistoryIntegrity.test.ts
 * Purpose: Lock applied CMS migration files to the bytes recorded by hosted Prisma.
 * Why: Editing an applied migration breaks migration-history integrity without upgrading databases.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const appliedCmsChecksums = {
  '20260710100000_add_cms_drafts_revisions': {
    revision: '3528eeab96c7369c61607fc06733604eb5a46054',
    checksum: 'eb447228ab910b678233abf504b3fbe7850e910a82ccb67ebbdb8029e29bd878',
  },
  '20260710103000_secure_cms_admin_writes': {
    revision: 'fff7c274a67e3d229be85e954bef9b8668b568fc',
    checksum: 'e5f9d065cc5ae39d02e79481c6932257cd950fa95805e9ed50d042549c2d5680',
  },
  '20260710110000_bootstrap_cms_admin_data': {
    revision: '6f211e3717442598970cf9fb5bfe98e272b651ee',
    checksum: '99057d98e150f6523e6e325c96c8551696e5fe349de8e9f9172a097460bdb8ac',
  },
  '20260710110100_bootstrap_cms_homepage': {
    revision: 'a8cb171fccf899daf71d7040dc2568490f690d46',
    checksum: 'c9ec4579af3c2f50561e08f962cbd5a6dc01bae7c928ab04ce01d4be47e65d85',
  },
  '20260710110200_bootstrap_cms_about_page': {
    revision: 'db35beebe85d94fc0dc31e9c3aae297b30b71b83',
    checksum: 'd44f16a55fa4c9bdea42352f19360817b431f3a85424e48501c84456e0347a46',
  },
  '20260711160000_reconcile_cms_draft_schema': {
    revision: '17aa4ee6c716ddb6bd81d5286d5d94741da211b5',
    checksum: 'da43292c5e6a622783f9a2b7825e45b9e21eee2827c522a2be6e90bb8c3ed385',
  },
} as const

describe('applied CMS migration history', () => {
  for (const [migrationName, deployed] of Object.entries(appliedCmsChecksums)) {
    it(`preserves ${migrationName} from ${deployed.revision}`, () => {
      const migration = readFileSync(
        resolve(process.cwd(), `src/prisma/migrations/${migrationName}/migration.sql`),
      )
      const checksum = createHash('sha256').update(migration).digest('hex')

      expect(checksum).toBe(deployed.checksum)
    })
  }
})
