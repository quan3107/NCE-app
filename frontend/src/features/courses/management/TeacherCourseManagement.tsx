/**
 * Location: features/courses/management/TeacherCourseManagement.tsx
 * Purpose: Compose the teacher course management workspace from modular tabs and dialogs.
 * Why: Keeps the screen orchestrator lean while sharing state via the course management hook.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '@components/common/PageHeader';
import { Button } from '@components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from '@lib/router';

import { AddStudentDialog } from './components/dialogs/AddStudentDialog';
import { AnnouncementDialog } from './components/dialogs/AnnouncementDialog';
import { RubricDialog } from './components/dialogs/RubricDialog';
import { AnnouncementsTab } from './components/tabs/AnnouncementsTab';
import { DeadlinesTab } from './components/tabs/DeadlinesTab';
import { OverviewTab } from './components/tabs/OverviewTab';
import { SettingsTab } from './components/tabs/SettingsTab';
import { StudentsTab } from './components/tabs/StudentsTab';
import {
  getCourseManagementTabsFallback,
  useCourseManagementTabs,
} from './courseTabs.config.api';
import {
  type ResolvedCourseTab,
  isSupportedTabId,
  toResolvedCourseTabs,
  type TabValue,
} from './courseTabs.ui';
import { useTeacherCourseManagement } from './hooks/useTeacherCourseManagement';

export function TeacherCourseManagement({ courseId }: { courseId: string }) {
  const { navigate } = useRouter();
  const [activeTab, setActiveTab] = useState<TabValue | ''>('');
  const unsupportedTabWarningsRef = useRef(new Set<string>());

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

  const tabsQuery = useCourseManagementTabs();

  const configuredTabs = tabsQuery.data ?? getCourseManagementTabsFallback();

  const visibleTabs = useMemo<ResolvedCourseTab[]>(
    () => toResolvedCourseTabs(configuredTabs, unsupportedTabWarningsRef.current),
    [configuredTabs],
  );

  const enabledTabIds = useMemo(() => new Set(visibleTabs.map((tab) => tab.value)), [visibleTabs]);

  useEffect(() => {
    if (visibleTabs.length === 0) {
      if (activeTab !== '') {
        setActiveTab('');
      }
      return;
    }

    if (activeTab && enabledTabIds.has(activeTab)) {
      return;
    }

    setActiveTab(visibleTabs[0].value);
  }, [activeTab, enabledTabIds, visibleTabs]);

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
    completionRate: `${Math.max(0, Math.min(100, Math.round(course.metrics.completionRatePercent)))}%`,
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
        {visibleTabs.length === 0 || !activeTab ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No course management tabs are currently available for this role.
            </p>
          </div>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              if (!isSupportedTabId(value)) {
                return;
              }
              setActiveTab(value);
            }}
          >
            <TabsList className="mb-6 !flex w-full flex-wrap gap-2 md:flex-nowrap">
              {visibleTabs.map(({ value, label, Icon }) => (
                <TabsTrigger key={value} value={value}>
                  <Icon className="mr-2 size-4" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            {enabledTabIds.has('overview') && (
              <TabsContent value="overview">
                <OverviewTab details={details} handlers={detailsHandlers} stats={overviewStats} />
              </TabsContent>
            )}

            {enabledTabIds.has('students') && (
              <TabsContent value="students">
                <StudentsTab
                  enrollment={enrollment}
                  handlers={enrollmentHandlers}
                  onOpenAddStudent={() => dialogs.setShowAddStudent(true)}
                />
              </TabsContent>
            )}

            {enabledTabIds.has('deadlines') && (
              <TabsContent value="deadlines">
                <DeadlinesTab assignments={assignments} onCreateAssignment={handleNavigateToAssignments} />
              </TabsContent>
            )}

            {enabledTabIds.has('announcements') && (
              <TabsContent value="announcements">
                <AnnouncementsTab onCreateAnnouncement={() => dialogs.setShowAnnouncement(true)} />
              </TabsContent>
            )}

            {enabledTabIds.has('settings') && (
              <TabsContent value="settings">
                <SettingsTab
                  rubric={rubric}
                  handlers={rubricHandlers}
                  onEditRubric={() => dialogs.setShowEditRubric(true)}
                />
              </TabsContent>
            )}
          </Tabs>
        )}
      </div>

      <AddStudentDialog
        open={dialogs.showAddStudent}
        onOpenChange={dialogs.setShowAddStudent}
        newStudentEmail={enrollment.newStudentEmail}
        onEmailChange={enrollmentHandlers.setNewStudentEmail}
        isSubmitting={enrollment.isAddingStudent}
        errorMessage={enrollment.addStudentError}
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
