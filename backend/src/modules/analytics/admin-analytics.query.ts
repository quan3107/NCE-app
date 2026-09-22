/** Admin aggregates stay inside PostgreSQL; current eligibility prevents deleted or duplicate populations. */
import { Prisma } from '../../prisma/index.js'
import type { AdminAnalyticsFilters } from './admin-analytics.schema.js'

export function adminAnalyticsSql(f: AdminAnalyticsFilters) {
  return Prisma.sql`
WITH scope AS MATERIALIZED (
  SELECT id, title, owner_teacher_id FROM courses WHERE "deletedAt" IS NULL
    AND (${f.courseId ?? null}::uuid IS NULL OR id = ${f.courseId ?? null}::uuid)
), eligible AS MATERIALIZED (
  SELECT e.course_id, e.user_id, e."createdAt" AS enrolled_at FROM enrollments e
  JOIN scope c ON c.id = e.course_id JOIN users u ON u.id = e.user_id
  WHERE e."deletedAt" IS NULL AND e.role_in_course = 'student'
    AND u."deletedAt" IS NULL AND u.role = 'student' AND u.status = 'active'
), learners AS (SELECT DISTINCT user_id FROM eligible),
coverage AS (SELECT min(started_at) AS since FROM learning_activity_coverage),
activity AS MATERIALIZED (
  SELECT d.* FROM learning_activity_days d JOIN eligible e ON e.user_id = d.student_id AND e.course_id = d.course_id
  WHERE d.day >= (${f.start}::timestamptz AT TIME ZONE 'UTC')::date
    AND d.day < (${f.end}::timestamptz AT TIME ZONE 'UTC')::date
), assignments_scope AS MATERIALIZED (
  SELECT a.id, a.course_id, a.due_at, a.type, a.title, a.assignment_config FROM assignments a JOIN scope c ON c.id = a.course_id
  WHERE a."deletedAt" IS NULL AND a.published_at <= CURRENT_TIMESTAMP
), current_work AS MATERIALIZED (
  SELECT s.id, s.assignment_id, s.student_id, s.submitted_at,
    a.course_id, a.due_at, a.type, a.title AS assignment_title, a.assignment_config
  FROM submissions s JOIN assignments_scope a ON a.id = s.assignment_id
  JOIN eligible e ON e.course_id = a.course_id AND e.user_id = s.student_id
  WHERE s."deletedAt" IS NULL AND s.status <> 'draft' AND s.submitted_at IS NOT NULL
), period_work AS MATERIALIZED (
  SELECT w.*, g.id AS grade_id, g.final_score, g.band
  FROM current_work w LEFT JOIN grades g ON g.submission_id = w.id AND g."deletedAt" IS NULL
  WHERE w.submitted_at >= ${f.start} AND w.submitted_at < ${f.end}
), obligations AS (
  SELECT a.id, a.due_at, e.user_id FROM assignments_scope a JOIN eligible e ON e.course_id = a.course_id
  WHERE a.due_at >= ${f.start} AND a.due_at < ${f.end} AND e.enrolled_at <= a.due_at
    AND NOT EXISTS (SELECT 1 FROM current_work w WHERE w.assignment_id = a.id AND w.student_id = e.user_id)
), lessons AS MATERIALIZED (
  SELECT x.course_id, x.lesson_id FROM nce_course_lesson_assignments x JOIN scope c ON c.id = x.course_id
  JOIN nce_lessons l ON l.id = x.lesson_id JOIN nce_units u ON u.id = l.unit_id JOIN nce_books b ON b.id = u.book_id
  WHERE l.deleted_at IS NULL AND u.deleted_at IS NULL AND b.deleted_at IS NULL
    AND l.status = 'published' AND u.status = 'published' AND b.status = 'published'
    AND (x.available_from IS NULL OR x.available_from <= CURRENT_TIMESTAMP)
), course_progress AS (
  SELECT c.id AS "courseId", c.title AS "courseTitle",
    (SELECT count(*)::int FROM eligible e WHERE e.course_id = c.id) AS learners,
    (SELECT count(*)::int FROM lessons l JOIN eligible e ON e.course_id = l.course_id WHERE l.course_id = c.id) AS "lessonOpportunities",
    (SELECT count(*)::int FROM nce_lesson_progress p JOIN lessons l ON l.course_id = p.course_id AND l.lesson_id = p.lesson_id
      JOIN eligible e ON e.course_id = p.course_id AND e.user_id = p.student_id
      WHERE p.course_id = c.id AND p.status = 'completed') AS "completedLessons",
    (SELECT count(*)::int FROM assignments_scope a JOIN eligible e ON e.course_id = a.course_id WHERE a.course_id = c.id) AS "assignmentOpportunities",
    (SELECT count(*)::int FROM current_work w WHERE w.course_id = c.id) AS "submittedAssignments"
  FROM scope c ORDER BY c.title, c.id LIMIT 501
), scores AS (
  SELECT w.course_id AS "courseId", c.title AS "courseTitle", w.assignment_id AS "assignmentId",
    w.assignment_title AS "assignmentTitle", w.type::text AS skill,
    CASE WHEN w.type IN ('reading','listening','writing','speaking') THEN 'IELTS band (0–9)' ELSE 'Percentage of maximum' END AS scale,
    CASE WHEN w.type IN ('writing','speaking') THEN COALESCE(w.band, w.final_score)
      WHEN w.type IN ('reading','listening') THEN w.band
      WHEN w.final_score IS NOT NULL THEN 100 * w.final_score /
        CASE WHEN jsonb_typeof(w.assignment_config->'maxScore') = 'number'
          THEN CASE WHEN (w.assignment_config->>'maxScore')::numeric > 0
            THEN (w.assignment_config->>'maxScore')::numeric ELSE NULL END ELSE 100 END END AS score
  FROM period_work w JOIN scope c ON c.id = w.course_id WHERE w.grade_id IS NOT NULL
), results AS (
  SELECT "courseId", "courseTitle", "assignmentId", "assignmentTitle", skill, scale,
    count(score)::int AS samples, round(avg(score), 2)::float8 AS average
  FROM scores GROUP BY "courseId", "courseTitle", "assignmentId", "assignmentTitle", skill, scale
  ORDER BY "courseTitle", "assignmentTitle", "assignmentId" LIMIT 501
), trend AS (
  SELECT to_char(d, 'YYYY-MM-DD') AS day,
    CASE WHEN d + interval '1 day' <= (SELECT since FROM coverage) OR (SELECT since FROM coverage) IS NULL THEN NULL
      ELSE (SELECT count(DISTINCT student_id)::int FROM activity a WHERE a.day = d::date) END AS learners,
    CASE WHEN (SELECT since FROM coverage) IS NULL OR d < (SELECT since FROM coverage) THEN 'partial or unavailable' ELSE 'tracked' END AS coverage
  FROM generate_series(${f.start}::timestamptz AT TIME ZONE 'UTC', (${f.end}::timestamptz AT TIME ZONE 'UTC') - interval '1 day', interval '1 day') d
), no_activity AS (
  SELECT u.id, u.full_name AS name FROM learners l JOIN users u ON u.id = l.user_id
  WHERE NOT EXISTS (SELECT 1 FROM activity a WHERE a.student_id = u.id)
  ORDER BY u.full_name, u.id LIMIT 101
)
SELECT jsonb_build_object(
  'generatedAt', CURRENT_TIMESTAMP,
  'overview', jsonb_build_object(
    'students', (SELECT count(*) FROM users u WHERE u."deletedAt" IS NULL AND u.role = 'student'
      AND (${f.courseId ?? null}::uuid IS NULL OR EXISTS (SELECT 1 FROM enrollments e JOIN scope c ON c.id = e.course_id WHERE e.user_id = u.id AND e.role_in_course = 'student' AND e."deletedAt" IS NULL))),
    'teachers', (SELECT count(*) FROM users u WHERE u."deletedAt" IS NULL AND u.role = 'teacher'
      AND (${f.courseId ?? null}::uuid IS NULL OR EXISTS (SELECT 1 FROM scope c WHERE c.owner_teacher_id = u.id) OR EXISTS (SELECT 1 FROM enrollments e JOIN scope c ON c.id = e.course_id WHERE e.user_id = u.id AND e.role_in_course = 'teacher' AND e."deletedAt" IS NULL))),
    'courses', (SELECT count(*) FROM scope), 'publishedCourses', NULL,
    'enrollments', (SELECT count(*) FROM enrollments e JOIN scope c ON c.id = e.course_id JOIN users u ON u.id = e.user_id WHERE e."deletedAt" IS NULL AND u."deletedAt" IS NULL),
    'eligibleLearners', (SELECT count(*) FROM learners)),
  'engagement', jsonb_build_object('trackingSince', (SELECT since FROM coverage),
    'completeCoverage', COALESCE(${f.start} >= (SELECT since FROM coverage), false),
    'observedActive', CASE WHEN (SELECT since FROM coverage) IS NULL OR ${f.end} <= (SELECT since FROM coverage) THEN NULL ELSE (SELECT count(DISTINCT student_id) FROM activity) END,
    'noObservedActivity', (SELECT count(*) FROM learners l WHERE NOT EXISTS (SELECT 1 FROM activity a WHERE a.student_id = l.user_id)),
    'students', COALESCE((SELECT jsonb_agg(n) FROM no_activity n), '[]'),
    'trend', COALESCE((SELECT jsonb_agg(t) FROM trend t), '[]')),
  'submissions', jsonb_build_object(
    'onTime', (SELECT count(*) FROM period_work WHERE due_at IS NOT NULL AND submitted_at <= due_at),
    'late', (SELECT count(*) FROM period_work WHERE due_at IS NOT NULL AND submitted_at > due_at),
    'noDeadline', (SELECT count(*) FROM period_work WHERE due_at IS NULL),
    'awaitingGrading', (SELECT count(*) FROM period_work WHERE grade_id IS NULL),
    'submitted', (SELECT count(*) FROM period_work),
    'lateWindow', (SELECT count(*) FROM obligations WHERE CURRENT_TIMESTAMP > due_at AND CURRENT_TIMESTAMP < due_at + interval '24 hours'),
    'missing', (SELECT count(*) FROM obligations WHERE CURRENT_TIMESTAMP >= due_at + interval '24 hours')),
  'progress', COALESCE((SELECT jsonb_agg(p) FROM course_progress p), '[]'),
  'results', COALESCE((SELECT jsonb_agg(r) FROM results r), '[]')
) AS payload`
}
