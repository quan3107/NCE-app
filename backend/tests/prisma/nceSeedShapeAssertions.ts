/**
 * File: tests/prisma/nceSeedShapeAssertions.ts
 * Purpose: Provide invariant checks for NCE content seed fixture structures.
 * Why: Keeps first-release NCE lessons complete enough for database seeds and later APIs.
 */
import assert from 'node:assert/strict'

type NceSeedBookLike = {
  code: string
  level: string
  units: Array<{
    unitNumber: number
    lessons: Array<{
      lessonNumber: number
      lessonText: string
      status: string
      publishedAt: Date | string | null
      objectives: Array<{
        code: string
        category: string
        masteryThreshold: number
      }>
      exercises: Array<{
        exerciseType: string
        content: unknown
        answerKey: unknown
        scoringConfig: unknown
      }>
    }>
  }>
}

function asRecord(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value))
  return value as Record<string, unknown>
}

export function assertRepresentativeNceBookSeed(
  book: NceSeedBookLike,
  expectedExerciseTypes: readonly string[],
): void {
  assert.equal(book.code, 'NCE-BOOK-1')
  assert.equal(book.level, 'beginner')

  const lessons = book.units.flatMap((unit) => unit.lessons)
  assert.ok(lessons.length >= 2)

  const seenLessonKeys = new Set<string>()
  const seenExerciseTypes = new Set<string>()

  for (const unit of book.units) {
    assert.ok(Number.isInteger(unit.unitNumber))
    for (const lesson of unit.lessons) {
      const key = `${unit.unitNumber}:${lesson.lessonNumber}`
      assert.ok(!seenLessonKeys.has(key))
      seenLessonKeys.add(key)

      assert.ok(lesson.lessonText.trim().length >= 80)
      assert.equal(lesson.status, 'published')
      assert.ok(lesson.publishedAt)
      assert.ok(lesson.objectives.length >= 2)
      assert.ok(lesson.exercises.length >= 2)

      for (const objective of lesson.objectives) {
        assert.ok(objective.code.startsWith(`nce-b1-u${unit.unitNumber}-l`))
        assert.ok(objective.category.trim().length > 0)
        assert.ok(objective.masteryThreshold >= 60)
        assert.ok(objective.masteryThreshold <= 100)
      }

      for (const exercise of lesson.exercises) {
        seenExerciseTypes.add(exercise.exerciseType)
        assert.ok(Object.keys(asRecord(exercise.content)).length > 0)
        assert.ok(Object.keys(asRecord(exercise.answerKey)).length > 0)
        assert.ok(Object.keys(asRecord(exercise.scoringConfig)).length > 0)
      }
    }
  }

  assert.deepEqual([...seenExerciseTypes].sort(), [...expectedExerciseTypes].sort())
}
