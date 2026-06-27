/**
 * Location: features/rubrics/components/TeacherRubricsPage.tsx
 * Purpose: Render the Teacher Rubrics Page component for the Rubrics domain.
 * Why: Keeps the feature module organized under the new structure.
 */

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { PageHeader } from '@components/common/PageHeader';
import { Plus, Edit } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { toast } from 'sonner@2.0.3';

import { useCoursesQuery } from '@features/courses/api';
import {
  type RubricCriterion,
  type RubricTemplateCriterion,
  useCourseRubricsQuery,
  useCreateRubricMutation,
  useDefaultRubricsQuery,
} from '@features/rubrics/api';

const toRubricCriteriaFromTemplate = (
  criteria: RubricTemplateCriterion[],
): RubricCriterion[] => {
  return criteria.map((criterion) => ({
    criterion: criterion.name,
    weight: criterion.weight,
    levels:
      criterion.levels && criterion.levels.length > 0
        ? criterion.levels.map((level) => ({
            label: level.label,
            points: level.points,
            desc: level.desc ?? '',
          }))
        : [],
  }));
};

type TeacherRubricsPageProps = {
  embedded?: boolean;
  courseId?: string;
};

export function TeacherRubricsPage({ embedded = false, courseId: propCourseId }: TeacherRubricsPageProps = {}) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState(propCourseId || '');
  const [rubricName, setRubricName] = useState('');
  const coursesQuery = useCoursesQuery();

  // Use prop courseId if provided (embedded mode), otherwise use selected
  const effectiveCourseId = propCourseId || selectedCourseId;

  useEffect(() => {
    if (!embedded && !selectedCourseId && coursesQuery.data && coursesQuery.data.length > 0) {
      setSelectedCourseId(coursesQuery.data[0].id);
    }
  }, [coursesQuery.data, selectedCourseId, embedded, propCourseId]);

  // Update selectedCourseId when prop changes
  useEffect(() => {
    if (propCourseId) {
      setSelectedCourseId(propCourseId);
    }
  }, [propCourseId]);

  const rubricsQuery = useCourseRubricsQuery(effectiveCourseId);
  const createRubricMutation = useCreateRubricMutation(effectiveCourseId);
  const defaultRubricsQuery = useDefaultRubricsQuery('assignment', 'writing');

  const courseOptions = useMemo(() => coursesQuery.data ?? [], [coursesQuery.data]);
  const createRubricCriteria = useMemo<RubricCriterion[] | null>(() => {
    const template =
      defaultRubricsQuery.data?.templates.find(
        (item) => item.context === 'assignment' && item.assignmentType === 'writing',
      ) ?? defaultRubricsQuery.data?.templates[0];

    if (!template) {
      return null;
    }

    return toRubricCriteriaFromTemplate(template.criteria);
  }, [defaultRubricsQuery.data?.templates]);

  const handleCreateRubric = async () => {
    if (!selectedCourseId) {
      toast.error('Select a course before creating a rubric.');
      return;
    }

    const trimmedName = rubricName.trim();
    if (!trimmedName) {
      toast.error('Rubric name is required.');
      return;
    }

    if (!createRubricCriteria) {
      toast.error('Unable to create rubric until the backend default template loads.');
      return;
    }

    try {
      await createRubricMutation.mutateAsync({
        name: trimmedName,
        criteria: createRubricCriteria,
      });
      toast.success('Rubric created successfully.');
      setRubricName('');
      setShowCreateDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create rubric.');
    }
  };

  let templateStatusMessage = 'No backend default rubric template is available.';
  if (defaultRubricsQuery.isFetching) {
    templateStatusMessage = 'Loading backend default rubric template...';
  } else if (defaultRubricsQuery.error) {
    templateStatusMessage = `Unable to load backend default rubric template: ${defaultRubricsQuery.error.message}`;
  } else if (createRubricCriteria) {
    const criteriaNames = createRubricCriteria
      .map((criterion) => criterion.criterion)
      .join(', ');
    templateStatusMessage = `Backend template criteria loaded: ${criteriaNames}.`;
  }

  return (
    <div>
      {!embedded && (
        <PageHeader
          title="Rubrics"
          description="Create and manage grading rubrics"
          actions={
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 size-4" />
              Create Rubric
            </Button>
          }
        />
      )}
      <div className={embedded ? '' : 'p-4 sm:p-6 lg:p-8'}>
        <div className="space-y-6">
          {!embedded && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <Label>Course</Label>
                  <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select course" />
                    </SelectTrigger>
                    <SelectContent>
                      {courseOptions.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {embedded && (
            <div className="flex justify-end">
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 size-4" />
                Create Rubric
              </Button>
            </div>
          )}

          {rubricsQuery.isLoading ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Loading rubrics...
              </CardContent>
            </Card>
          ) : rubricsQuery.error ? (
            <Card>
              <CardContent className="py-12 text-center text-destructive">
                Unable to load rubrics.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {(rubricsQuery.data ?? []).map((rubric) => (
                <Card key={rubric.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{rubric.name}</CardTitle>
                      <Button variant="ghost" size="sm">
                        <Edit className="size-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Criteria</TableHead>
                          <TableHead>Weight</TableHead>
                          <TableHead>Levels</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rubric.criteria.map((criterion, index) => (
                          <TableRow key={`${rubric.id}-criterion-${index}`}>
                            <TableCell>{criterion.criterion}</TableCell>
                            <TableCell>{criterion.weight}%</TableCell>
                            <TableCell>
                              {criterion.levels.map((level) => level.label).join(', ')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}

              {(rubricsQuery.data ?? []).length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    No rubrics yet for this course.
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Rubric</DialogTitle>
            <DialogDescription>
              Start from the backend default rubric template and adjust later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Rubric Name</Label>
              <Input
                placeholder="Rubric name"
                value={rubricName}
                onChange={(event) => setRubricName(event.target.value)}
              />
            </div>
            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
              {templateStatusMessage}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateRubric}
              disabled={createRubricMutation.isPending || !createRubricCriteria}
            >
              {createRubricMutation.isPending ? 'Creating...' : 'Create Rubric'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

