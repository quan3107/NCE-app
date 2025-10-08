/**
 * Location: features/assignments/components/TeacherSubmissionsPage.tsx
 * Purpose: Render the Teacher Submissions Page component for the Assignments domain.
 * Why: Keeps the feature module organized under the new structure.
 */

import { Card, CardContent } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@components/ui/table';
import { PageHeader } from '@components/common/PageHeader';
import { useRouter } from '@lib/router';
import { formatDate } from '@lib/utils';
import { useAssignmentResources } from '@features/assignments/api';

export function TeacherSubmissionsPage() {
  const { navigate } = useRouter();
  const { submissions, assignments, isLoading, error } = useAssignmentResources();

  const reviewSubmissions = submissions.filter(
    submission => submission.status === 'submitted' || submission.status === 'late',
  );

  return (
    <div>
      <PageHeader title="Submissions Queue" description="Review and grade student submissions" />
      <div className="p-4 sm:p-6 lg:p-8">
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground">Loading submissions...</div>
            ) : error ? (
              <div className="py-12 text-center">
                <p className="text-destructive font-medium">Unable to load submissions.</p>
                <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Assignment</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviewSubmissions.map(submission => {
                    const assignment = assignments.find(a => a.id === submission.assignmentId);
                    return (
                      <TableRow
                        key={submission.id}
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => navigate(`/teacher/grade/${submission.id}`)}
                      >
                        <TableCell className="font-medium">{submission.studentName}</TableCell>
                        <TableCell>{assignment?.title}</TableCell>
                        <TableCell>{formatDate(new Date(submission.submittedAt!), 'datetime')}</TableCell>
                        <TableCell>
                          <Badge
                            variant={submission.status === 'late' ? 'destructive' : 'secondary'}
                            className="capitalize"
                          >
                            {submission.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={event => {
                              event.stopPropagation();
                              navigate(`/teacher/grade/${submission.id}`);
                            }}
                          >
                            Grade
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}









