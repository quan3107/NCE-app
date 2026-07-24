/**
 * File: tests/prisma/referenceBootstrap.database.test.ts
 * Purpose: Prove production reference bootstrap is repeatable and demo-free.
 * Why: Production initialization must restore required defaults without changing owned data.
 */
import { describe, expect, it } from 'vitest'
import {
  REFERENCE_BOOTSTRAP_LOCK_ID,
  bootstrapReferenceData,
} from '../../src/prisma/seedReference.js'
import { runDatabaseTestTransaction } from './databaseTestClient.js'

const databaseDescribe =
  process.env.CI === 'true' || process.env.RUN_DATABASE_TESTS === 'true'
    ? describe
    : describe.skip
databaseDescribe('production reference bootstrap', () => {
  it('reactivates existing v1 when no IELTS configuration is active', async () => {
    await expect(
      runDatabaseTestTransaction(async (tx) => {
        await tx.$queryRawUnsafe(
          `SELECT pg_advisory_xact_lock(${REFERENCE_BOOTSTRAP_LOCK_ID})::text`,
        )
        await tx.ieltsConfigVersion.updateMany({ data: { isActive: false } })

        await bootstrapReferenceData(tx)

        await expect(
          tx.ieltsConfigVersion.findUniqueOrThrow({ where: { version: 1 } }),
        ).resolves.toMatchObject({ isActive: true })

        throw new Error('ROLLBACK_INACTIVE_IELTS_TEST')
      }),
    ).rejects.toThrow('ROLLBACK_INACTIVE_IELTS_TEST')
  })

  it('restores v1 inactive when v2 is already active', async () => {
    await expect(
      runDatabaseTestTransaction(async (tx) => {
        await tx.$queryRawUnsafe(
          `SELECT pg_advisory_xact_lock(${REFERENCE_BOOTSTRAP_LOCK_ID})::text`,
        )
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
        await tx.$queryRawUnsafe(
          `SELECT pg_advisory_xact_lock(${REFERENCE_BOOTSTRAP_LOCK_ID})::text`,
        )
        // Transaction-local sentinels isolate this assertion from fixtures that
        // other database test files create concurrently.
        const sentinelUser = await tx.user.create({
          data: {
            email: 'reference-bootstrap-sentinel@example.test',
            fullName: 'Reference bootstrap sentinel',
            role: 'teacher',
            status: 'active',
          },
        })
        const sentinelCourse = await tx.course.create({
          data: {
            title: 'Reference bootstrap sentinel course',
            ownerId: sentinelUser.id,
          },
        })
        const sentinelAssignment = await tx.assignment.create({
          data: {
            title: 'Reference bootstrap sentinel assignment',
            type: 'reading',
            courseId: sentinelCourse.id,
          },
        })

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
        await expect(
          Promise.all([
            tx.user.findUniqueOrThrow({ where: { id: sentinelUser.id } }),
            tx.course.findUniqueOrThrow({ where: { id: sentinelCourse.id } }),
            tx.assignment.findUniqueOrThrow({ where: { id: sentinelAssignment.id } }),
          ]),
        ).resolves.toMatchObject([
          { email: sentinelUser.email, fullName: sentinelUser.fullName },
          { title: sentinelCourse.title, ownerId: sentinelUser.id },
          { title: sentinelAssignment.title, courseId: sentinelCourse.id },
        ])

        throw new Error('ROLLBACK_REFERENCE_BOOTSTRAP_TEST')
      }),
    ).rejects.toThrow('ROLLBACK_REFERENCE_BOOTSTRAP_TEST')
  })

  it('preserves a managed navigation item after it is reparented', async () => {
    await expect(
      runDatabaseTestTransaction(async (tx) => {
        await tx.$queryRawUnsafe(
          `SELECT pg_advisory_xact_lock(${REFERENCE_BOOTSTRAP_LOCK_ID})::text`,
        )
        await bootstrapReferenceData(tx)
        const managedItem = await tx.navigationItem.findFirstOrThrow({
          where: { role: 'student', path: '/student/dashboard' },
          select: { id: true },
        })
        const parent = await tx.navigationItem.create({
          data: {
            role: 'student',
            label: 'Custom parent',
            path: '/student/custom-parent',
            iconName: 'folder',
            orderIndex: 99,
          },
          select: { id: true },
        })
        await tx.navigationItem.update({
          where: { id: managedItem.id },
          data: { parentId: parent.id },
        })

        await bootstrapReferenceData(tx)

        await expect(
          tx.navigationItem.findMany({
            where: { role: 'student', path: '/student/dashboard' },
            select: { id: true, parentId: true },
          }),
        ).resolves.toEqual([{ id: managedItem.id, parentId: parent.id }])

        throw new Error('ROLLBACK_REPARENTED_NAVIGATION_TEST')
      }),
    ).rejects.toThrow('ROLLBACK_REPARENTED_NAVIGATION_TEST')
  })
})
