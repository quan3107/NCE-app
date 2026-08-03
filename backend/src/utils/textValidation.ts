/**
 * File: src/utils/textValidation.ts
 * Purpose: Validate Unicode text before PostgreSQL persistence.
 * Why: PostgreSQL rejects NUL and cannot preserve unpaired UTF-16 surrogates exactly.
 */

export function unicodeCodePointLength(value: string): number {
  return Array.from(value).length;
}

export function isPostgresSafeText(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit === 0) return false;
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const nextCodeUnit = value.charCodeAt(index + 1);
      if (nextCodeUnit < 0xdc00 || nextCodeUnit > 0xdfff) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}
