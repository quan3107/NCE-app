/** Admin report presentation: accessible tables accompany daily participation bars and current-state totals. */
import type { ReactNode } from 'react';
import { Card, CardContent } from '@components/ui/card';
import type { AdminAnalytics } from '../admin-api';

const number = (value: number | null) =>
  value === null ? 'Unavailable' : value.toLocaleString();
const ratio = (done: number, total: number) =>
  total
    ? `${done} / ${total} (${((100 * done) / total).toFixed(1)}%)`
    : 'Unavailable — no eligible opportunities';
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <h2 className="text-lg font-semibold">{title}</h2>
        {children}
      </CardContent>
    </Card>
  );
}
function Metrics({ values }: { values: [string, number | null][] }) {
  return (
    <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {values.map(([label, value]) => (
        <div key={label} className="rounded-lg border p-4">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="mt-2 text-2xl font-semibold">{number(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
const cell = 'p-3 text-left align-top border-b';
export function AdminAnalyticsReport({ data: d }: { data: AdminAnalytics }) {
  const e = d.engagement;
  const max = Math.max(1, ...e.trend.map((t) => t.learners ?? 0));
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Displayed period: {d.filters.from} through {d.filters.to} (UTC). Updated{' '}
        {new Date(d.generatedAt).toISOString()}.
      </p>
      <Section title="Overview · current state">
        <Metrics
          values={[
            ['Students', d.overview.students],
            ['Teachers', d.overview.teachers],
            ['Courses', d.overview.courses],
            ['Published courses', d.overview.publishedCourses],
            ['Enrollments · all roles', d.overview.enrollments],
            ['Eligible active-account learners', d.overview.eligibleLearners],
          ]}
        />
        <p className="text-sm text-muted-foreground">
          Counts exclude deleted records. Student and teacher totals include
          invited and suspended accounts. Course publication status is
          unavailable because courses have no publication flag. Engagement and
          progress include only active student accounts currently enrolled as
          students in the selected courses.
        </p>
      </Section>
      <Section title="Engagement · selected period">
        <p>
          Active learners perform at least one learning action: opening a lesson
          or assignment, saving or submitting work, completing a lesson, or
          viewing grades or feedback. Each student counts once per period and
          once per daily bucket. This measures participation, not mastery.
        </p>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          Tracking began:{' '}
          {e.trackingSince
            ? new Date(e.trackingSince).toISOString()
            : 'Unavailable — no participation recorded yet'}
          .{' '}
          {e.completeCoverage
            ? 'Selected dates follow the tracking start. Counts reflect recorded actions; today is still in progress.'
            : 'Historical coverage is incomplete. Active counts are observed minimums. No recorded activity does not prove inactivity; earlier days are unavailable.'}
        </div>
        <Metrics
          values={[
            ['Observed active learners', e.observedActive],
            [
              e.completeCoverage
                ? 'Students with no recorded activity in period'
                : 'Students with no observed activity · history incomplete',
              e.noObservedActivity,
            ],
          ]}
        />
        <div
          className="flex h-32 items-end gap-1 overflow-hidden"
          role="img"
          aria-label="Daily unique active learners; exact values and coverage in the table below"
        >
          {e.trend.map((t) => (
            <div
              key={t.day}
              title={`${t.day}: ${number(t.learners)}`}
              className={
                t.learners === null ? 'flex-1 bg-muted' : 'flex-1 bg-primary'
              }
              style={{
                height:
                  t.learners === null
                    ? '100%'
                    : `${Math.max(2, (100 * t.learners) / max)}%`,
              }}
            />
          ))}
        </div>
        <details>
          <summary className="cursor-pointer">
            Daily counts and coverage
          </summary>
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={cell}>UTC day</th>
                  <th className={cell}>Unique learners</th>
                  <th className={cell}>Coverage</th>
                </tr>
              </thead>
              <tbody>
                {e.trend.map((t) => (
                  <tr key={t.day}>
                    <td className={cell}>{t.day}</td>
                    <td className={cell}>{number(t.learners)}</td>
                    <td className={cell}>{t.coverage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <details>
          <summary className="cursor-pointer">
            Students with no observed activity ({e.noObservedActivity})
          </summary>
          <p className="my-2 text-sm">
            {e.studentsTruncated
              ? 'First 100 students shown and exported; narrow the course filter for more.'
              : 'All matching students shown and exported.'}
          </p>
          {e.students.length ? (
            <ul className="list-disc pl-5">
              {e.students.map((s) => (
                <li key={s.id}>{s.name}</li>
              ))}
            </ul>
          ) : (
            <p>No matching students.</p>
          )}
        </details>
      </Section>
      <Section title="Progress · current state">
        <p className="text-sm text-muted-foreground">
          Lesson completion uses explicit NCE completion, divided by available
          published lessons × eligible enrolled learners. Course progress
          follows existing semantics: current non-draft submissions / published
          assignments × eligible learners. These are current totals, independent
          of the date filter; they do not measure mastery.
        </p>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={cell}>Course</th>
                <th className={cell}>Learners</th>
                <th className={cell}>Lesson completion</th>
                <th className={cell}>Course assignment progress</th>
              </tr>
            </thead>
            <tbody>
              {d.progress.map((p) => (
                <tr key={p.courseId}>
                  <td className={cell}>{p.courseTitle}</td>
                  <td className={cell}>{p.learners}</td>
                  <td className={cell}>
                    {ratio(p.completedLessons, p.lessonOpportunities)}
                  </td>
                  <td className={cell}>
                    {ratio(p.submittedAssignments, p.assignmentOpportunities)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!d.progress.length && <p>No courses in this scope.</p>}
      </Section>
      <Section title="Submissions · selected period">
        <Metrics
          values={[
            ['Submitted current versions', d.submissions.submitted],
            ['On time', d.submissions.onTime],
            ['Late · no score penalty', d.submissions.late],
            ['No deadline', d.submissions.noDeadline],
            ['Awaiting grading', d.submissions.awaitingGrading],
            ['Unsubmitted · 24-hour late window', d.submissions.lateWindow],
            ['Missing · cutoff passed', d.submissions.missing],
          ]}
        />
        <p className="text-sm text-muted-foreground">
          Submitted and awaiting-grading counts use the current version's
          submission date; archived replacements are excluded. Unsubmitted
          counts use deadlines in the selected period and enrollment by the
          deadline. Exactly at the deadline is on time; cutoff is deadline + 24
          elapsed hours. Awaiting grading is a subset of submitted work.
        </p>
      </Section>
      <Section title="Results · current grades for submissions in period">
        <p className="text-sm text-muted-foreground">
          IELTS bands remain separate by assignment and skill. Other scores are
          percentages of the configured assignment maximum (default 100).
          Samples count only available current scores; missing grades never
          become zero.
        </p>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {[
                  'Course / assignment',
                  'Skill / type',
                  'Scale',
                  'Average',
                  'Scored samples',
                ].map((s) => (
                  <th key={s} className={cell}>
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.results.map((r) => (
                <tr key={r.assignmentId}>
                  <td className={cell}>
                    {r.courseTitle}
                    <br />
                    {r.assignmentTitle}
                  </td>
                  <td className={cell}>{r.skill}</td>
                  <td className={cell}>{r.scale}</td>
                  <td className={cell}>{number(r.average)}</td>
                  <td className={cell}>{r.samples}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!d.results.length && <p>No graded submissions in this period.</p>}
      </Section>
    </div>
  );
}
