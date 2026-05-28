import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

const frontendRoot = path.resolve(import.meta.dirname, '..');
const appRoutesPath = path.join(frontendRoot, 'src/routes/AppRoutes.tsx');
const routeLoadingPath = path.join(frontendRoot, 'src/routes/RouteLoading.tsx');

test('AppRoutes lazy-loads heavy route modules behind a shared loading fallback', async () => {
  const source = await readFile(appRoutesPath, 'utf8');

  assert.match(source, /import\s+\{[^}]*Suspense[^}]*lazy[^}]*type ReactNode[^}]*\}\s+from\s+'react';/);
  assert.match(source, /import\s+\{\s*RouteLoading\s*\}\s+from\s+'@routes\/RouteLoading';/);
  assert.match(source, /const\s+TeacherAssignmentsPage\s*=\s*lazy\(/);
  assert.match(source, /const\s+TeacherAnalyticsPage\s*=\s*lazy\(/);
  assert.match(source, /const\s+StudentAssignmentDetailPage\s*=\s*lazy\(/);
  assert.match(source, /<Suspense fallback=\{<RouteLoading \/>\}>/);

  assert.doesNotMatch(
    source,
    /import\s+\{\s*TeacherAssignmentsPage\s*\}\s+from\s+'@features\/assignments\/components\/TeacherAssignmentsPage';/,
  );
  assert.doesNotMatch(
    source,
    /import\s+\{\s*TeacherAnalyticsPage\s*\}\s+from\s+'@features\/analytics\/components\/TeacherAnalyticsPage';/,
  );
});

test('RouteLoading keeps a lightweight accessible loading message', async () => {
  const source = await readFile(routeLoadingPath, 'utf8');

  assert.match(source, /aria-live="polite"/);
  assert.match(source, />\s*Loading\.\.\.\s*</);
});
