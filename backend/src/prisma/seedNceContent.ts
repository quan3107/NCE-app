/**
 * File: src/prisma/seedNceContent.ts
 * Purpose: Run the idempotent NCE content seed.
 * Why: Lets deployments and developers seed NCE reference content without resetting demo data.
 */
import { basePrisma } from './client.js'
import { seedNceContent } from './seeds/nceContent.seed.js'

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed in production mode.')
  }

  const result = await seedNceContent(basePrisma)
  console.info(
    `NCE content seed complete (books=${result.books}, lessons=${result.lessons}, courseAssignments=${result.courseAssignments}).`,
  )
}

main()
  .catch((error) => {
    console.error('NCE content seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await basePrisma.$disconnect()
  })
