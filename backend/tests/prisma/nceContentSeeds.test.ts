/**
 * File: tests/prisma/nceContentSeeds.test.ts
 * Purpose: Validate NCE schema, migration, package script, and seed fixture contracts.
 * Why: PR-40 adds foundational NCE content tables and must keep the seed path idempotent and complete.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  NCE_BOOK_SEEDS,
  NCE_EXERCISE_TYPES,
} from '../../src/prisma/seeds/nceContent.data.js'
import { assertRepresentativeNceBookSeed } from './nceSeedShapeAssertions.js'

const testDir = dirname(fileURLToPath(import.meta.url))
const backendRoot = resolve(testDir, '../..')
const repoRoot = resolve(backendRoot, '..')

function readBackend(relativePath: string): string {
  return readFileSync(resolve(backendRoot, relativePath), 'utf8')
}

function readRepo(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8')
}

describe('NCE Prisma schema', () => {
  it('defines first-class content models, publish state, exercises, and course lesson mapping', () => {
    const schema = readBackend('src/prisma/schema.prisma')

    expect(schema).toContain('enum NcePublishStatus')
    expect(schema).toContain('enum NceExerciseType')
    expect(schema).toContain('model NceBook')
    expect(schema).toContain('model NceUnit')
    expect(schema).toContain('model NceLesson')
    expect(schema).toContain('model NceObjective')
    expect(schema).toContain('model NceExercise')
    expect(schema).toContain('model NceCourseLessonAssignment')
    expect(schema).toContain('courseId    String?')
    expect(schema).toContain('@@unique([code]')
    expect(schema).toContain('@@unique([bookId, unitNumber]')
    expect(schema).toContain('@@index([courseId, unitId, lessonNumber]')
    expect(schema).toContain('@@unique([courseId, sequence]')
  })

  it('ships an add_nce_content migration with tables, enums, access controls, and unique constraints', () => {
    const migration = readBackend(
      'src/prisma/migrations/20260617120000_add_nce_content/migration.sql',
    )

    expect(migration).toContain('CREATE TYPE "NcePublishStatus"')
    expect(migration).toContain('CREATE TYPE "NceExerciseType"')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.nce_books')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.nce_units')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.nce_lessons')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.nce_objectives')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.nce_exercises')
    expect(migration).toContain(
      'CREATE TABLE IF NOT EXISTS public.nce_course_lesson_assignments',
    )
    expect(migration).toContain('nce_units_book_id_unit_number_key')
    expect(migration).toContain('nce_lessons_unit_id_lesson_number_key')
    expect(migration).toContain('nce_course_lesson_course_sequence_key')
    expect(migration).toContain('ALTER TABLE public.nce_books ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('CREATE POLICY nce_exercises_select_published')
    expect(migration).toContain('GRANT SELECT (')
    expect(migration).not.toContain('nce_exercises_lesson_type_sort_idx')
  })

  it('scopes teacher-authored NCE lessons without removing canonical uniqueness', () => {
    const migration = readBackend(
      'src/prisma/migrations/20260618162000_scope_nce_lessons_to_courses/migration.sql',
    )

    expect(migration).toContain('ADD COLUMN IF NOT EXISTS course_id')
    expect(migration).toContain('DROP CONSTRAINT IF EXISTS nce_lessons_unit_id_lesson_number_key')
    expect(migration).toContain('nce_lessons_global_unit_number_key')
    expect(migration).toContain('WHERE course_id IS NULL')
    expect(migration).toContain('nce_lessons_course_unit_number_key')
    expect(migration).toContain('WHERE course_id IS NOT NULL')
    expect(migration).toContain('DROP POLICY IF EXISTS nce_lessons_select_published')
    expect(migration).toContain('DROP POLICY IF EXISTS nce_objectives_select_published')
    expect(migration).toContain('DROP POLICY IF EXISTS nce_exercises_select_published')
    expect(migration).toContain('AND course_id IS NULL')
    expect(migration).toContain('AND lesson.course_id IS NULL')
  })
})

describe('NCE seed fixtures', () => {
  it('covers the representative Book 1 path with all supported exercise types', () => {
    expect(NCE_BOOK_SEEDS).toHaveLength(1)
    assertRepresentativeNceBookSeed(NCE_BOOK_SEEDS[0], NCE_EXERCISE_TYPES)
  })

  it('keeps the NCE content seed separate from destructive demo seeding', () => {
    const packageJson = JSON.parse(readBackend('package.json')) as {
      scripts: Record<string, string>
    }
    const demoSeed = readBackend('src/prisma/seed.ts')
    const nceSeed = readBackend('src/prisma/seeds/nceContent.seed.ts')

    expect(packageJson.scripts['seed:nce-content']).toBe(
      'tsx src/prisma/seedNceContent.ts',
    )
    expect(demoSeed).not.toContain('seedNceContent')
    expect(nceSeed).toContain('nceCourseLessonAssignment.deleteMany')
    expect(nceSeed).toContain('nceCourseLessonAssignment.create')
    expect(nceSeed).not.toContain('nceCourseLessonAssignment.upsert')
  })

  it('records backend progress for the NCE schema and seed foundation', () => {
    const progress = readRepo('PROGRESS.md')

    expect(progress).toContain('PR-40')
    expect(progress).toContain('NCE content schema')
    expect(progress).toContain('seed:nce-content')
  })
})
