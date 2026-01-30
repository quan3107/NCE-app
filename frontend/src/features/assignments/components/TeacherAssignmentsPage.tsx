/**
 * Location: features/assignments/components/TeacherAssignmentsPage.tsx
 * Purpose: Render the Teacher Assignments Page component for the Assignments domain.
 * Why: Keeps the feature module organized under the new structure.
 */

import { Card, CardContent } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import { PageHeader } from '@components/common/PageHeader';
import { useRouter } from '@lib/router';
import { formatDate } from '@lib/utils';
import { Plus, Clock, FileText, Edit } from 'lucide-react';
import { useAssignmentResources } from '@features/assignments/api';

export function TeacherAssignmentsPage() {
  const { navigate } = useRouter();
  const { assignments, submissions, isLoading, error } = useAssignmentResources();

  const renderBody = () => {
    if (isLoading) {
      return (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading assignments...
          </CardContent>
        </Card>
      );
    }

    if (error) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive font-medium">Unable to load assignments.</p>
            <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-3">
        {assignments.map(assignment => (
          <Card
            key={assignment.id}
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate(`/teacher/assignments/${assignment.id}/detail`)}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3>{assignment.title}</h3>
                    <Badge variant={assignment.status === 'published' ? 'default' : 'secondary'} className="capitalize">
                      {assignment.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{assignment.courseName}</p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 text-muted-foreground" />
                      <span>Due: {formatDate(assignment.dueAt, 'datetime')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-muted-foreground" />
                      <span>{submissions.filter(s => s.assignmentId === assignment.id).length} submissions</span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate(`/teacher/assignments/${assignment.id}/edit`);
                  }}
                >
                  <Edit className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Assignments"
        description="Manage assignments across all courses"
        actions={
          <Button onClick={() => navigate('/teacher/assignments/create')}>
            <Plus className="mr-2 size-4" />
            Create Assignment
          </Button>
        }
      />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {renderBody()}
      </div>
    </div>
  );
}

