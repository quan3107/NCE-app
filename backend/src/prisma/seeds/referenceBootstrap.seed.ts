/**
 * File: src/prisma/seeds/referenceBootstrap.seed.ts
 * Purpose: Create missing production reference rows without updating existing values.
 * Why: Rehearsals and deployments must be repeatable while preserving managed configuration.
 */
import { Prisma, UserRole } from '../generated.js'
import {
  dashboardDefaults,
  navigationDefaults,
  notificationDefaults,
  permissionDefaults,
  uploadTypeDefaults,
} from './referenceBootstrap.data.js'

type ReferenceClient = Prisma.TransactionClient

function notificationVisuals(type: string): { icon: string; accent: string } {
  const icon =
    type === 'graded'
      ? 'check-circle'
      : type === 'due_soon'
        ? 'clock'
        : ['new_submission', 'assignment_published'].includes(type)
          ? 'file-text'
          : type === 'schedule_update'
            ? 'clock'
            : type === 'weekly_digest'
              ? 'inbox'
              : 'bell'
  const accent =
    type === 'graded'
      ? 'success'
      : type === 'due_soon'
        ? 'warning'
        : type === 'weekly_digest'
          ? 'neutral'
          : 'info'
  return { icon, accent }
}

export async function seedPermissionsAndNavigation(
  prisma: ReferenceClient,
): Promise<void> {
  await prisma.permission.createMany({
    data: permissionDefaults.map(([key, name]) => ({ key, name })),
    skipDuplicates: true,
  })
  const permissions = await prisma.permission.findMany({
    where: { key: { in: permissionDefaults.map(([key]) => key) } },
    select: { id: true, key: true },
  })
  const idByKey = new Map(permissions.map(({ id, key }) => [key, id]))
  await prisma.rolePermission.createMany({
    data: permissionDefaults.flatMap(([key, , roles]) => {
      const permissionId = idByKey.get(key)
      if (!permissionId) throw new Error(`Missing permission after bootstrap: ${key}`)
      return roles.map((role) => ({ role, permissionId }))
    }),
    skipDuplicates: true,
  })

  const speakingFlag = await prisma.featureFlag.findUnique({
    where: { key: 'ielts-speaking-module' },
    select: { id: true },
  })
  const featureFlagId =
    speakingFlag?.id ??
    (
      await prisma.featureFlag.create({
        data: {
          key: 'ielts-speaking-module',
          name: 'IELTS Speaking Module',
          description: 'Enable IELTS speaking assignments and assessments',
          enabled: true,
        },
        select: { id: true },
      })
    ).id
  await prisma.featureFlagRole.createMany({
    data: [UserRole.teacher, UserRole.admin].map((role) => ({
      featureFlagId,
      role,
    })),
    skipDuplicates: true,
  })

  for (const [
    role,
    label,
    path,
    iconName,
    requiredPermission,
    badgeSource,
    orderIndex,
  ] of navigationDefaults) {
    const existing = await prisma.navigationItem.findFirst({
      where: { role, path, parentId: null },
      select: { id: true },
    })
    if (!existing) {
      await prisma.navigationItem.create({
        data: {
          role,
          label,
          path,
          iconName,
          requiredPermission,
          badgeSource,
          orderIndex,
          isActive: true,
        },
      })
    }
  }
}

export async function seedNotificationConfig(prisma: ReferenceClient): Promise<void> {
  await prisma.notificationTypeConfig.createMany({
    data: notificationDefaults.map(
      ([role, type, label, description, category, sortOrder]) => ({
        role,
        type,
        label,
        description,
        category,
        defaultEnabled: true,
        enabled: true,
        sortOrder,
        ...notificationVisuals(type),
      }),
    ),
    skipDuplicates: true,
  })
}

export async function seedDashboardConfig(prisma: ReferenceClient): Promise<void> {
  await prisma.dashboardWidgetDefinition.createMany({
    data: dashboardDefaults.map(
      ([role, widgetKey, label, iconName, color, dataSource, valueFormat, order]) => ({
        role,
        widgetKey,
        type: 'stat',
        label,
        iconName,
        color,
        dataSource,
        valueFormat,
        defaultOrder: order,
        defaultX: order,
        defaultY: 0,
        defaultW: 1,
        defaultH: 1,
        defaultVisible: true,
        isActive: true,
      }),
    ),
    skipDuplicates: true,
  })
}

export async function seedFileUploadConfig(prisma: ReferenceClient): Promise<void> {
  await prisma.fileUploadPolicy.createMany({
    data: [UserRole.student, UserRole.teacher, UserRole.admin].map((role) => ({
      role,
      maxFileSize: 26_214_400,
      maxTotalSize: 104_857_600,
      maxFilesPerUpload: 5,
    })),
    skipDuplicates: true,
  })
  const policies = await prisma.fileUploadPolicy.findMany({
    where: { role: { in: [UserRole.student, UserRole.teacher, UserRole.admin] } },
    select: { id: true },
  })
  for (const policy of policies) {
    await prisma.fileUploadAllowedType.createMany({
      data: uploadTypeDefaults.map(
        ([mimeType, extensions, label, acceptToken, sortOrder]) => ({
          policyId: policy.id,
          mimeType,
          extensions: [...extensions],
          label,
          acceptToken,
          sortOrder,
        }),
      ),
      skipDuplicates: true,
    })
  }
}

export async function seedCoreReferenceData(prisma: ReferenceClient): Promise<void> {
  await seedPermissionsAndNavigation(prisma)
  await seedNotificationConfig(prisma)
  await seedDashboardConfig(prisma)
  await seedFileUploadConfig(prisma)
}
