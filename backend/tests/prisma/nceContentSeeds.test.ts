/**
 * File: tests/prisma/nceContentSeeds.test.ts
 * Purpose: Validate NCE schema, migration, package script, and seed fixture contracts.
 * Why: PR-40 adds foundational NCE content tables and must keep the seed path idempotent and complete.
 */
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  NCE_BOOK_SEEDS,
  NCE_EXERCISE_TYPES,
} from '../../src/prisma/seeds/nceContent.data.js'
import { seedNceAssets } from '../../src/prisma/seeds/nceAssets.seed.js'
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

function readMigrationSql(): string {
  const migrationsRoot = resolve(backendRoot, 'src/prisma/migrations')
  return readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) =>
      readFileSync(resolve(migrationsRoot, entry.name, 'migration.sql'), 'utf8'),
    )
    .join('\n')
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
    expect(migration).toContain(
      'DROP CONSTRAINT IF EXISTS nce_lessons_unit_id_lesson_number_key',
    )
    expect(migration).toContain('nce_lessons_global_unit_number_key')
    expect(migration).toContain('WHERE course_id IS NULL')
    expect(migration).toContain('nce_lessons_course_unit_number_key')
    expect(migration).toContain('WHERE course_id IS NOT NULL')
    expect(migration).toContain('DROP POLICY IF EXISTS nce_lessons_select_published')
    expect(migration).toContain('DROP POLICY IF EXISTS nce_objectives_select_published')
    expect(migration).toContain('DROP POLICY IF EXISTS nce_exercises_select_published')
    expect(migration).toContain('course_id IS NULL')
    expect(migration).toContain('lesson.course_id IS NULL')
    expect(migration).toContain('nce_lessons_select_published_course_members')
    expect(migration).toContain('nce_objectives_select_published_course_members')
    expect(migration).toContain('nce_exercises_select_published_course_members')
    expect(migration).toContain(
      "current_setting('app.current_user_role', true) = 'admin'",
    )
    expect(migration).toContain('course.owner_teacher_id = NULLIF')
    expect(migration).toContain('assignment.course_id = nce_lessons.course_id')
    expect(migration).toContain('assignment.course_id = lesson.course_id')
    expect(migration).toContain("enrollment.role_in_course IN ('teacher', 'student')")
    expect(migration).toMatch(
      /CREATE POLICY nce_lessons_select_published[\s\S]*?TO anon, authenticated, service_role/,
    )
    expect(migration).toMatch(
      /CREATE POLICY nce_objectives_select_published[\s\S]*?TO anon, authenticated, service_role/,
    )
    expect(migration).toMatch(
      /CREATE POLICY nce_exercises_select_published[\s\S]*?TO anon, authenticated, service_role/,
    )
    expect(migration).toContain(
      'GRANT SELECT (course_id) ON public.nce_lessons TO anon, authenticated, service_role',
    )

    const writableTables = [
      'nce_lessons',
      'nce_objectives',
      'nce_exercises',
      'nce_course_lesson_assignments',
    ]
    for (const table of writableTables) {
      expect(migration).toContain(
        `GRANT INSERT, UPDATE, DELETE ON public.${table} TO service_role`,
      )
      expect(migration).toMatch(
        new RegExp(
          `CREATE POLICY ${table}_service_role_insert[\\s\\S]*?FOR INSERT[\\s\\S]*?WITH CHECK \\(current_role = 'service_role'\\)`,
        ),
      )
      expect(migration).toMatch(
        new RegExp(
          `CREATE POLICY ${table}_service_role_update[\\s\\S]*?FOR UPDATE[\\s\\S]*?USING \\(current_role = 'service_role'\\)[\\s\\S]*?WITH CHECK \\(current_role = 'service_role'\\)`,
        ),
      )
      expect(migration).toMatch(
        new RegExp(
          `CREATE POLICY ${table}_service_role_delete[\\s\\S]*?FOR DELETE[\\s\\S]*?USING \\(current_role = 'service_role'\\)`,
        ),
      )
    }
  })

  it('enforces one draft NCE attempt per student exercise without limiting submissions', () => {
    const migrations = readMigrationSql()

    expect(migrations).toContain('nce_attempts_one_draft_per_student_exercise_key')
    expect(migrations).toMatch(
      /CREATE UNIQUE INDEX[\s\S]*?ON public\.nce_exercise_attempts\s*\(course_id, exercise_id, student_id\)[\s\S]*?WHERE status = 'draft'/,
    )
  })
})

describe('NCE seed fixtures', () => {
  it('covers the representative Book 1 path with all supported exercise types', () => {
    expect(NCE_BOOK_SEEDS).toHaveLength(1)
    assertRepresentativeNceBookSeed(NCE_BOOK_SEEDS[0], NCE_EXERCISE_TYPES)
  })

  it('provisions every protected audio object referenced by the demo lessons', () => {
    const assetRoot = mkdtempSync(resolve(tmpdir(), 'nce-seeded-assets-'))

    try {
      const result = seedNceAssets({ NCE_ASSET_ROOT: assetRoot })
      const referencedKeys = new Set<string>()
      for (const book of NCE_BOOK_SEEDS) {
        for (const unit of book.units) {
          for (const lesson of unit.lessons) {
            for (const exercise of lesson.exercises) {
              const key = exercise.content.audioKey
              if (typeof key === 'string') referencedKeys.add(key)
            }
          }
        }
      }

      expect(result.assets).toBe(referencedKeys.size)
      for (const key of referencedKeys) {
        const audio = readFileSync(resolve(assetRoot, key))
        expect(audio.length).toBeGreaterThan(1_000)
        expect(audio.subarray(0, 4).toString('ascii')).toBe('OggS')
      }
    } finally {
      rmSync(assetRoot, { force: true, recursive: true })
    }
  })

  it('preserves an existing configured NCE audio object on seed replay', () => {
    const assetRoot = mkdtempSync(resolve(tmpdir(), 'nce-preserved-assets-'))
    const existingPath = resolve(assetRoot, 'nce/book1/lesson1/dialogue.ogg')
    const operatorBytes = Buffer.from('operator-provided-audio')
    mkdirSync(dirname(existingPath), { recursive: true })
    writeFileSync(existingPath, operatorBytes)

    try {
      const firstReplay = seedNceAssets({ NCE_ASSET_ROOT: assetRoot })
      const secondReplay = seedNceAssets({ NCE_ASSET_ROOT: assetRoot })

      expect(firstReplay).toMatchObject({ assets: 2, created: 1 })
      expect(secondReplay).toMatchObject({ assets: 2, created: 0 })
      expect(readFileSync(existingPath)).toEqual(operatorBytes)
    } finally {
      rmSync(assetRoot, { force: true, recursive: true })
    }
  })

  it('keeps NCE course fixtures in the explicit demo seed namespace', () => {
    const packageJson = JSON.parse(readBackend('package.json')) as {
      scripts: Record<string, string>
    }
    const demoSeed = readBackend('src/prisma/seed.ts')
    const nceSeed = readBackend('src/prisma/seeds/nceContent.seed.ts')

    expect(packageJson.scripts['seed:demo:nce-content']).toBe(
      'tsx scripts/runOwnerJob.ts tsx src/prisma/seedNceContent.ts',
    )
    expect(packageJson.scripts['seed:nce-content']).toBeUndefined()
    expect(demoSeed).not.toContain('seedNceContent')
    expect(nceSeed).not.toContain("from '../client.js'")
    expect(nceSeed).toContain("const DEMO_NCE_TEACHER_EMAIL = 'sarah.tutor@ielts.local'")
    expect(nceSeed).toMatch(
      /const teacher =\s*demoTeacher \?\?\s*\(await prisma\.user\.upsert/,
    )
    expect(nceSeed).toMatch(
      /export async function seedNceContent\(\s*prismaClient: PrismaClient/,
    )
    expect(nceSeed).not.toMatch(/prisma: PrismaClient\s*=\s*basePrisma/)
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
