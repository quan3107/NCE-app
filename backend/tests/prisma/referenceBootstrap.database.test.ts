/**
 * File: tests/prisma/referenceBootstrap.database.test.ts
 * Purpose: Prove production reference bootstrap is repeatable and demo-free.
 * Why: Production initialization must restore required defaults without changing owned data.
 */
import { describe, expect, it } from 'vitest'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

import { PrismaClient } from '../../src/prisma/generated.js'
import {
  bootstrapReferenceData,
  runReferenceBootstrap,
} from '../../src/prisma/seedReference.js'
import {
  requireDatabaseTestOwnerUrl,
  runDatabaseTestTransaction,
} from './databaseTestClient.js'

const databaseDescribe =
  process.env.CI === 'true' || process.env.RUN_DATABASE_TESTS === 'true'
    ? describe
    : describe.skip

databaseDescribe('production reference bootstrap', () => {
  it('serializes overlapping production entrypoint runs', async () => {
    const pools = [new Pool({ connectionString: requireDatabaseTestOwnerUrl() })]
    pools.push(new Pool({ connectionString: requireDatabaseTestOwnerUrl() }))
    const clients = pools.map((pool) => new PrismaClient({ adapter: new PrismaPg(pool) }))

    try {
      await clients[0].navigationItem.deleteMany({
        where: { role: 'student', path: '/student/dashboard', parentId: null },
      })
      await Promise.all(clients.map((client) => runReferenceBootstrap(client)))

      await expect(
        clients[0].navigationItem.count({
          where: { role: 'student', path: '/student/dashboard', parentId: null },
        }),
      ).resolves.toBe(1)
    } finally {
      await Promise.all(clients.map((client) => client.$disconnect()))
      await Promise.all(pools.map((pool) => pool.end()))
    }
  })

  it('restores v1 inactive when v2 is already active', async () => {
    await expect(
      runDatabaseTestTransaction(async (tx) => {
        await tx.ieltsConfigVersion.deleteMany({ where: { version: 2 } })
        await tx.ieltsConfigVersion.create({
          data: { version: 2, name: 'Production v2', isActive: true },
        })
        await tx.ieltsConfigVersion.deleteMany({ where: { version: 1 } })

        await bootstrapReferenceData(tx)

        await expect(
          tx.ieltsConfigVersion.findUniqueOrThrow({ where: { version: 1 } }),
        ).resolves.toMatchObject({ isActive: false, activatedAt: null })
        await expect(
          tx.ieltsConfigVersion.findMany({
            where: { isActive: true },
            select: { version: true },
          }),
        ).resolves.toEqual([{ version: 2 }])
        await expect(
          tx.ieltsQuestionOption.count({ where: { configVersion: 1 } }),
        ).resolves.toBeGreaterThan(0)

        throw new Error('ROLLBACK_ACTIVE_IELTS_TEST')
      }),
    ).rejects.toThrow('ROLLBACK_ACTIVE_IELTS_TEST')
  })

  it('restores missing references once without demo or mutable-data changes', async () => {
    await expect(
      runDatabaseTestTransaction(async (tx) => {
        const demoCountsBefore = await Promise.all([
          tx.user.count(),
          tx.course.count(),
          tx.assignment.count(),
        ])

        await tx.notificationTypeConfig.deleteMany({
          where: { role: 'student', type: 'due_soon' },
        })
        await tx.dashboardWidgetDefinition.deleteMany({
          where: { role: 'student', widgetKey: 'student_due_soon' },
        })
        const studentPolicy = await tx.fileUploadPolicy.findUniqueOrThrow({
          where: { role: 'student' },
        })
        await tx.fileUploadAllowedType.deleteMany({
          where: { policyId: studentPolicy.id, acceptToken: '.pdf' },
        })
        await tx.ieltsQuestionOption.deleteMany({
          where: {
            configVersion: 1,
            optionType: 'true_false',
            value: 'true',
          },
        })
        await tx.permission.deleteMany({ where: { key: 'courses:read' } })
        await tx.navigationItem.deleteMany({
          where: { role: 'student', path: '/student/dashboard' },
        })
        await tx.cmsPageContent.deleteMany({ where: { pageKey: 'contact' } })

        await tx.notificationTypeConfig.updateMany({
          where: { role: 'student', type: 'graded' },
          data: { label: 'Production-owned label' },
        })

        await bootstrapReferenceData(tx)
        const countsAfterFirst = await Promise.all([
          tx.permission.count(),
          tx.rolePermission.count(),
          tx.navigationItem.count(),
          tx.notificationTypeConfig.count(),
          tx.dashboardWidgetDefinition.count(),
          tx.fileUploadPolicy.count(),
          tx.fileUploadAllowedType.count(),
          tx.ieltsConfigVersion.count(),
          tx.ieltsQuestionOption.count(),
          tx.cmsPageContent.count(),
        ])

        await bootstrapReferenceData(tx)
        const countsAfterSecond = await Promise.all([
          tx.permission.count(),
          tx.rolePermission.count(),
          tx.navigationItem.count(),
          tx.notificationTypeConfig.count(),
          tx.dashboardWidgetDefinition.count(),
          tx.fileUploadPolicy.count(),
          tx.fileUploadAllowedType.count(),
          tx.ieltsConfigVersion.count(),
          tx.ieltsQuestionOption.count(),
          tx.cmsPageContent.count(),
        ])

        expect(countsAfterSecond).toEqual(countsAfterFirst)
        await expect(
          tx.notificationTypeConfig.findUniqueOrThrow({
            where: {
              role_type: { role: 'student', type: 'graded' },
            },
          }),
        ).resolves.toMatchObject({ label: 'Production-owned label' })
        expect(
          await tx.notificationTypeConfig.count({
            where: { role: 'student', type: 'due_soon' },
          }),
        ).toBe(1)
        expect(
          await tx.dashboardWidgetDefinition.count({
            where: { role: 'student', widgetKey: 'student_due_soon' },
          }),
        ).toBe(1)
        expect(
          await tx.fileUploadAllowedType.count({
            where: { policyId: studentPolicy.id, acceptToken: '.pdf' },
          }),
        ).toBe(1)
        expect(
          await tx.ieltsQuestionOption.count({
            where: {
              configVersion: 1,
              optionType: 'true_false',
              value: 'true',
            },
          }),
        ).toBe(1)
        const permission = await tx.permission.findUniqueOrThrow({
          where: { key: 'courses:read' },
          select: { id: true },
        })
        expect(
          (
            await tx.rolePermission.findMany({
              where: { permissionId: permission.id },
              select: { role: true },
            })
          )
            .map(({ role }) => role)
            .sort(),
        ).toEqual(['admin', 'student', 'teacher'])
        expect(
          await tx.navigationItem.count({
            where: { role: 'student', path: '/student/dashboard' },
          }),
        ).toBe(1)
        expect(await tx.cmsPageContent.count({ where: { pageKey: 'contact' } })).toBe(1)
        expect(
          await Promise.all([tx.user.count(), tx.course.count(), tx.assignment.count()]),
        ).toEqual(demoCountsBefore)

        throw new Error('ROLLBACK_REFERENCE_BOOTSTRAP_TEST')
      }),
    ).rejects.toThrow('ROLLBACK_REFERENCE_BOOTSTRAP_TEST')
  })
})
