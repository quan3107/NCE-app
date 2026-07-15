/**
 * File: src/modules/analytics/analytics.csv.ts
 * Purpose: Serialize filtered teacher analytics into a stable CSV contract.
 * Why: Keeps export values sourced directly from the authorized JSON aggregate.
 */
import type { TeacherAnalyticsResponse } from './analytics.types.js'

const COLUMNS = [
  'row_type',
  'teacher_id',
  'course_id',
  'course_title',
  'criterion',
  'course_count',
  'submission_count',
  'graded_count',
  'on_time_rate',
  'average_score',
  'average_turnaround_days',
  'sample_size',
  'generated_at',
] as const

type CsvValue = string | number | null

const FORMULA_PREFIX = /^[\s\u0000-\u001f\u007f-\u009f]*[=+\-@]/u

const escapeCsvValue = (value: CsvValue): string => {
  if (value === null) {
    return ''
  }

  const text =
    typeof value === 'string' && FORMULA_PREFIX.test(value) ? `'${value}` : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export const serializeTeacherAnalyticsCsv = (
  analytics: TeacherAnalyticsResponse,
): string => {
  const rows: CsvValue[][] = [
    [
      'overall',
      analytics.teacherId,
      '',
      '',
      '',
      analytics.courseCount,
      '',
      '',
      analytics.onTimeRate,
      analytics.averageScore,
      analytics.averageTurnaroundDays,
      '',
      analytics.generatedAt,
    ],
    ...analytics.courses.map((course) => [
      'course',
      analytics.teacherId,
      course.courseId,
      course.courseTitle,
      '',
      '',
      course.submissionCount,
      course.gradedCount,
      course.onTimeRate,
      course.averageScore,
      course.averageTurnaroundDays,
      '',
      analytics.generatedAt,
    ]),
    ...analytics.rubricAverages.map((rubric) => [
      'rubric',
      analytics.teacherId,
      '',
      '',
      rubric.criterion,
      '',
      '',
      '',
      '',
      rubric.averageScore,
      '',
      rubric.sampleSize,
      analytics.generatedAt,
    ]),
  ]

  return `${[COLUMNS, ...rows]
    .map((row) => row.map(escapeCsvValue).join(','))
    .join('\r\n')}\r\n`
}
