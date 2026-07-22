/**
 * File: src/prisma/seedNceContent.ts
 * Purpose: Run the idempotent NCE content seed.
 * Why: Lets deployments and developers seed NCE reference content without resetting demo data.
 */
import { basePrisma, shutdownPrisma } from './client.js'
import { assertDemoSeedTarget } from './demoSeedPolicy.js'
import { seedNceContent } from './seeds/nceContent.seed.js'

async function main(): Promise<void> {
  assertDemoSeedTarget()

  const result = await seedNceContent(basePrisma)
  console.info(
    `NCE content seed complete (books=${result.books}, lessons=${result.lessons}, courseAssignments=${result.courseAssignments}).`,
  )
}

main()
  .catch((error) => {
    console.error(
      'NCE content seed failed:',
      error instanceof Error ? error.message : String(error),
    )
    process.exitCode = 1
  })
  .finally(shutdownPrisma)
