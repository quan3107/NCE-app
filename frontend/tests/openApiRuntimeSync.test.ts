/**
 * Location: tests/openApiRuntimeSync.test.ts
 * Purpose: Compare mounted Express routes with the OpenAPI entry point.
 * Why: A source-backed inventory prevents active endpoints from silently losing contract coverage.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '../..');
const modulesRoot = path.join(repositoryRoot, 'backend/src/modules');
const openApiPath = path.join(repositoryRoot, 'docs/openapi/openapi.yaml');
const routerPath = path.join(modulesRoot, 'router.ts');
const testOnlyOperations = new Set([
  'GET /api/v1/auth/google/test-provider',
  'GET /api/v1/auth/google/test-provider/complete',
]);

type RouterImport = {
  routeObject: string;
  sourcePath: string;
};

function collectRouterImports(source: string): Map<string, RouterImport> {
  const imports = new Map<string, RouterImport>();
  const pattern =
    /^import\s+(?:\{([^}]+)\}|([A-Za-z]\w*))\s+from\s+["'](.+?\.routes)\.js["'];?$/gm;

  for (const match of source.matchAll(pattern)) {
    const [, namedImports, defaultImport, relativePath] = match;
    const sourcePath = path.resolve(modulesRoot, `${relativePath}.ts`);

    if (defaultImport) {
      imports.set(defaultImport, { routeObject: 'router', sourcePath });
      continue;
    }

    for (const importedName of (namedImports ?? '').split(',')) {
      const localName = importedName.trim();
      if (localName) {
        imports.set(localName, { routeObject: localName, sourcePath });
      }
    }
  }

  return imports;
}

function joinApiPath(mountPath: string, routePath: string): string {
  const suffix = routePath === '/' ? '' : routePath;
  return `/api/v1${mountPath}${suffix}`.replace(
    /:([A-Za-z][A-Za-z0-9_]*)/g,
    '{$1}',
  );
}

async function collectMountedOperations(): Promise<string[]> {
  const routerSource = await readFile(routerPath, 'utf8');
  const imports = collectRouterImports(routerSource);
  const mountedOperations = new Set<string>();
  const mountPattern =
    /apiRouter\.use\(\s*["']([^"']+)["']\s*,\s*([A-Za-z]\w*)\s*,?\s*\)/g;

  for (const mount of routerSource.matchAll(mountPattern)) {
    const [, mountPath, routerName] = mount;
    const routerImport = imports.get(routerName);
    assert.ok(routerImport, `Unable to resolve mounted router ${routerName}`);

    const routeSource = await readFile(routerImport.sourcePath, 'utf8');
    const routePattern = new RegExp(
      `${routerImport.routeObject}\\.(get|post|put|patch|delete)\\(\\s*["']([^"']+)["']`,
      'g',
    );

    for (const route of routeSource.matchAll(routePattern)) {
      const operation = `${route[1].toUpperCase()} ${joinApiPath(mountPath, route[2])}`;
      // The explicitly enabled local OAuth fixture is not part of the production API contract.
      if (!testOnlyOperations.has(operation)) {
        mountedOperations.add(operation);
      }
    }
  }

  return [...mountedOperations].sort();
}

async function collectDocumentedOperations(
  openApiSource: string,
): Promise<Set<string>> {
  const operations = new Set<string>();
  const refPattern =
    /^  (\/api\/v1\/.*):\r?\n    \$ref: ['"](.+?)#\/([^'"]+)['"]\r?$/gm;

  for (const reference of openApiSource.matchAll(refPattern)) {
    const [, apiPath, relativePath, fragment] = reference;
    const referencedSource = await readFile(
      path.resolve(path.dirname(openApiPath), relativePath),
      'utf8',
    );
    const fragmentStart = referencedSource.indexOf(`${fragment}:`);
    assert.notEqual(fragmentStart, -1, `Unable to resolve OpenAPI fragment ${fragment}`);

    const remainingSource = referencedSource.slice(fragmentStart + fragment.length + 1);
    const nextFragment = remainingSource.search(/\r?\n[A-Za-z][A-Za-z0-9]*:\r?\n/);
    const fragmentSource =
      nextFragment === -1 ? remainingSource : remainingSource.slice(0, nextFragment);

    for (const method of fragmentSource.matchAll(
      /^  (get|post|put|patch|delete):\r?$/gm,
    )) {
      operations.add(`${method[1].toUpperCase()} ${apiPath}`);
    }
  }

  return operations;
}

function compareOperations(
  mountedOperations: readonly string[],
  documentedOperations: ReadonlySet<string>,
) {
  const mountedSet = new Set(mountedOperations);
  return {
    missing: mountedOperations.filter(
      (operation) => !documentedOperations.has(operation),
    ),
    stale: [...documentedOperations]
      .filter((operation) => !mountedSet.has(operation))
      .sort(),
  };
}

test('OpenAPI and mounted backend routes contain the same operations', async () => {
  const [mountedOperations, openApiSource] = await Promise.all([
    collectMountedOperations(),
    readFile(openApiPath, 'utf8'),
  ]);
  const documentedOperations = await collectDocumentedOperations(openApiSource);

  assert.deepEqual(compareOperations(mountedOperations, documentedOperations), {
    missing: [],
    stale: [],
  });
});

test('operation comparison reports an extra documented operation', () => {
  const mountedOperations = ['GET /api/v1/health'];
  const documentedOperations = new Set([
    'GET /api/v1/health',
    'POST /api/v1/stale',
  ]);

  assert.deepEqual(compareOperations(mountedOperations, documentedOperations), {
    missing: [],
    stale: ['POST /api/v1/stale'],
  });
});

test('OpenAPI reflects security-sensitive runtime contract details', async () => {
  const [
    auditPaths,
    authPaths,
    courseSchemas,
    gradeSchemas,
    notificationPaths,
    notificationSchemas,
    submissionSchemas,
  ] = await Promise.all([
    readFile(path.join(repositoryRoot, 'docs/openapi/paths/audit-logs.yaml'), 'utf8'),
    readFile(path.join(repositoryRoot, 'docs/openapi/paths/auth.yaml'), 'utf8'),
    readFile(path.join(repositoryRoot, 'docs/openapi/schemas/courses.yaml'), 'utf8'),
    readFile(path.join(repositoryRoot, 'docs/openapi/schemas/grades.yaml'), 'utf8'),
    readFile(path.join(repositoryRoot, 'docs/openapi/paths/notifications.yaml'), 'utf8'),
    readFile(path.join(repositoryRoot, 'docs/openapi/schemas/notifications.yaml'), 'utf8'),
    readFile(path.join(repositoryRoot, 'docs/openapi/schemas/submissions.yaml'), 'utf8'),
  ]);
  const refreshPath = authPaths.match(/Refresh:[\s\S]*?(?=\nLogout:)/)?.[0] ?? '';
  const courseMetrics =
    courseSchemas.match(/CourseMetrics:[\s\S]*?(?=\nCourseOwner:)/)?.[0] ?? '';
  const gradeRequest =
    gradeSchemas.match(/UpsertGradeRequest:[\s\S]*$/)?.[0] ?? '';
  const notificationReadPath =
    notificationPaths.match(/NotificationsRead:[\s\S]*$/)?.[0] ?? '';
  const notificationReadRequest =
    notificationSchemas.match(
      /MarkNotificationsReadRequest:[\s\S]*?(?=\nMarkNotificationsReadResponse:)/,
    )?.[0] ?? '';
  const submissionRequest =
    submissionSchemas.match(
      /CreateSubmissionRequest:[\s\S]*?(?=\nIeltsSubmissionPayload:)/,
    )?.[0] ?? '';

  assert.match(auditPaths, /name: offset/);
  assert.match(auditPaths, /schemas\/audit-logs\.yaml#\/AuditLogPage/);
  assert.match(refreshPath, /in: cookie[\s\S]*name: refreshToken/);
  assert.match(refreshPath, /Set-Cookie:/);
  assert.match(courseMetrics, /completionRatePercent:/);
  assert.match(
    notificationReadPath,
    /Non-admin callers can only mark their own notifications as read/,
  );
  assert.match(notificationReadRequest, /Authenticated non-admin callers must use their own user ID/);
  assert.doesNotMatch(submissionRequest, /studentId:/);
  assert.match(submissionRequest, /additionalProperties: false/);
  assert.match(submissionRequest, /required: \[payload\]/);
  assert.doesNotMatch(gradeRequest, /graderId:/);
});

test('root package exposes deterministic OpenAPI validation', async () => {
  const packageSource = await readFile(
    path.join(repositoryRoot, 'package.json'),
    'utf8',
  );
  const packageJson = JSON.parse(packageSource) as {
    scripts?: Record<string, string>;
  };

  assert.equal(
    packageJson.scripts?.['openapi:validate'],
    'redocly lint --extends=spec docs/openapi/openapi.yaml',
  );
});
