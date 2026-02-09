/**
 * File: tests/modules/ielts-config/ielts-question-options.service.test.ts
 * Purpose: Verify version resolution and response shaping for IELTS question options.
 * Why: Prevents regressions when frontend relies on backend-driven option values.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    ieltsConfigVersion: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    ieltsQuestionOption: {
      findMany: vi.fn(),
    },
  },
}));

const prismaModule = await import("../../../src/prisma/client.js");
const prisma = vi.mocked(prismaModule.prisma, true);

const { getQuestionOptionsForType } = await import(
  "../../../src/modules/ielts-config/ielts-question-options.service.js"
);

describe("ielts-question-options.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns enabled options for the active config version", async () => {
    prisma.ieltsConfigVersion.findFirst.mockResolvedValue({ version: 3 });
    prisma.ieltsQuestionOption.findMany.mockResolvedValue([
      {
        value: "true",
        label: "True",
        score: 1,
        enabled: true,
        sortOrder: 1,
      },
      {
        value: "not_given",
        label: "Not Given",
        score: 0,
        enabled: true,
        sortOrder: 2,
      },
    ]);

    const result = await getQuestionOptionsForType("true_false");

    expect(result).toEqual({
      type: "true_false",
      version: 3,
      options: [
        {
          value: "true",
          label: "True",
          score: 1,
          enabled: true,
          sort_order: 1,
        },
        {
          value: "not_given",
          label: "Not Given",
          score: 0,
          enabled: true,
          sort_order: 2,
        },
      ],
    });

    expect(prisma.ieltsQuestionOption.findMany).toHaveBeenCalledWith({
      where: {
        configVersion: 3,
        optionType: "true_false",
        enabled: true,
      },
      orderBy: { sortOrder: "asc" },
    });
  });

  it("prefers an explicit version when provided", async () => {
    prisma.ieltsConfigVersion.findUnique.mockResolvedValue({ version: 7 });
    prisma.ieltsQuestionOption.findMany.mockResolvedValue([
      {
        value: "yes",
        label: "Yes",
        score: 1,
        enabled: true,
        sortOrder: 1,
      },
    ]);

    const result = await getQuestionOptionsForType("yes_no", 7);

    expect(result?.version).toBe(7);
    expect(prisma.ieltsConfigVersion.findUnique).toHaveBeenCalledWith({
      where: { version: 7 },
      select: { version: true },
    });
    expect(prisma.ieltsConfigVersion.findFirst).not.toHaveBeenCalled();
  });

  it("returns null when active version is missing", async () => {
    prisma.ieltsConfigVersion.findFirst.mockResolvedValue(null);

    const result = await getQuestionOptionsForType("true_false");

    expect(result).toBeNull();
    expect(prisma.ieltsQuestionOption.findMany).not.toHaveBeenCalled();
  });

  it("returns null when the requested version has no options", async () => {
    prisma.ieltsConfigVersion.findUnique.mockResolvedValue({ version: 1 });
    prisma.ieltsQuestionOption.findMany.mockResolvedValue([]);

    const result = await getQuestionOptionsForType("yes_no", 1);

    expect(result).toBeNull();
  });
});
