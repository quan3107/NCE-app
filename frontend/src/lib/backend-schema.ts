/**
 * Location: src/lib/backend-schema.ts
 * Purpose: Provide frontend-local mirrors of backend API contracts.
 * Why: Keeps frontend typecheck independent from backend runtime dependencies.
 */

export type UserRole = 'admin' | 'teacher' | 'student';
export type UserStatus = 'active' | 'pending' | 'invited' | 'suspended';
export type EnrollmentRole = 'teacher' | 'student';
export type AssignmentType =
  | 'file'
  | 'link'
  | 'text'
  | 'quiz'
  | 'reading'
  | 'listening'
  | 'writing'
  | 'speaking';
export type SubmissionStatus = 'draft' | 'submitted' | 'late' | 'graded';
export type NotificationChannel = 'inapp' | 'email' | 'push' | 'sms';
export type NotificationStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'read'
  | 'suppressed'
  | 'dead_letter'
  | 'delivery_unknown';

export type DashboardRole = UserRole;

type DashboardWidgetPosition = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type DashboardWidgetDefault = {
  id: string;
  type: string;
  label: string;
  icon_name: string;
  color: string;
  data_source: string;
  value_format: string;
  default_order: number;
  default_visible: boolean;
  position: DashboardWidgetPosition;
};

export type DashboardWidgetDefaultsResponse = {
  role: DashboardRole;
  version: string;
  widgets: DashboardWidgetDefault[];
};

export type CmsStatFormat = 'number' | 'decimal' | 'percentage';

export type CmsStatItem = {
  label: string;
  value: number;
  format: CmsStatFormat;
  suffix?: string;
};

export type CmsHeroContent = {
  badge: string;
  title: string;
  description: string;
  cta_primary: string;
  cta_secondary: string;
};

export type CmsFeatureItem = {
  icon: string;
  title: string;
  description: string;
};

export type CmsHowItWorksContent = {
  title: string;
  description: string;
  features: CmsFeatureItem[];
};

export type CmsAboutHeroContent = {
  title: string;
  description: string;
};

export type CmsValueItem = {
  icon: string;
  title: string;
  description: string;
};

export type CmsHomepageContent = {
  hero: CmsHeroContent;
  stats: CmsStatItem[];
  howItWorks: CmsHowItWorksContent;
};

export type CmsAboutPageContent = {
  hero: CmsAboutHeroContent;
  values: CmsValueItem[];
  story: {
    sections: string[];
  };
};

type EnabledConfigRecord = {
  id: string;
  label: string;
  description?: string;
  enabled: boolean;
  sort_order: number;
};

export type RubricTemplateContext = 'course' | 'assignment' | 'grading';
export type RubricTemplateAssignmentType =
  | 'reading'
  | 'listening'
  | 'writing'
  | 'speaking'
  | 'generic';

export type IeltsQuestionSkillType = 'reading' | 'listening';
export type IeltsQuestionOptionType = 'true_false' | 'yes_no';

export type IeltsAssignmentTypeRecord = EnabledConfigRecord & {
  icon?: string;
};

export type IeltsQuestionTypeRecord = EnabledConfigRecord & {
  skill_type: IeltsQuestionSkillType;
};

export type IeltsWritingTaskTypeRecord = EnabledConfigRecord & {
  task_number: number;
};

export type IeltsSpeakingPartTypeRecord = EnabledConfigRecord;
export type IeltsCompletionFormatRecord = EnabledConfigRecord;
export type IeltsSampleTimingOptionRecord = EnabledConfigRecord;

export type IeltsQuestionOption = {
  value: string;
  label: string;
  score: number;
  enabled: boolean;
  sort_order: number;
};

export type IeltsConfigVersion = {
  version: number;
  name: string;
  description?: string;
  is_active: boolean;
  activated_at?: string;
  created_at: string;
};

export type IeltsConfigResponse = {
  version: number;
  assignment_types: IeltsAssignmentTypeRecord[];
  question_types: {
    reading: IeltsQuestionTypeRecord[];
    listening: IeltsQuestionTypeRecord[];
  };
  writing_task_types: {
    task1: IeltsWritingTaskTypeRecord[];
    task2: IeltsWritingTaskTypeRecord[];
  };
  speaking_part_types: IeltsSpeakingPartTypeRecord[];
  completion_formats: IeltsCompletionFormatRecord[];
  sample_timing_options: IeltsSampleTimingOptionRecord[];
};

export type IeltsConfigVersionsResponse = {
  versions: IeltsConfigVersion[];
  active_version: number;
};

export type IeltsQuestionOptionsResponse = {
  type: IeltsQuestionOptionType;
  version: number;
  options: IeltsQuestionOption[];
};

export type CreateSubmissionPayload = {
  studentId: string;
  payload: Record<string, unknown>;
  submittedAt?: string;
  status?: 'draft' | 'submitted' | 'late';
};

export type CreateSubmissionStatus = NonNullable<CreateSubmissionPayload['status']>;
