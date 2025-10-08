/**
 * Location: features/grades/components/StudentGradesPage.tsx
 * Purpose: Render the Student Grades Page component for the Grades domain.
 * Why: Keeps the feature module organized under the new structure.
 */

import { Card, CardContent } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';
import { Progress } from '@components/ui/progress';
import { PageHeader } from '@components/common/PageHeader';
import { useRouter } from '@lib/router';
import { useAuthStore } from '@store/authStore';
import { Award } from 'lucide-react';
import { formatDate } from '@lib/utils';
import { useAssignmentResources } from '@features/assignments/api';
import { useGradesQuery } from '@features/grades/api';

export function StudentGradesPage() {
  const { currentUser } = useAuthStore();
  const { navigate } = useRouter();
  const { submissions, assignments, isLoading: assignmentsLoading, error: assignmentsError } = useAssignmentResources();
  const gradesQuery = useGradesQuery();

  if (!currentUser) return null;

  const isLoading = assignmentsLoading || gradesQuery.isLoading;
  const error = assignmentsError ?? gradesQuery.error;

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Grades" description="View your grades and feedback" />
        <div className="p-4 sm:p-6 lg:p-8">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading grades...
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Grades" description="View your grades and feedback" />
        <div className="p-4 sm:p-6 lg:p-8">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-destructive font-medium">Unable to load grades.</p>
              <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const grades = gradesQuery.data ?? [];
  const studentSubmissions = submissions.filter(s => s.studentId === currentUser.id);
  const gradedSubmissions = studentSubmissions.filter(s => s.status === 'graded');

  return (
    <div>
      <PageHeader title="Grades" description="View your grades and feedback" />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {gradedSubmissions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Award className="size-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="mb-2">No Grades Yet</h3>
              <p className="text-muted-foreground mb-4">Complete and submit assignments to receive grades</p>
              <Button onClick={() => navigate('/student/assignments')}>View Assignments</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {gradedSubmissions.map(submission => {
              const grade = grades.find(g => g.submissionId === submission.id);
              const assignment = assignments.find(a => a.id === submission.assignmentId);
              if (!grade || !assignment) return null;

              const percentage = (grade.finalScore / grade.maxScore) * 100;

              return (
                <Card key={submission.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="mb-1">{assignment.title}</h3>
                          <p className="text-sm text-muted-foreground">{assignment.courseName}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-medium">
                            {grade.finalScore}/{grade.maxScore}
                          </div>
                          <div className="text-sm text-muted-foreground">{percentage.toFixed(0)}%</div>
                        </div>
                      </div>

                      {/* Rubric Breakdown */}
                      <div className="space-y-2">
                        <Label>Rubric Breakdown</Label>
                        {grade.rubricBreakdown.map((item, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <div className="flex-1">
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span>{item.criteria}</span>
                                <span className="font-medium">
                                  {item.points}/{item.maxPoints}
                                </span>
                              </div>
                              <Progress value={(item.points / item.maxPoints) * 100} className="h-1.5" />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Feedback */}
                      {grade.feedback && (
                        <div className="space-y-2">
                          <Label>Teacher Feedback</Label>
                          <div className="p-6 bg-gradient-to-br from-muted/30 to-muted/60 rounded-xl border border-border/50 space-y-4">
                            {(() => {
                              const lines = grade.feedback.split('\n');
                              const elements: React.ReactNode[] = [];
                              let listItems: string[] = [];
                              
                              const flushListItems = () => {
                                if (listItems.length > 0) {
                                  elements.push(
                                    <ul key={`list-${elements.length}`} className="space-y-2 ml-4">
                                      {listItems.map((item, idx) => (
                                        <li key={idx} className="flex items-start gap-3">
                                          <div className="size-1.5 rounded-full bg-primary/70 mt-2 flex-shrink-0" />
                                          <span className="text-sm text-foreground/90 leading-relaxed">{item}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  );
                                  listItems = [];
                                }
                              };
                              
                              lines.forEach((line, i) => {
                                const trimmedLine = line.trim();
                                
                                if (trimmedLine.startsWith('# ')) {
                                  flushListItems();
                                  const title = trimmedLine.replace('# ', '');
                                  elements.push(
                                    <div key={i} className="pt-2 first:pt-0">
                                      <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                                        <Award className="size-5 text-primary" />
                                        {title}
                                      </h3>
                                    </div>
                                  );
                                } else if (trimmedLine.startsWith('## ')) {
                                  flushListItems();
                                  const subtitle = trimmedLine.replace('## ', '');
                                  elements.push(
                                    <div key={i} className="pt-3">
                                      <h4 className="text-base font-medium text-foreground/90 mb-2 pl-3 border-l-2 border-primary/40">
                                        {subtitle}
                                      </h4>
                                    </div>
                                  );
                                } else if (trimmedLine.startsWith('- ')) {
                                  listItems.push(trimmedLine.replace('- ', ''));
                                } else if (trimmedLine) {
                                  flushListItems();
                                  elements.push(
                                    <p key={i} className="text-sm text-foreground/80 leading-relaxed">
                                      {trimmedLine}
                                    </p>
                                  );
                                }
                              });
                              
                              flushListItems();
                              return elements;
                            })()}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
                        <span>Graded by {grade.gradedBy}</span>
                        <span>{formatDate(grade.gradedAt, 'datetime')}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}










