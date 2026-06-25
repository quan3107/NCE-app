/**
 * File: tests/modules/nce-attempts/nce-attempts.controller.test.ts
 * Purpose: Verify HTTP-layer NCE attempt behavior.
 * Why: Protects media-token checks that happen before service-level asset lookup.
 */
import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

import {
  signAccessToken,
  signNceAssetToken,
} from "../../../src/modules/auth/auth.tokens.js";
import { UserRole, UserStatus } from "../../../src/prisma/index.js";

vi.mock("../../../src/modules/nce-attempts/nce-attempts.service.js", () => ({
  completeNceLesson: vi.fn(),
  createOrUpdateNceAttempt: vi.fn(),
  getNceAssetContentFile: vi.fn(),
  getNceAssetContentLocation: vi.fn(),
  listStudentNcePath: vi.fn(),
  listTeacherNceAttemptSummaries: vi.fn(),
  submitNceAttempt: vi.fn(),
}));

const serviceModule = await import(
  "../../../src/modules/nce-attempts/nce-attempts.service.js"
);
const { getNceAssetAudio } = await import(
  "../../../src/modules/nce-attempts/nce-attempts.controller.js"
);
const getNceAssetContentFile = vi.mocked(serviceModule.getNceAssetContentFile);

const studentId = "55555555-5555-4555-8555-555555555555";
const courseId = "11111111-1111-4111-8111-111111111111";
const otherCourseId = "22222222-2222-4222-8222-222222222222";
const key = "nce/book1/lesson1/dialogue.mp3";

function audioRequest(token: string, requestedKey = key): Request {
  return {
    params: { courseId },
    query: { key: requestedKey, token },
  } as unknown as Request;
}

function response(): Response {
  return {
    type: vi.fn(),
    sendFile: vi.fn(),
  } as unknown as Response;
}

function nceAssetToken(overrides: { courseId?: string; key?: string } = {}) {
  return signNceAssetToken({
    userId: studentId,
    role: UserRole.student,
    status: UserStatus.active,
    courseId: overrides.courseId ?? courseId,
    key: overrides.key ?? key,
  });
}

describe("nce-attempts.controller", () => {
  it("rejects normal API access tokens on the NCE audio route", async () => {
    const token = signAccessToken({
      userId: studentId,
      role: UserRole.student,
      status: UserStatus.active,
    });

    await expect(
      getNceAssetAudio(audioRequest(token), response()),
    ).rejects.toMatchObject({
      statusCode: 401,
      message: "Unauthorized",
    });
    expect(getNceAssetContentFile).not.toHaveBeenCalled();
  });

  it("rejects NCE audio tokens bound to a different asset request", async () => {
    await expect(
      getNceAssetAudio(
        audioRequest(nceAssetToken({ courseId: otherCourseId })),
        response(),
      ),
    ).rejects.toMatchObject({
      statusCode: 401,
      message: "Unauthorized",
    });

    await expect(
      getNceAssetAudio(
        audioRequest(nceAssetToken({ key: "nce/book1/lesson2/dialogue.mp3" })),
        response(),
      ),
    ).rejects.toMatchObject({
      statusCode: 401,
      message: "Unauthorized",
    });
    expect(getNceAssetContentFile).not.toHaveBeenCalled();
  });

  it("streams NCE audio for a matching media token", async () => {
    const res = response();
    getNceAssetContentFile.mockResolvedValueOnce({
      path: "D:/Academic/Projects/NCE-app/backend/tests/fixtures/nce-assets/nce/book1/lesson1/dialogue.mp3",
      mime: "audio/mpeg",
      size: 3,
    });

    await getNceAssetAudio(audioRequest(nceAssetToken()), res);

    expect(getNceAssetContentFile).toHaveBeenCalledWith(
      { courseId },
      { key, token: expect.any(String) },
      {
        id: studentId,
        role: UserRole.student,
        status: UserStatus.active,
      },
    );
    expect(res.type).toHaveBeenCalledWith("audio/mpeg");
    expect(res.sendFile).toHaveBeenCalled();
  });
});
