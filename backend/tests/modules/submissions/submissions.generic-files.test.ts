/**
 * File: tests/modules/submissions/submissions.generic-files.test.ts
 * Purpose: Verify authoritative file payload persistence for generic submissions.
 * Why: Clients may send file IDs only; stored metadata and versions remain server-owned.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Submission } from "../../../src/prisma/index.js";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    $transaction: vi.fn(),
    assignment: { findFirst: vi.fn() },
    enrollment: { findFirst: vi.fn(), findMany: vi.fn() },
    submission: { findUnique: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("../../../src/modules/scoring/ieltsScoring.service.js", () => ({
  autoScoreSubmission: vi.fn(),
}));
vi.mock("../../../src/modules/ai-feedback/ai-feedback.service.js", () => ({
  enqueueAiWritingFeedbackForSubmission: vi.fn(),
}));
vi.mock(
  "../../../src/modules/notification-preferences/notification-preferences.service.js",
  () => ({ resolveNotificationTypeEnabledForUsers: vi.fn() }),
);
vi.mock("../../../src/modules/notifications/notifications.service.js", () => ({
  enqueueNotification: vi.fn(),
}));
vi.mock("../../../src/modules/audit-logs/audit-logs.service.js", () => ({
  writeAuditLogSafely: vi.fn(),
}));
vi.mock("../../../src/modules/files/files.service.js", () => ({
  getOwnedCompletedSubmissionFiles: vi.fn(),
}));

const prismaModule = await import("../../../src/prisma/client.js");
const preferencesModule = await import(
  "../../../src/modules/notification-preferences/notification-preferences.service.js"
);
const filesModule = await import("../../../src/modules/files/files.service.js");
const { createSubmission } = await import(
  "../../../src/modules/submissions/submissions.service.js"
);

const prisma = vi.mocked(prismaModule.prisma, true);
const resolveNotificationTypeEnabledForUsers = vi.mocked(
  preferencesModule.resolveNotificationTypeEnabledForUsers,
  true,
);
const getOwnedCompletedSubmissionFiles = vi.mocked(
  filesModule.getOwnedCompletedSubmissionFiles,
  true,
);
const assignmentId = "4c67e29f-7a7b-4c3e-8d56-52e5487e59a1";
const studentId = "b9a2031b-9eac-4c77-9f11-4e7fbf3b5c2b";

describe("submissions.service generic files", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
    prisma.enrollment.findFirst.mockResolvedValue({
      id: "a0c0fb2e-f9ef-4b4c-8c7e-69235fd247c8",
    });
    prisma.enrollment.findMany.mockResolvedValue([]);
    resolveNotificationTypeEnabledForUsers.mockResolvedValue(new Map());
  });

  it("persists canonical completed metadata with a server-owned first version", async () => {
    const fileId = "11111111-1111-4111-8111-111111111111";
    const canonicalFile = {
      id: fileId,
      name: "essay.pdf",
      size: 512,
      mime: "application/pdf",
      checksum: "server-checksum",
      bucket: "nce-mock-uploads",
      objectKey: "uploads/student/upload/essay.pdf",
    };
    prisma.assignment.findFirst.mockResolvedValueOnce({
      id: assignmentId,
      courseId: "8a7c1b41-2a1c-4f6d-9f6d-3f2a0e8e2c15",
      title: "Upload your essay",
      type: "file",
      assignmentConfig: { version: 1, maxScore: 100 },
      dueAt: null,
      latePolicy: null,
      publishedAt: new Date("2026-01-01T00:00:00.000Z"),
      course: { title: "General English" },
    });
    prisma.submission.findUnique.mockResolvedValueOnce(null);
    prisma.submission.create.mockResolvedValueOnce({
      id: "file-submission",
    } as Submission);
    getOwnedCompletedSubmissionFiles.mockResolvedValueOnce([canonicalFile]);

    await createSubmission(
      { assignmentId },
      {
        status: "submitted",
        payload: { version: 99, files: [{ id: fileId }] },
      },
      { id: studentId, role: "student" },
    );

    expect(getOwnedCompletedSubmissionFiles).toHaveBeenCalledWith(
      [fileId],
      studentId,
      "student",
    );
    expect(prisma.submission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: { files: [canonicalFile], version: 1 },
        }),
      }),
    );
  });
});
