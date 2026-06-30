/**
 * File: tests/modules/cms/cms.service.test.ts
 * Purpose: Verify CMS maintenance mutations emit safe audit entries.
 * Why: Automated content updates still need operational traceability.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    user: {
      count: vi.fn(),
    },
    submission: {
      count: vi.fn(),
    },
    grade: {
      aggregate: vi.fn(),
    },
    cmsPageContent: {
      findUnique: vi.fn(),
    },
    cmsContentItem: {
      update: vi.fn(),
    },
  },
}));

vi.mock("../../../src/modules/audit-logs/audit-logs.service.js", () => ({
  writeAuditLogSafely: vi.fn(),
}));

const prismaModule = await import("../../../src/prisma/client.js");
const prisma = vi.mocked(prismaModule.prisma, true);
const auditLogsModule = await import(
  "../../../src/modules/audit-logs/audit-logs.service.js"
);
const writeAuditLogSafely = vi.mocked(auditLogsModule.writeAuditLogSafely);

const { updateHomepageStatsWithRealtimeData } = await import(
  "../../../src/modules/cms/cms.service.js"
);

describe("cms.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("audits homepage stat refreshes without storing full CMS content", async () => {
    prisma.user.count.mockResolvedValueOnce(42);
    prisma.submission.count.mockResolvedValueOnce(10);
    prisma.submission.count.mockResolvedValueOnce(8);
    prisma.grade.aggregate.mockResolvedValueOnce({
      _avg: { band: 7.25 },
    });
    prisma.cmsPageContent.findUnique.mockResolvedValueOnce({
      id: "homepage-1",
      sections: [
        {
          id: "stats-section",
          items: [
            {
              id: "item-students",
              itemKey: "stat_students",
              contentJson: {
                value: 10,
                label: "Active students",
                format: "number",
              },
            },
          ],
        },
      ],
    });

    await updateHomepageStatsWithRealtimeData();

    expect(prisma.cmsContentItem.update).toHaveBeenCalledWith({
      where: { id: "item-students" },
      data: {
        contentJson: {
          value: 42,
          label: "Active students",
          format: "number",
        },
      },
    });
    expect(writeAuditLogSafely).toHaveBeenCalledWith({
      actorId: null,
      action: "cms.homepage_stats_refreshed",
      entity: "cms_page_content",
      entityId: "homepage-1",
      diff: {
        pageKey: "homepage",
        sectionKey: "stats",
        updatedItems: [
          {
            itemId: "item-students",
            itemKey: "stat_students",
            value: {
              from: 10,
              to: 42,
            },
          },
        ],
      },
    });
    expect(JSON.stringify(writeAuditLogSafely.mock.calls)).not.toContain(
      "Active students",
    );
  });
});
