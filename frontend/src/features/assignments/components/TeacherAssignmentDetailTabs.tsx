/**
 * Location: features/assignments/components/TeacherAssignmentDetailTabs.tsx
 * Purpose: Render the tabbed layout for the teacher assignment detail view.
 * Why: Keeps the main page component focused on data loading and header actions.
 */

import type { ReactNode } from 'react';
import type { Assignment, Submission } from '@domain';
import type { IeltsAssignmentConfig, IeltsAssignmentType } from '@lib/ielts';
import { Badge } from '@components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { TeacherAssignmentContentTab } from './TeacherAssignmentContentTab';
import { TeacherAssignmentOverviewTab } from './TeacherAssignmentOverviewTab';
import { TeacherAssignmentSubmissionsTab } from './TeacherAssignmentSubmissionsTab';
import { TeacherAssignmentAnalyticsTab } from './TeacherAssignmentAnalyticsTab';

export type TeacherAssignmentStatCard = {
  label: string;
  value: number;
  icon: ReactNode;
};

export type TeacherAssignmentStatsSummary = {
  totalStudents: number;
  submittedCount: number;
  pendingCount: number;
  gradedCount: number;
  submissionRate: number;
  onTimeRate: number;
};

type TeacherAssignmentDetailTabsProps = {
  assignment: Assignment;
  courseTitle: string;
  submissions: Submission[];
  statsCards: TeacherAssignmentStatCard[];
  statsSummary: TeacherAssignmentStatsSummary;
  ieltsConfig: IeltsAssignmentConfig | null;
  isEditing?: boolean;
  onDraftConfigChange?: (updated: IeltsAssignmentConfig) => void;
  onAssignmentChange?: (updates: Partial<Assignment>) => void;
  rubrics?: { id: string; name: string }[];
  courseId?: string;
  onManageRubrics?: () => void;
};

export function TeacherAssignmentDetailTabs({
  assignment,
  courseTitle,
  submissions,
  statsCards,
  statsSummary,
  ieltsConfig,
  isEditing = false,
  onDraftConfigChange,
  onAssignmentChange,
  rubrics = [],
  courseId,
  onManageRubrics,
}: TeacherAssignmentDetailTabsProps) {
  return (
    <Tabs defaultValue="content">
      <TabsList className="grid w-full grid-cols-4 mb-6">
        <TabsTrigger value="content">Assignment Content</TabsTrigger>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="submissions">
          Submissions
          {statsSummary.pendingCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              {statsSummary.pendingCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
      </TabsList>

      <TabsContent value="content" className="space-y-6">
        <TeacherAssignmentContentTab
          assignment={assignment}
          ieltsConfig={ieltsConfig}
          isEditing={isEditing}
          onDraftConfigChange={onDraftConfigChange}
          rubrics={rubrics}
          courseId={courseId}
          onManageRubrics={onManageRubrics}
        />
      </TabsContent>

      <TabsContent value="overview" className="space-y-6">
        <TeacherAssignmentOverviewTab
          assignment={assignment}
          courseTitle={courseTitle}
          statsCards={statsCards}
          isEditing={isEditing}
          onAssignmentChange={onAssignmentChange}
        />
      </TabsContent>

      <TabsContent value="submissions" className="space-y-6">
        <TeacherAssignmentSubmissionsTab submissions={submissions} />
      </TabsContent>

      <TabsContent value="analytics" className="space-y-6">
        <TeacherAssignmentAnalyticsTab statsSummary={statsSummary} />
      </TabsContent>
    </Tabs>
  );
}
