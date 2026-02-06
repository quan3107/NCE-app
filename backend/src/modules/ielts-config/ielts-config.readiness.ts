/**
 * File: src/modules/ielts-config/ielts-config.readiness.ts
 * Purpose: Provide a shared readiness check for IELTS config reference data.
 * Why: Health checks, startup guards, and deploy verification all need one consistent rule.
 */

import { prisma } from "../../prisma/client.js";

export type IeltsConfigReadinessCounts = {
  versions: number;
  assignmentTypes: number;
  questionTypes: number;
  writingTaskTypes: number;
  speakingPartTypes: number;
  completionFormats: number;
  sampleTimingOptions: number;
};

export type IeltsConfigReadinessReport = {
  ready: boolean;
  reason: string | null;
  checkedAt: string;
  activeVersion: number | null;
  counts: IeltsConfigReadinessCounts;
};

function emptyCounts(): IeltsConfigReadinessCounts {
  return {
    versions: 0,
    assignmentTypes: 0,
    questionTypes: 0,
    writingTaskTypes: 0,
    speakingPartTypes: 0,
    completionFormats: 0,
    sampleTimingOptions: 0,
  };
}

/**
 * Read the minimum set of rows required for IELTS authoring endpoints to work.
 */
export async function getIeltsConfigReadinessReport(): Promise<IeltsConfigReadinessReport> {
  const versions = await prisma.ieltsConfigVersion.findMany({
    where: { isActive: true },
    select: { version: true },
    orderBy: { version: "desc" },
    take: 1,
  });
  const activeVersion = versions[0]?.version ?? null;

  if (!activeVersion) {
    return {
      ready: false,
      reason: "No active IELTS config version found.",
      checkedAt: new Date().toISOString(),
      activeVersion: null,
      counts: emptyCounts(),
    };
  }

  const [
    versionsCount,
    assignmentTypes,
    questionTypes,
    writingTaskTypes,
    speakingPartTypes,
    completionFormats,
    sampleTimingOptions,
  ] = await Promise.all([
    prisma.ieltsConfigVersion.count(),
    prisma.ieltsAssignmentType.count({ where: { configVersion: activeVersion } }),
    prisma.ieltsQuestionType.count({ where: { configVersion: activeVersion } }),
    prisma.ieltsWritingTaskType.count({ where: { configVersion: activeVersion } }),
    prisma.ieltsSpeakingPartType.count({ where: { configVersion: activeVersion } }),
    prisma.ieltsCompletionFormat.count({ where: { configVersion: activeVersion } }),
    prisma.ieltsSampleTimingOption.count({ where: { configVersion: activeVersion } }),
  ]);

  const counts: IeltsConfigReadinessCounts = {
    versions: versionsCount,
    assignmentTypes,
    questionTypes,
    writingTaskTypes,
    speakingPartTypes,
    completionFormats,
    sampleTimingOptions,
  };

  const missing = Object.entries(counts)
    .filter(([, value]) => value <= 0)
    .map(([key]) => key);

  return {
    ready: missing.length === 0,
    reason: missing.length > 0 ? `Missing IELTS config data: ${missing.join(", ")}.` : null,
    checkedAt: new Date().toISOString(),
    activeVersion,
    counts,
  };
}

