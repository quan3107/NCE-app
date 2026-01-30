/**
 * Location: features/assignments/components/TeacherAssignmentSubmissionsTab.tsx
 * Purpose: Render the submissions table for the teacher assignment detail view.
 * Why: Keeps grading actions and table markup isolated from the main detail page.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@components/ui/table';
import { useRouter } from '@lib/router';
import { formatDistanceToNow } from '@lib/utils';
import type { Submission } from '@lib/mock-data';
import { Eye, FileText } from 'lucide-react';

type TeacherAssignmentSubmissionsTabProps = {
  submissions: Submission[];
};

export function TeacherAssignmentSubmissionsTab({
  submissions,
}: TeacherAssignmentSubmissionsTabProps) {
  const { navigate } = useRouter();

  if (submissions.length === 0) {
    return (
      <Card className="rounded-[14px]">
        <CardContent className="py-12 text-center">
          <FileText className="size-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="mb-2">No Submissions Yet</h3>
          <p className="text-muted-foreground">
            Students haven&apos;t submitted any work for this assignment.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-[14px]">
      <CardHeader>
        <CardTitle>Student Submissions</CardTitle>
        <CardDescription>Grade and review incoming work</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Score</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {submissions.map(submission => (
              <TableRow key={submission.id}>
                <TableCell className="font-medium">{submission.studentName}</TableCell>
                <TableCell>
                  {submission.submittedAt
                    ? formatDistanceToNow(new Date(submission.submittedAt), { addSuffix: true })
                    : 'Not submitted'}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      submission.status === 'graded'
                        ? 'default'
                        : submission.status === 'late'
                          ? 'destructive'
                          : submission.status === 'submitted'
                            ? 'secondary'
                            : 'outline'
                    }
                    className="capitalize"
                  >
                    {submission.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell>-</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/teacher/grade/${submission.id}`)}
                    >
                      <Eye className="size-4" />
                    </Button>
                    {submission.status !== 'graded' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/teacher/grade/${submission.id}`)}
                      >
                        Grade
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
