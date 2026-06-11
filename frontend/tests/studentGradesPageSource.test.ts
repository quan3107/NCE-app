import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

test('StudentGradesPage renders IELTS bands without generic percentages', async () => {
  const pagePath = path.resolve(
    import.meta.dirname,
    '../src/features/grades/components/StudentGradesPage.tsx',
  );
  const source = await readFile(pagePath, 'utf8');

  assert.match(source, /scoreDisplay\.kind === 'ielts_band'/);
  assert.match(source, /formatBandScore/);
  assert.match(
    source,
    /Band \$\{formatBandScore\(grade\.scoreDisplay\.value\)\}/,
  );
  assert.match(source, /\/ \$\{formatBandScore\(item\.maxPoints\)\}/);
  assert.match(source, /grade\.scoreDisplay\.kind === 'points'/);
});
