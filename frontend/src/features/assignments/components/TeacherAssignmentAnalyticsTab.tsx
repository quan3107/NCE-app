/**
 * Location: features/assignments/components/TeacherAssignmentAnalyticsTab.tsx
 * Purpose: Render the analytics tab for the teacher assignment detail view.
 * Why: Mirrors the Figma Make analytics layout without adding new dependencies.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Alert, AlertDescription } from '@components/ui/alert';
import { BarChart3, AlertCircle } from 'lucide-react';
import type { TeacherAssignmentStatsSummary } from './TeacherAssignmentDetailTabs';

type TeacherAssignmentAnalyticsTabProps = {
  statsSummary: TeacherAssignmentStatsSummary;
};

export function TeacherAssignmentAnalyticsTab({
  statsSummary,
}: TeacherAssignmentAnalyticsTabProps) {
  const {
    totalStudents,
    submittedCount,
    gradedCount,
    submissionRate,
    onTimeRate,
  } = statsSummary;

  return (
    <>
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="rounded-[14px]">
          <CardHeader>
            <CardTitle className="text-base">Submission Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">{submissionRate}%</div>
              <p className="text-sm text-muted-foreground">
                {submittedCount} of {totalStudents} students
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[14px]">
          <CardHeader>
            <CardTitle className="text-base">Average Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">{gradedCount > 0 ? 'N/A' : '-'}</div>
              <p className="text-sm text-muted-foreground">
                {gradedCount > 0 ? `Based on ${gradedCount} graded` : 'No graded submissions'}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[14px]">
          <CardHeader>
            <CardTitle className="text-base">On-Time Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">
                {submittedCount > 0 ? `${onTimeRate}%` : '-'}
              </div>
              <p className="text-sm text-muted-foreground">Submitted before deadline</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[14px]">
        <CardHeader>
          <CardTitle>Score Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <BarChart3 className="size-12 mx-auto mb-2" />
              <p>Score distribution chart</p>
              <p className="text-sm">Available after grading begins</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {gradedCount === 0 && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>
            Analytics will be available once submissions are graded.
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
