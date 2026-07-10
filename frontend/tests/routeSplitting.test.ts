import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

const frontendRoot = path.resolve(import.meta.dirname, '..');
const appRoutesPath = path.join(frontendRoot, 'src/routes/AppRoutes.tsx');
const lazyRoutesPath = path.join(frontendRoot, 'src/routes/lazyRouteComponents.ts');
const routeLoadingPath = path.join(frontendRoot, 'src/routes/RouteLoading.tsx');

test('AppRoutes lazy-loads heavy route modules behind a shared loading fallback', async () => {
  const source = await readFile(appRoutesPath, 'utf8');

  assert.ok(source.split(/\r?\n/).length <= 300, 'AppRoutes.tsx must stay within 300 lines');
  assert.match(source, /import\s+\{[^}]*Suspense[^}]*type ReactNode[^}]*\}\s+from\s+'react';/);
  assert.match(source, /import\s+\{\s*RouteLoading\s*\}\s+from\s+'@routes\/RouteLoading';/);
  assert.match(source, /from\s+'@routes\/lazyRouteComponents';/);
  assert.match(source, /<Suspense fallback=\{<RouteLoading \/>\}>/);

  const lazySource = await readFile(lazyRoutesPath, 'utf8');
  assert.ok(
    lazySource.split(/\r?\n/).length <= 300,
    'lazyRouteComponents.ts must stay within 300 lines',
  );
  assert.match(lazySource, /export const\s+TeacherAssignmentsPage\s*=\s*lazy\(/);
  assert.match(lazySource, /export const\s+TeacherAnalyticsPage\s*=\s*lazy\(/);
  assert.match(lazySource, /export const\s+StudentAssignmentDetailPage\s*=\s*lazy\(/);

  assert.doesNotMatch(
    lazySource,
    /import\s+\{\s*TeacherAssignmentsPage\s*\}\s+from\s+'@features\/assignments\/components\/TeacherAssignmentsPage';/,
  );
  assert.doesNotMatch(
    lazySource,
    /import\s+\{\s*TeacherAnalyticsPage\s*\}\s+from\s+'@features\/analytics\/components\/TeacherAnalyticsPage';/,
  );
});

test('RouteLoading keeps a lightweight accessible loading message', async () => {
  const source = await readFile(routeLoadingPath, 'utf8');

  assert.match(source, /aria-live="polite"/);
  assert.match(source, />\s*Loading\.\.\.\s*</);
});
