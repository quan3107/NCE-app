/**
 * Location: tests/openApiReviewRegressions.test.ts
 * Purpose: Preserve runtime-aligned OpenAPI response and validation contracts.
 * Why: Generated clients must accept every value and failure shape the API can emit.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '../..');

async function readRepositoryFile(relativePath: string): Promise<string> {
  return readFile(path.join(repositoryRoot, relativePath), 'utf8');
}

function fragment(source: string, name: string): string {
  const match = source.match(
    new RegExp(
      `^${name}:[\\s\\S]*?(?=^[A-Za-z][A-Za-z0-9]*:|(?![\\s\\S]))`,
      'm',
    ),
  );
  assert.ok(match, `Missing YAML fragment ${name}`);
  return match[0];
}

function response(fragmentSource: string, status: number): string {
  const match = fragmentSource.match(
    new RegExp(
      `^      '${status}':[\\s\\S]*?(?=^      '[1-5][0-9][0-9]':|^    security:|(?![\\s\\S]))`,
      'm',
    ),
  );
  assert.ok(match, `Missing ${status} response`);
  return match[0];
}

function assertCommonResponse(fragmentSource: string, status: number): void {
  assert.match(
    response(fragmentSource, status),
    /schemas\/common\.yaml#\/ErrorResponse/,
  );
}

test('course learning outcomes accept arbitrary JSON values', async () => {
  const schemas = await readRepositoryFile('docs/openapi/schemas/courses.yaml');

  for (const schemaName of ['Course', 'UpdateCourseRequest', 'CourseMutationResponse']) {
    const learningOutcomes =
      fragment(schemas, schemaName).match(
        /    learningOutcomes:\r?\n([\s\S]*?)(?=    [A-Za-z]\w*:\r?\n)/,
      )?.[0] ?? '';

    assert.match(learningOutcomes, /arbitrary JSON/i);
    assert.doesNotMatch(learningOutcomes, /type: array/);
  }
});

test('objective explanation conflicts cover terminal and precondition bodies', async () => {
  const paths = await readRepositoryFile(
    'docs/openapi/paths/objective-explanations.yaml',
  );
  const operation = fragment(paths, 'SubmissionObjectiveExplanation');

  for (const conflict of operation.matchAll(
    /^      '409':[\s\S]*?(?=^      '[1-5][0-9][0-9]':|^    security:)/gm,
  )) {
    assert.match(conflict[0], /oneOf:/);
    assert.match(
      conflict[0],
      /objective-explanations\.yaml#\/ObjectiveExplanationResponse/,
    );
    assert.match(conflict[0], /common\.yaml#\/ErrorResponse/);
  }

  assert.equal([...operation.matchAll(/^      '409':/gm)].length, 2);
});

test('new protected operations document middleware and handler failures', async () => {
  const [uploadPaths, tabPaths, objectivePaths, userPaths, filePaths] =
    await Promise.all([
      readRepositoryFile('docs/openapi/paths/file-upload-config.yaml'),
      readRepositoryFile('docs/openapi/paths/course-management-tabs.yaml'),
      readRepositoryFile('docs/openapi/paths/objective-explanations.yaml'),
      readRepositoryFile('docs/openapi/paths/users.yaml'),
      readRepositoryFile('docs/openapi/paths/files.yaml'),
    ]);

  for (const name of ['FileUploadLimits', 'AllowedFileTypes']) {
    const operation = fragment(uploadPaths, name);
    for (const status of [400, 401, 403, 500]) {
      assertCommonResponse(operation, status);
    }
  }

  const tabs = fragment(tabPaths, 'CourseManagementTabs');
  for (const status of [400, 401, 403]) {
    assertCommonResponse(tabs, status);
  }

  const explanations = fragment(objectivePaths, 'SubmissionObjectiveExplanation');
  assert.equal([...explanations.matchAll(/^      '400':/gm)].length, 2);
  assert.equal([...explanations.matchAll(/^      '500':/gm)].length, 2);

  for (const name of ['UserInvite', 'TeacherApproval', 'TeacherRejection']) {
    const operation = fragment(userPaths, name);
    assertCommonResponse(operation, 400);
    assertCommonResponse(operation, 500);
  }

  const fileContent = fragment(filePaths, 'FileContent');
  assertCommonResponse(fileContent, 400);
  assertCommonResponse(fileContent, 500);
});

test('IELTS operations distinguish controller errors from global 500 errors', async () => {
  const paths = await readRepositoryFile('docs/openapi/paths/ielts-config.yaml');

  for (const name of ['IeltsConfig', 'IeltsConfigVersions']) {
    const serverError = response(fragment(paths, name), 500);
    assert.match(serverError, /oneOf:/);
    assert.match(serverError, /ielts-config\.yaml#\/IeltsConfigErrorResponse/);
    assert.match(serverError, /common\.yaml#\/ErrorResponse/);
  }

  assertCommonResponse(fragment(paths, 'QuestionOptions'), 500);
});

test('invite normalization and course-tab filtering are documented', async () => {
  const [userSchemas, tabPaths] = await Promise.all([
    readRepositoryFile('docs/openapi/schemas/users.yaml'),
    readRepositoryFile('docs/openapi/paths/course-management-tabs.yaml'),
  ]);
  const invite = fragment(userSchemas, 'InviteUserRequest');

  assert.match(invite, /additionalProperties: true/);
  assert.match(invite, /pattern: ['"]?\\S/);
  assert.match(invite, /clients[\s\S]*normalize[\s\S]*before[\s\S]*validation/i);
  assert.match(invite, /unknown properties[\s\S]*discarded/i);
  assert.doesNotMatch(invite, /example: ['"]\s/);
  assert.doesNotMatch(invite, /email: ['"]\s/);
  assert.match(
    fragment(tabPaths, 'CourseManagementTabs'),
    /enabled, permission-filtered/i,
  );
});

test('CI runs the root OpenAPI validator', async () => {
  const workflow = await readRepositoryFile('.github/workflows/ci.yml');
  const rootJob = workflow.match(/^  root:[\s\S]*?(?=^  frontend:)/m)?.[0] ?? '';

  assert.match(rootJob, /npm run openapi:validate/);
});
