/**
 * File: tests/modules/auth/auth.tokens.test.ts
 * Purpose: Verify JWT purpose separation for API and NCE media tokens.
 * Why: Prevents signed media URLs from becoming reusable bearer credentials.
 */
import { describe, expect, it, vi } from "vitest";

import {
  signAccessToken,
  signNceAssetToken,
  verifyAccessToken,
  verifyNceAssetToken,
} from "../../../src/modules/auth/auth.tokens.js";
import { UserRole, UserStatus } from "../../../src/prisma/index.js";

const studentId = "55555555-5555-4555-8555-555555555555";
const familyId = "66666666-6666-4666-8666-666666666666";
const courseId = "11111111-1111-4111-8111-111111111111";
const key = "nce/book1/lesson1/dialogue.mp3";

describe("auth.tokens", () => {
  it("signs NCE asset tokens that normal API auth rejects", () => {
    const token = signNceAssetToken({
      userId: studentId,
      role: UserRole.student,
      status: UserStatus.active,
      courseId,
      key,
    });

    expect(() => verifyAccessToken(token)).toThrow();
    expect(verifyNceAssetToken(token)).toMatchObject({
      sub: studentId,
      role: UserRole.student,
      status: UserStatus.active,
      courseId,
      key,
      purpose: "nce_asset_audio",
    });
  });

  it("keeps NCE asset tokens valid for normal lesson playback", () => {
    const token = signNceAssetToken({
      userId: studentId,
      role: UserRole.student,
      status: UserStatus.active,
      courseId,
      key,
    });

    const claims = verifyNceAssetToken(token);

    expect(claims.exp - claims.iat).toBeGreaterThanOrEqual(15 * 60);
  });

  it("issues a unique refreshed NCE asset token and rejects it after expiry", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-28T10:00:00.000Z"));
    try {
      const payload = {
        userId: studentId,
        role: UserRole.student,
        status: UserStatus.active,
        courseId,
        key,
      };
      const firstToken = signNceAssetToken(payload);
      const refreshedToken = signNceAssetToken(payload);

      expect(refreshedToken).not.toBe(firstToken);
      vi.setSystemTime(new Date("2026-08-28T10:16:00.000Z"));
      expect(() => verifyNceAssetToken(firstToken)).toThrow();
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects normal API access tokens as NCE asset tokens", () => {
    const token = signAccessToken({
      userId: studentId,
      role: UserRole.student,
      status: UserStatus.active,
      familyId,
    });

    expect(() => verifyNceAssetToken(token)).toThrow();
  });

  it("binds API access tokens to their revocable session family", () => {
    const token = signAccessToken({
      userId: studentId,
      role: UserRole.student,
      status: UserStatus.active,
      familyId,
    });

    expect(verifyAccessToken(token)).toMatchObject({
      sub: studentId,
      sid: familyId,
    });
  });
});
