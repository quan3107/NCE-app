/**
 * Location: features/courses/management/components/tabs/DeadlinesTab.tsx
 * Purpose: Render assignment deadline cards within the teacher course management tabs.
 * Why: Keeps deadline-specific UI isolated from the container component.
 */

import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { formatDate } from '@lib/utils';
import { Calendar, Clock, Edit, Plus } from 'lucide-react';

import type { Assignment } from '@types/domain';

type DeadlinesTabProps = {
  assignments: Assignment[];
  onCreateAssignment: () => void;
};

export function DeadlinesTab({ assignments, onCreateAssignment }: DeadlinesTabProps) {
  const hasAssignments = assignments.length > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Assignment Deadlines</CardTitle>
              <CardDescription>Manage assignment due dates and extensions</CardDescription>
            </div>
            <Button onClick={onCreateAssignment}>
              <Plus className="mr-2 size-4" />
              Create Assignment
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {hasAssignments ? (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <Card key={assignment.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="mb-1">{assignment.title}</h4>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="size-4" />
                            <span>Due: {formatDate(assignment.dueAt, 'datetime')}</span>
                          </div>
                          <Badge variant={assignment.status === 'published' ? 'default' : 'secondary'}>
                            {assignment.status}
                          </Badge>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Edit className="size-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Clock className="size-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">No assignments created yet</p>
              <Button onClick={onCreateAssignment}>Create First Assignment</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
