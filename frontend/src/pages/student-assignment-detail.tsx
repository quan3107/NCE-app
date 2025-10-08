import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { PageHeader } from '../components/page-header';
import { useAuth } from '../lib/auth-context';
import { useRouter } from '../lib/router';
import { mockAssignments, mockSubmissions } from '../lib/mock-data';
import { Clock, FileText, Upload, Link as LinkIcon, Type, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { formatDate } from '../lib/utils';
import { toast } from 'sonner@2.0.3';

export function StudentAssignmentDetail({ assignmentId }: { assignmentId: string }) {
  const { currentUser } = useAuth();
  const { navigate } = useRouter();
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submissionContent, setSubmissionContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const assignment = mockAssignments.find(a => a.id === assignmentId);
  const submission = mockSubmissions.find(
    s => s.assignmentId === assignmentId && s.studentId === currentUser?.id
  );

  if (!assignment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Assignment not found</p>
          <Button onClick={() => navigate('/student/assignments')}>Back to Assignments</Button>
        </div>
      </div>
    );
  }

  const dueDate = new Date(assignment.dueAt);
  const now = new Date();
  const isOverdue = dueDate < now && !submission;
  const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  const isDueSoon = hoursUntilDue <= 48 && hoursUntilDue > 0;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Simulate submission
    setTimeout(() => {
      setIsSubmitting(false);
      setShowSubmitDialog(false);
      toast.success('Assignment submitted successfully!');
      navigate('/student/assignments');
    }, 1500);
  };

  const getTypeIcon = () => {
    switch (assignment.type) {
      case 'file':
        return <Upload className="size-5" />;
      case 'link':
        return <LinkIcon className="size-5" />;
      case 'text':
        return <Type className="size-5" />;
      default:
        return <FileText className="size-5" />;
    }
  };

  return (
    <div>
      <PageHeader
        title={assignment.title}
        description={assignment.courseName}
        showBack
        breadcrumbs={[
          { label: 'Assignments', path: '/student/assignments' },
          { label: assignment.title },
        ]}
        actions={
          !submission ? (
            <Button onClick={() => setShowSubmitDialog(true)} disabled={isOverdue}>
              {isOverdue ? 'Past Due' : 'Submit Assignment'}
            </Button>
          ) : (
            <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-200">
              <CheckCircle2 className="size-4 mr-2" />
              {submission.status === 'graded' ? 'Graded' : 'Submitted'}
            </Badge>
          )
        }
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Status Alert */}
          {isOverdue && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>
                This assignment was due on {formatDate(dueDate, 'datetime')}. {assignment.latePolicy}
              </AlertDescription>
            </Alert>
          )}

          {isDueSoon && !submission && (
            <Alert>
              <Clock className="size-4" />
              <AlertDescription>
                This assignment is due soon: {formatDate(dueDate, 'datetime')}
              </AlertDescription>
            </Alert>
          )}

          {submission && (
            <Alert className="bg-green-500/10 border-green-200">
              <CheckCircle2 className="size-4 text-green-700" />
              <AlertDescription className="text-green-700">
                Submitted on {formatDate(new Date(submission.submittedAt!), 'datetime')}
                {submission.version > 1 && ` (Version ${submission.version})`}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Assignment Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Assignment Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    {assignment.description.split('\n').map((line, i) => {
                      if (line.startsWith('# ')) {
                        return <h2 key={i}>{line.replace('# ', '')}</h2>;
                      } else if (line.startsWith('## ')) {
                        return <h3 key={i}>{line.replace('## ', '')}</h3>;
                      } else if (line.startsWith('- ')) {
                        return <li key={i}>{line.replace('- ', '')}</li>;
                      } else if (line) {
                        return <p key={i}>{line}</p>;
                      }
                      return null;
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Submission History */}
              {submission && (
                <Card>
                  <CardHeader>
                    <CardTitle>Your Submission</CardTitle>
                    <CardDescription>Submitted work and history</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      {submission.content && (
                        <div>
                          <Label>Content</Label>
                          <p className="mt-2 text-sm">{submission.content}</p>
                        </div>
                      )}
                      {submission.files && submission.files.length > 0 && (
                        <div>
                          <Label>Files</Label>
                          <div className="mt-2 space-y-2">
                            {submission.files.map((file, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm">
                                <FileText className="size-4 text-muted-foreground" />
                                <span>{file}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Info className="size-4" />
                      <span>
                        Submitted {formatDate(new Date(submission.submittedAt!), 'datetime')} · Version {submission.version}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Assignment Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Type</Label>
                    <div className="flex items-center gap-2 mt-2">
                      {getTypeIcon()}
                      <span className="capitalize">{assignment.type}</span>
                    </div>
                  </div>
                  <div>
                    <Label>Due Date</Label>
                    <div className="mt-2">
                      <p className={isOverdue ? 'text-red-600 font-medium' : ''}>
                        {formatDate(dueDate, 'datetime')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">UTC+07:00 (Bangkok)</p>
                    </div>
                  </div>
                  <div>
                    <Label>Late Policy</Label>
                    <p className="text-sm mt-2 text-muted-foreground">{assignment.latePolicy}</p>
                  </div>
                  <div>
                    <Label>Max Score</Label>
                    <p className="text-sm mt-2">{assignment.maxScore} points</p>
                  </div>
                </CardContent>
              </Card>

              {/* Course Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Course</CardTitle>
                </CardHeader>
                <CardContent>
                  <h4 className="mb-1">{assignment.courseName}</h4>
                  <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => navigate('/student/assignments')}>
                    View All Assignments
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Submit Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Assignment</DialogTitle>
            <DialogDescription>
              Submit your work for {assignment.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {assignment.type === 'file' && (
              <div className="space-y-2">
                <Label>Upload File</Label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-accent/50 cursor-pointer transition-colors">
                  <Upload className="size-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX (max 10MB)</p>
                </div>
              </div>
            )}

            {assignment.type === 'link' && (
              <div className="space-y-2">
                <Label htmlFor="link">Submission Link</Label>
                <Input
                  id="link"
                  placeholder="https://..."
                  value={submissionContent}
                  onChange={(e) => setSubmissionContent(e.target.value)}
                />
              </div>
            )}

            {assignment.type === 'text' && (
              <div className="space-y-2">
                <Label htmlFor="text">Your Response</Label>
                <Textarea
                  id="text"
                  placeholder="Type your response here..."
                  rows={8}
                  value={submissionContent}
                  onChange={(e) => setSubmissionContent(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
