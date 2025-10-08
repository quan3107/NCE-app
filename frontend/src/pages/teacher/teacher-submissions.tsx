import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { PageHeader } from '../../components/page-header';
import { useRouter } from '../../lib/router';
import { mockAssignments, mockSubmissions } from '../../lib/mock-data';
import { formatDate } from '../../lib/utils';

export function TeacherSubmissions() {
  const { navigate } = useRouter();

  const submissions = mockSubmissions.filter(s => s.status === 'submitted' || s.status === 'late');

  return (
    <div>
      <PageHeader title="Submissions Queue" description="Review and grade student submissions" />
      <div className="p-4 sm:p-6 lg:p-8">
        <Card>
          <CardContent className="p-0">
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
                {submissions.map(submission => {
                  const assignment = mockAssignments.find(a => a.id === submission.assignmentId);
                  return (
                    <TableRow key={submission.id} className="cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/teacher/grade/${submission.id}`)}>
                      <TableCell className="font-medium">{submission.studentName}</TableCell>
                      <TableCell>{assignment?.title}</TableCell>
                      <TableCell>{formatDate(new Date(submission.submittedAt!), 'datetime')}</TableCell>
                      <TableCell>
                        <Badge variant={submission.status === 'late' ? 'destructive' : 'secondary'} className="capitalize">
                          {submission.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/teacher/grade/${submission.id}`); }}>
                          Grade
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

