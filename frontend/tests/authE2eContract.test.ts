/**
 * Location: tests/authE2eContract.test.ts
 * Purpose: Keep browser auth scenarios on the memory-only production contract.
 * Why: Playwright fixtures must not restore storage authority or bypass explicit admission.
 */

import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import ts from 'typescript';

const e2eRoot = path.resolve(import.meta.dirname, '../e2e');

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(target);
      return /\.tsx?$/.test(entry.name) ? [target] : [];
    }),
  );
  return nested.flat();
}

test('Playwright auth setup never restores the legacy currentUser snapshot', async () => {
  for (const file of await sourceFiles(e2eRoot)) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(
      source,
      /(?:window\.)?localStorage\.(?:getItem|setItem)\(\s*['"]currentUser['"]/,
      path.relative(e2eRoot, file),
    );
  }
});

test('Playwright apiClient calls declare an auth mode', async () => {
  for (const file of await sourceFiles(e2eRoot)) {
    const source = await readFile(file, 'utf8');
    const sourceFile = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'apiClient'
      ) {
        const options = node.arguments[1];
        const hasAuth =
          options &&
          ts.isObjectLiteralExpression(options) &&
          options.properties.some(
            (property) =>
              ts.isPropertyAssignment(property) &&
              property.name.getText(sourceFile) === 'auth',
          );
        assert.equal(
          hasAuth,
          true,
          `${path.relative(e2eRoot, file)}:${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1}`,
        );
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
});
