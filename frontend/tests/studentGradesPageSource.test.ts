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

  assert.match(source, /scoreDisplay\.kind === 'ielts_band'/);
  assert.match(source, /formatBandScore/);
  assert.match(
    source,
    /primary: formatBandScore\(grade\.scoreDisplay\.value\)/,
  );
  assert.match(
    source,
    /\`\$\{formatBandScore\(item\.points\)\} \/ \$\{formatBandScore\(item\.maxPoints\)\}\`/,
  );
  assert.match(source, /grade\.scoreDisplay\.kind === 'points'/);
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
