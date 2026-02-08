/**
 * File: src/modules/ielts-config/ielts-question-options.service.ts
 * Purpose: Fetch backend-driven option values for IELTS boolean-style question types.
 * Why: Keeps true/false and yes/no option sets versioned in DB instead of hardcoded in frontend.
 */

import { prisma } from "../../prisma/client.js";

export type IeltsQuestionOptionType = "true_false" | "yes_no";

export interface IeltsQuestionOption {
  value: string;
  label: string;
  score: number;
  enabled: boolean;
  sort_order: number;
}

export interface IeltsQuestionOptionsResponse {
  type: IeltsQuestionOptionType;
  version: number;
  options: IeltsQuestionOption[];
}

async function resolveTargetVersion(version?: number): Promise<number | null> {
  if (typeof version === "number") {
    const configVersion = await prisma.ieltsConfigVersion.findUnique({
      where: { version },
      select: { version: true },
    });
    return configVersion?.version ?? null;
  }

  const activeVersion = await prisma.ieltsConfigVersion.findFirst({
    where: { isActive: true },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  return activeVersion?.version ?? null;
}

/**
 * Fetch enabled option values for a question option type and config version.
 */
export async function getQuestionOptionsForType(
  type: IeltsQuestionOptionType,
  version?: number,
): Promise<IeltsQuestionOptionsResponse | null> {
  const targetVersion = await resolveTargetVersion(version);

  if (!targetVersion) {
    return null;
  }

  const options = await prisma.ieltsQuestionOption.findMany({
    where: {
      configVersion: targetVersion,
      optionType: type,
      enabled: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  if (options.length === 0) {
    return null;
  }

  return {
    type,
    version: targetVersion,
    options: options.map((option) => ({
      value: option.value,
      label: option.label,
      score: option.score,
      enabled: option.enabled,
      sort_order: option.sortOrder,
    })),
  };
}
