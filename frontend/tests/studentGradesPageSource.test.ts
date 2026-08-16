import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

test('StudentGradesPage renders IELTS scores without repeated band labels', async () => {
  const pagePath = path.resolve(
    import.meta.dirname,
    '../src/features/grades/components/StudentGradesPage.tsx',
  );
  const source = await readFile(pagePath, 'utf8');
  const presentationSource = await readFile(
    path.resolve(
      import.meta.dirname,
      '../src/features/grades/components/StudentGradePresentation.tsx',
    ),
    'utf8',
  );

  assert.match(source, /scoreSummary/);
  assert.match(presentationSource, /scoreDisplay\.kind === 'ielts_band'/);
  assert.match(presentationSource, /formatBandScore/);
  assert.match(
    presentationSource,
    /primary: formatBandScore\(grade\.scoreDisplay\.value\)/,
  );
  assert.match(
    presentationSource,
    /\`\$\{formatBandScore\(item\.points\)\} \/ \$\{formatBandScore\(item\.maxPoints\)\}\`/,
  );
  assert.match(presentationSource, /grade\.scoreDisplay\.kind === 'points'/);
});

test('StudentGradesPage renders objective explanation failure messages from the API', async () => {
  const pagePath = path.resolve(
    import.meta.dirname,
    '../src/features/grades/components/StudentGradesPage.tsx',
  );
  const source = await readFile(pagePath, 'utf8');

  assert.match(source, /failureMessage/);
  assert.match(source, /toExplanationState/);
  assert.match(
    source,
    /state\.failureMessage \?\?[\s\S]*Explanation is not available for this\s+question\./,
  );
});

test('StudentGradesPage disables terminal unavailable explanation actions', async () => {
  const pagePath = path.resolve(
    import.meta.dirname,
    '../src/features/grades/components/StudentGradesPage.tsx',
  );
  const source = await readFile(pagePath, 'utf8');

  assert.match(source, /terminalUnavailable/);
  assert.match(
    source,
    /state\?\.status === 'review_required' \|\|[\s\S]*state\?\.status === 'rejected'/,
  );
  assert.match(
    source,
    /disabled=\{\s*active \|\|\s*Boolean\(ready\) \|\|\s*terminalUnavailable\s*\}/,
  );
  assert.match(source, /\? 'Unavailable'/);
});
