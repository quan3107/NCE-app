/**
 * Location: features/courses/management/TeacherCourseManagement.tsx
 * Purpose: Compose the teacher course management workspace from modular tabs and dialogs.
 * Why: Keeps the screen orchestrator lean while sharing state via the course management hook.
 */

import { useState } from 'react';
import { PageHeader } from '@components/common/PageHeader';
import { Button } from '@components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { ArrowLeft, BookOpen, Clock, Megaphone, Settings, Users } from 'lucide-react';
import { useRouter } from '@lib/router';

import { AddStudentDialog } from './components/dialogs/AddStudentDialog';
import { AnnouncementDialog } from './components/dialogs/AnnouncementDialog';
import { AnnouncementsTab } from './components/tabs/AnnouncementsTab';
import { DeadlinesTab } from './components/tabs/DeadlinesTab';
import { OverviewTab } from './components/tabs/OverviewTab';
import { SettingsTab } from './components/tabs/SettingsTab';
import { StudentsTab } from './components/tabs/StudentsTab';
import { useTeacherCourseManagement } from './hooks/useTeacherCourseManagement';
import { RubricDialog } from './components/dialogs/RubricDialog';

const tabConfig = [
  { value: 'overview', label: 'Overview', icon: BookOpen },
  { value: 'students', label: 'Students', icon: Users },
  { value: 'deadlines', label: 'Deadlines', icon: Clock },
  { value: 'announcements', label: 'Announcements', icon: Megaphone },
  { value: 'settings', label: 'Settings', icon: Settings },
] as const;

type TabValue = (typeof tabConfig)[number]['value'];

export function TeacherCourseManagement({ courseId }: { courseId: string }) {
  const { navigate } = useRouter();
  const [activeTab, setActiveTab] = useState<TabValue>('overview');

  const {
    course,
    isLoading,
    error,
    reload,
    details,
    detailsHandlers,
    enrollment,
    enrollmentHandlers,
    assignments,
    announcements,
    announcementHandlers,
    rubric,
    rubricHandlers,
    dialogs,
  } = useTeacherCourseManagement(courseId);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading course data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-4 text-center">
          <p className="text-destructive">Unable to load course data.</p>
          <p className="text-muted-foreground text-sm">{error}</p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => navigate('/teacher/courses')}>
              <ArrowLeft className="mr-2 size-4" />
              Back to Courses
            </Button>
            <Button onClick={reload}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Course not found</p>
          <Button onClick={() => navigate('/teacher/courses')}>
            <ArrowLeft className="mr-2 size-4" />
            Back to Courses
          </Button>
        </div>
      </div>
    );
  }

  const overviewStats = {
    students: enrollment.students.length,
    assignments: assignments.length,
    completionRate: '78%',
  };

  const handleNavigateToAssignments = () => navigate('/teacher/assignments');

  return (
    <div>
      <PageHeader
        title={course.title}
        description="Manage all aspects of this course"
        actions={
          <Button variant="outline" onClick={() => navigate('/teacher/courses')}>
            <ArrowLeft className="mr-2 size-4" />
            Back to Courses
          </Button>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabValue)}>
          <TabsList className="mb-6 !flex w-full flex-wrap gap-2 md:flex-nowrap">
            {tabConfig.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value}>
                <Icon className="mr-2 size-4" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab details={details} handlers={detailsHandlers} stats={overviewStats} />
          </TabsContent>

          <TabsContent value="students">
            <StudentsTab
              enrollment={enrollment}
              handlers={enrollmentHandlers}
              onOpenAddStudent={() => dialogs.setShowAddStudent(true)}
            />
          </TabsContent>

          <TabsContent value="deadlines">
            <DeadlinesTab assignments={assignments} onCreateAssignment={handleNavigateToAssignments} />
          </TabsContent>

          <TabsContent value="announcements">
            <AnnouncementsTab onCreateAnnouncement={() => dialogs.setShowAnnouncement(true)} />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsTab
              rubric={rubric}
              handlers={rubricHandlers}
              onEditRubric={() => dialogs.setShowEditRubric(true)}
            />
          </TabsContent>
        </Tabs>
      </div>

      <AddStudentDialog
        open={dialogs.showAddStudent}
        onOpenChange={dialogs.setShowAddStudent}
        newStudentEmail={enrollment.newStudentEmail}
        onEmailChange={enrollmentHandlers.setNewStudentEmail}
        onSubmit={enrollmentHandlers.addStudent}
      />

      <AnnouncementDialog
        open={dialogs.showAnnouncement}
        onOpenChange={dialogs.setShowAnnouncement}
        title={announcements.title}
        message={announcements.message}
        sendEmail={announcements.sendEmail}
        onTitleChange={announcementHandlers.setTitle}
        onMessageChange={announcementHandlers.setMessage}
        onSendEmailChange={announcementHandlers.setSendEmail}
        onSubmit={announcementHandlers.create}
      />

      <RubricDialog
        open={dialogs.showEditRubric}
        onOpenChange={dialogs.setShowEditRubric}
        rubric={rubric}
        handlers={rubricHandlers}
      />
    </div>
  );
}
