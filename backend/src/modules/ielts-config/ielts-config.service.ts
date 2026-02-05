/**
 * File: src/modules/ielts-config/ielts-config.service.ts
 * Purpose: Database queries for IELTS domain configuration
 * Why: Encapsulates data access for IELTS config endpoints
 */

import { prisma } from "../../prisma/client.js";

export interface IeltsAssignmentType {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  enabled: boolean;
  sort_order: number;
}

export interface IeltsQuestionType {
  id: string;
  skill_type: "reading" | "listening";
  label: string;
  description?: string;
  enabled: boolean;
  sort_order: number;
}

export interface IeltsWritingTaskType {
  id: string;
  task_number: number;
  label: string;
  description?: string;
  enabled: boolean;
  sort_order: number;
}

export interface IeltsSpeakingPartType {
  id: string;
  label: string;
  description?: string;
  enabled: boolean;
  sort_order: number;
}

export interface IeltsCompletionFormat {
  id: string;
  label: string;
  description?: string;
  enabled: boolean;
  sort_order: number;
}

export interface IeltsSampleTimingOption {
  id: string;
  label: string;
  description?: string;
  enabled: boolean;
  sort_order: number;
}

export interface IeltsConfigVersion {
  version: number;
  name: string;
  description?: string;
  is_active: boolean;
  activated_at?: string;
  created_at: string;
}

export interface IeltsConfig {
  version: number;
  assignment_types: IeltsAssignmentType[];
  question_types: {
    reading: IeltsQuestionType[];
    listening: IeltsQuestionType[];
  };
  writing_task_types: {
    task1: IeltsWritingTaskType[];
    task2: IeltsWritingTaskType[];
  };
  speaking_part_types: IeltsSpeakingPartType[];
  completion_formats: IeltsCompletionFormat[];
  sample_timing_options: IeltsSampleTimingOption[];
}

/**
 * Get the active IELTS configuration
 */
export async function getActiveIeltsConfig(): Promise<IeltsConfig | null> {
  const activeVersion = await prisma.ieltsConfigVersion.findFirst({
    where: { isActive: true },
  });

  if (!activeVersion) {
    return null;
  }

  return getIeltsConfigByVersion(activeVersion.version);
}

/**
 * Get IELTS configuration by specific version
 */
export async function getIeltsConfigByVersion(
  version: number,
): Promise<IeltsConfig | null> {
  const configVersion = await prisma.ieltsConfigVersion.findUnique({
    where: { version },
  });

  if (!configVersion) {
    return null;
  }

  // Fetch all config data in parallel
  const [
    assignmentTypes,
    questionTypes,
    writingTaskTypes,
    speakingPartTypes,
    completionFormats,
    sampleTimingOptions,
  ] = await Promise.all([
    prisma.ieltsAssignmentType.findMany({
      where: { configVersion: version },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.ieltsQuestionType.findMany({
      where: { configVersion: version },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.ieltsWritingTaskType.findMany({
      where: { configVersion: version },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.ieltsSpeakingPartType.findMany({
      where: { configVersion: version },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.ieltsCompletionFormat.findMany({
      where: { configVersion: version },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.ieltsSampleTimingOption.findMany({
      where: { configVersion: version },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  // Group question types by skill
  const readingQuestionTypes = questionTypes
    .filter((qt: { skillType: string }) => qt.skillType === "reading")
    .map((qt: { id: string; skillType: string; label: string; description: string | null; enabled: boolean; sortOrder: number }) => ({
      id: qt.id,
      skill_type: qt.skillType as "reading" | "listening",
      label: qt.label,
      description: qt.description ?? undefined,
      enabled: qt.enabled,
      sort_order: qt.sortOrder,
    }));

  const listeningQuestionTypes = questionTypes
    .filter((qt: { skillType: string }) => qt.skillType === "listening")
    .map((qt: { id: string; skillType: string; label: string; description: string | null; enabled: boolean; sortOrder: number }) => ({
      id: qt.id,
      skill_type: qt.skillType as "reading" | "listening",
      label: qt.label,
      description: qt.description ?? undefined,
      enabled: qt.enabled,
      sort_order: qt.sortOrder,
    }));

  // Group writing task types by task number
  const task1Types = writingTaskTypes
    .filter((wt: { taskNumber: number }) => wt.taskNumber === 1)
    .map((wt: { id: string; taskNumber: number; label: string; description: string | null; enabled: boolean; sortOrder: number }) => ({
      id: wt.id,
      task_number: wt.taskNumber,
      label: wt.label,
      description: wt.description ?? undefined,
      enabled: wt.enabled,
      sort_order: wt.sortOrder,
    }));

  const task2Types = writingTaskTypes
    .filter((wt: { taskNumber: number }) => wt.taskNumber === 2)
    .map((wt: { id: string; taskNumber: number; label: string; description: string | null; enabled: boolean; sortOrder: number }) => ({
      id: wt.id,
      task_number: wt.taskNumber,
      label: wt.label,
      description: wt.description ?? undefined,
      enabled: wt.enabled,
      sort_order: wt.sortOrder,
    }));

  return {
    version: configVersion.version,
    assignment_types: assignmentTypes.map((at: { id: string; label: string; description: string | null; icon: string | null; enabled: boolean; sortOrder: number }) => ({
      id: at.id,
      label: at.label,
      description: at.description ?? undefined,
      icon: at.icon ?? undefined,
      enabled: at.enabled,
      sort_order: at.sortOrder,
    })),
    question_types: {
      reading: readingQuestionTypes,
      listening: listeningQuestionTypes,
    },
    writing_task_types: {
      task1: task1Types,
      task2: task2Types,
    },
    speaking_part_types: speakingPartTypes.map((spt: { id: string; label: string; description: string | null; enabled: boolean; sortOrder: number }) => ({
      id: spt.id,
      label: spt.label,
      description: spt.description ?? undefined,
      enabled: spt.enabled,
      sort_order: spt.sortOrder,
    })),
    completion_formats: completionFormats.map((cf: { id: string; label: string; description: string | null; enabled: boolean; sortOrder: number }) => ({
      id: cf.id,
      label: cf.label,
      description: cf.description ?? undefined,
      enabled: cf.enabled,
      sort_order: cf.sortOrder,
    })),
    sample_timing_options: sampleTimingOptions.map((sto: { id: string; label: string; description: string | null; enabled: boolean; sortOrder: number }) => ({
      id: sto.id,
      label: sto.label,
      description: sto.description ?? undefined,
      enabled: sto.enabled,
      sort_order: sto.sortOrder,
    })),
  };
}

/**
 * Get all IELTS config versions
 */
export async function getIeltsConfigVersions(): Promise<{
  versions: IeltsConfigVersion[];
  activeVersion: number | null;
}> {
  const versions = await prisma.ieltsConfigVersion.findMany({
    orderBy: { version: "desc" },
  });

  const activeVersion = versions.find((v: { isActive: boolean }) => v.isActive);

  return {
    versions: versions.map((v: { version: number; name: string; description: string | null; isActive: boolean; activatedAt: Date | null; createdAt: Date }) => ({
      version: v.version,
      name: v.name,
      description: v.description ?? undefined,
      is_active: v.isActive,
      activated_at: v.activatedAt?.toISOString(),
      created_at: v.createdAt.toISOString(),
    })),
    activeVersion: activeVersion?.version ?? null,
  };
}
