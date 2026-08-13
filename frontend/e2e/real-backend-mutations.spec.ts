/**
 * Location: frontend/e2e/real-backend-mutations.spec.ts
 * Purpose: Exercise mutable profile and upload-policy contracts against the real API.
 * Why: CI must prove persisted writes can be read back without leaving seed data changed.
 */
import { expect, test, type APIRequestContext } from '@playwright/test';

type Profile = {
  id: string;
  email: string;
  fullName: string;
  role: 'admin';
  status: string;
  profileRevision: number;
};

type ProfileResponse = { profile: Profile };
type UploadLimits = {
  limits: Array<{
    role: 'student' | 'teacher' | 'admin';
    maxFileSizeMib: number;
  }>;
};

const apiBaseURL = (
  process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://127.0.0.1:4000/api/v1'
).replace(/\/$/, '');
const apiURL = new URL(apiBaseURL);
const usesLocalBackend = ['127.0.0.1', 'localhost', '::1'].includes(
  apiURL.hostname,
);

function configuredAdminEmail(): string {
  const configured = process.env.PLAYWRIGHT_ADMIN_EMAIL;
  if (configured) return configured;
  if (usesLocalBackend) return 'rosa.admin@ielts.local';
  throw new Error(
    'PLAYWRIGHT_ADMIN_EMAIL is required when Playwright targets a non-local backend.',
  );
}

function configuredAdminPassword(): string {
  const configured =
    process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? process.env.PLAYWRIGHT_TEST_PASSWORD;
  if (configured) return configured;
  throw new Error(
    'PLAYWRIGHT_ADMIN_PASSWORD or PLAYWRIGHT_TEST_PASSWORD is required.',
  );
}

async function restoreUploadLimits(
  request: APIRequestContext,
  authorization: string,
  original: UploadLimits,
): Promise<void> {
  const currentResponse = await request.get(
    `${apiBaseURL}/settings/file-upload-limits`,
    { headers: { authorization } },
  );
  expect(currentResponse.ok(), 'Failed to read upload limits for cleanup').toBeTruthy();
  const current = (await currentResponse.json()) as UploadLimits;
  const originalStudent = original.limits.find((limit) => limit.role === 'student');
  const currentStudent = current.limits.find((limit) => limit.role === 'student');
  if (!originalStudent || !currentStudent) {
    throw new Error('Student upload limit is required for cleanup.');
  }
  if (originalStudent.maxFileSizeMib === currentStudent.maxFileSizeMib) return;
  const restoreResponse = await request.patch(
    `${apiBaseURL}/settings/file-upload-limits`,
    {
      headers: { authorization },
      data: {
        updates: {
          student: {
            expectedMaxFileSizeMib: currentStudent.maxFileSizeMib,
            maxFileSizeMib: originalStudent.maxFileSizeMib,
          },
        },
      },
    },
  );
  expect(restoreResponse.ok(), 'Failed to restore upload limits').toBeTruthy();
}

async function restoreProfile(
  request: APIRequestContext,
  authorization: string,
  original: Profile,
  knownRevision: number | undefined,
): Promise<void> {
  const currentResponse = await request.get(`${apiBaseURL}/me`, {
    headers: { authorization },
  });
  let currentRevision = knownRevision;
  if (currentResponse.ok()) {
    const current = ((await currentResponse.json()) as ProfileResponse).profile;
    if (current.fullName === original.fullName) return;
    currentRevision = current.profileRevision;
  }
  expect(
    currentRevision,
    'Failed to determine the current profile revision for cleanup',
  ).toBeDefined();
  if (currentRevision === undefined) {
    throw new Error('Current profile revision is unavailable for cleanup.');
  }
  const restoreResponse = await request.patch(`${apiBaseURL}/me`, {
    headers: { authorization },
    data: {
      fullName: original.fullName,
      expectedRevision: currentRevision,
    },
  });
  expect(restoreResponse.ok(), 'Failed to restore profile').toBeTruthy();
}

const cleanupErrorMessage = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

test('profile and upload-policy mutations persist and restore', async ({ request }) => {
  let authorization: string | undefined;
  let originalProfile: Profile | undefined;
  let latestProfileRevision: number | undefined;
  let originalLimits: UploadLimits | undefined;
  let primaryError: unknown;
  const cleanupErrors: unknown[] = [];

  try {
    const loginResponse = await request.post(`${apiBaseURL}/auth/login`, {
      data: {
        email: configuredAdminEmail(),
        password: configuredAdminPassword(),
      },
    });
    expect(loginResponse.ok(), 'Admin login failed').toBeTruthy();
    const auth = (await loginResponse.json()) as { accessToken: string };
    authorization = `Bearer ${auth.accessToken}`;

    const [profileResponse, limitsResponse] = await Promise.all([
      request.get(`${apiBaseURL}/me`, { headers: { authorization } }),
      request.get(`${apiBaseURL}/settings/file-upload-limits`, {
        headers: { authorization },
      }),
    ]);
    expect(profileResponse.ok(), 'Profile snapshot failed').toBeTruthy();
    expect(limitsResponse.ok(), 'Upload-limit snapshot failed').toBeTruthy();
    originalProfile = ((await profileResponse.json()) as ProfileResponse).profile;
    latestProfileRevision = originalProfile.profileRevision;
    originalLimits = (await limitsResponse.json()) as UploadLimits;

    const originalStudent = originalLimits.limits.find(
      (limit) => limit.role === 'student',
    );
    if (!originalStudent) throw new Error('Student upload limit is missing.');
    const mutatedName = `CI Mutable ${Date.now()}`;
    const mutatedLimit =
      originalStudent.maxFileSizeMib === 100
        ? 99
        : originalStudent.maxFileSizeMib + 1;

    const [profileMutation, limitsMutation] = await Promise.all([
      request.patch(`${apiBaseURL}/me`, {
        headers: { authorization },
        data: {
          fullName: mutatedName,
          expectedRevision: originalProfile.profileRevision,
        },
      }),
      request.patch(`${apiBaseURL}/settings/file-upload-limits`, {
        headers: { authorization },
        data: {
          updates: {
            student: {
              expectedMaxFileSizeMib: originalStudent.maxFileSizeMib,
              maxFileSizeMib: mutatedLimit,
            },
          },
        },
      }),
    ]);
    expect(profileMutation.ok(), 'Profile mutation failed').toBeTruthy();
    const mutatedProfile = (await profileMutation.json()) as Profile;
    latestProfileRevision = mutatedProfile.profileRevision;
    expect(limitsMutation.ok(), 'Upload-limit mutation failed').toBeTruthy();

    const [savedProfileResponse, savedLimitsResponse] = await Promise.all([
      request.get(`${apiBaseURL}/me`, { headers: { authorization } }),
      request.get(`${apiBaseURL}/settings/file-upload-limits`, {
        headers: { authorization },
      }),
    ]);
    expect(savedProfileResponse.ok()).toBeTruthy();
    expect(savedLimitsResponse.ok()).toBeTruthy();
    const savedProfile = ((await savedProfileResponse.json()) as ProfileResponse)
      .profile;
    latestProfileRevision = savedProfile.profileRevision;
    const savedLimits = (await savedLimitsResponse.json()) as UploadLimits;
    expect(savedProfile.fullName).toBe(mutatedName);
    expect(
      savedLimits.limits.find((limit) => limit.role === 'student')
        ?.maxFileSizeMib,
    ).toBe(mutatedLimit);
  } catch (error) {
    primaryError = error;
  } finally {
    if (authorization && originalProfile) {
      try {
        await restoreProfile(
          request,
          authorization,
          originalProfile,
          latestProfileRevision,
        );
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (authorization && originalLimits) {
      try {
        await restoreUploadLimits(request, authorization, originalLimits);
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (authorization) {
      try {
        const logoutResponse = await request.post(`${apiBaseURL}/auth/logout`, {
          data: {},
        });
        expect(logoutResponse.status()).toBe(204);
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
  }

  expect
    .soft(
      cleanupErrors.map(cleanupErrorMessage),
      'Real-backend cleanup must restore every mutable seed',
    )
    .toEqual([]);
  if (primaryError) throw primaryError;
});
