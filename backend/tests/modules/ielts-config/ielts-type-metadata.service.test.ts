/**
 * File: tests/modules/ielts-config/ielts-type-metadata.service.test.ts
 * Purpose: Verify version resolution and fallback behavior for IELTS type metadata.
 * Why: Prevents regressions when frontend type-card UI depends on backend metadata.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    ieltsConfigVersion: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    ieltsAssignmentType: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../../../src/config/logger.js", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

const prismaModule = await import("../../../src/prisma/client.js");
const loggerModule = await import("../../../src/config/logger.js");

const prisma = vi.mocked(prismaModule.prisma, true);
const logger = vi.mocked(loggerModule.logger, true);

const { getIeltsTypeMetadata } = await import(
  "../../../src/modules/ielts-config/ielts-type-metadata.service.js"
);

describe("ielts-type-metadata.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns mapped metadata for the active config version", async () => {
    prisma.ieltsConfigVersion.findFirst.mockResolvedValue({ version: 2 });
    prisma.ieltsAssignmentType.findMany.mockResolvedValue([
      {
        id: "reading",
        configVersion: 2,
        label: "Reading",
        description: "Create a reading test",
        icon: "book-open",
        themeColorFrom: "#EFF6FF",
        themeColorTo: "#DBEAFE",
        themeBorderColor: "#BFDBFE",
        enabled: true,
        sortOrder: 1,
        createdAt: new Date("2026-02-10T00:00:00.000Z"),
      },
      {
        id: "listening",
        configVersion: 2,
        label: "Listening",
        description: null,
        icon: "headphones",
        themeColorFrom: null,
        themeColorTo: null,
        themeBorderColor: null,
        enabled: true,
        sortOrder: 2,
        createdAt: new Date("2026-02-10T00:00:00.000Z"),
      },
    ]);

    const payload = await getIeltsTypeMetadata();

    expect(payload.version).toBe(2);
    expect(payload.types).toEqual([
      {
        id: "reading",
        title: "Reading",
        description: "Create a reading test",
        icon: "book-open",
        theme: {
          color_from: "#EFF6FF",
          color_to: "#DBEAFE",
          border_color: "#BFDBFE",
        },
        enabled: true,
        sort_order: 1,
      },
      {
        id: "listening",
        title: "Listening",
        description: "Build a listening test with audio sections",
        icon: "headphones",
        theme: {
          color_from: "#FAF5FF",
          color_to: "#F3E8FF",
          border_color: "#E9D5FF",
        },
        enabled: true,
        sort_order: 2,
      },
    ]);

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("uses fallback when requested version does not exist", async () => {
    prisma.ieltsConfigVersion.findUnique.mockResolvedValue(null);

    const payload = await getIeltsTypeMetadata(99);

    expect(payload.version).toBe(99);
    expect(payload.types.length).toBeGreaterThan(0);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "ielts_type_metadata_fallback_used",
        reason: "requested_version_not_found",
        requested_version: 99,
      }),
      "Using fallback IELTS type metadata configuration",
    );
  });

  it("uses fallback when active version is missing", async () => {
    prisma.ieltsConfigVersion.findFirst.mockResolvedValue(null);

    const payload = await getIeltsTypeMetadata();

    expect(payload.version).toBe(1);
    expect(payload.types.length).toBeGreaterThan(0);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "ielts_type_metadata_fallback_used",
        reason: "active_version_missing",
      }),
      "Using fallback IELTS type metadata configuration",
    );
  });

  it("uses fallback when rows are invalid", async () => {
    prisma.ieltsConfigVersion.findFirst.mockResolvedValue({ version: 1 });
    prisma.ieltsAssignmentType.findMany.mockResolvedValue([
      {
        id: "",
        configVersion: 1,
        label: "Reading",
        description: "Create a reading test",
        icon: "book-open",
        themeColorFrom: "#EFF6FF",
        themeColorTo: "#DBEAFE",
        themeBorderColor: "#BFDBFE",
        enabled: true,
        sortOrder: 1,
        createdAt: new Date("2026-02-10T00:00:00.000Z"),
      },
    ]);

    const payload = await getIeltsTypeMetadata();

    expect(payload.types.length).toBeGreaterThan(0);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "ielts_type_metadata_fallback_used",
        reason: "invalid_rows",
        version: 1,
      }),
      "Using fallback IELTS type metadata configuration",
    );
  });

  it("uses fallback when query throws", async () => {
    prisma.ieltsConfigVersion.findFirst.mockRejectedValue(new Error("db unavailable"));

    const payload = await getIeltsTypeMetadata();

    expect(payload.types.length).toBeGreaterThan(0);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "ielts_type_metadata_fallback_used",
        reason: "query_failed",
      }),
      "Using fallback IELTS type metadata configuration",
    );
  });
});
