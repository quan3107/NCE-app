/**
 * Location: src/lib/backend-schema.ts
 * Purpose: Re-export backend schema-derived TypeScript contracts for frontend usage.
 * Why: Keeps backend Prisma/Zod schemas as the single source of truth for domain typing.
 */

import type {
  AssignmentType as PrismaAssignmentType,
  EnrollmentRole as PrismaEnrollmentRole,
  NotificationChannel as PrismaNotificationChannel,
  NotificationStatus as PrismaNotificationStatus,
  SubmissionStatus as PrismaSubmissionStatus,
  UserRole as PrismaUserRole,
  UserStatus as PrismaUserStatus,
} from '../../../backend/src/prisma/generated/client/enums';
import type {
  DashboardWidgetDefaultsResponse as BackendDashboardWidgetDefaultsResponse,
} from '../../../backend/src/modules/dashboard-config/dashboard-config.schema';
import type {
  AboutHeroContent as BackendAboutHeroContent,
  AboutPageContent as BackendAboutPageContent,
  FeatureItem as BackendFeatureItem,
  HeroContent as BackendHeroContent,
  HomepageContent as BackendHomepageContent,
  HowItWorksContent as BackendHowItWorksContent,
  StatItem as BackendCmsStatItem,
  ValueItem as BackendValueItem,
} from '../../../backend/src/modules/cms/cms.schema';
import type {
  IeltsAssignmentType as BackendIeltsAssignmentType,
  IeltsCompletionFormat as BackendIeltsCompletionFormat,
  IeltsConfigResponse as BackendIeltsConfigResponse,
  IeltsConfigVersion as BackendIeltsConfigVersion,
  IeltsConfigVersionsResponse as BackendIeltsConfigVersionsResponse,
  IeltsQuestionOption as BackendIeltsQuestionOption,
  IeltsQuestionOptionsResponse as BackendIeltsQuestionOptionsResponse,
  IeltsQuestionType as BackendIeltsQuestionType,
  IeltsQuestionOptionType as BackendIeltsQuestionOptionType,
  IeltsSampleTimingOption as BackendIeltsSampleTimingOption,
  IeltsSpeakingPartType as BackendIeltsSpeakingPartType,
  IeltsWritingTaskType as BackendIeltsWritingTaskType,
} from '../../../backend/src/modules/ielts-config/ielts-config.schema';
import type {
  RubricTemplateAssignmentType as BackendRubricTemplateAssignmentType,
  RubricTemplateContext as BackendRubricTemplateContext,
} from '../../../backend/src/modules/rubric-templates/rubric-templates.schema';
import type { CreateSubmissionPayload as BackendCreateSubmissionPayload } from '../../../backend/src/modules/submissions/submissions.schema';

export type UserRole = PrismaUserRole;
export type UserStatus = PrismaUserStatus;
export type EnrollmentRole = PrismaEnrollmentRole;
export type AssignmentType = PrismaAssignmentType;
export type SubmissionStatus = PrismaSubmissionStatus;
export type NotificationChannel = PrismaNotificationChannel;
export type NotificationStatus = PrismaNotificationStatus;

export type DashboardRole = BackendDashboardWidgetDefaultsResponse['role'];
export type CmsStatFormat = BackendCmsStatItem['format'];
export type CmsStatItem = BackendCmsStatItem;
export type CmsHeroContent = BackendHeroContent;
export type CmsFeatureItem = BackendFeatureItem;
export type CmsHowItWorksContent = BackendHowItWorksContent;
export type CmsHomepageContent = BackendHomepageContent;
export type CmsAboutHeroContent = BackendAboutHeroContent;
export type CmsValueItem = BackendValueItem;
export type CmsAboutPageContent = BackendAboutPageContent;

export type RubricTemplateContext = BackendRubricTemplateContext;
export type RubricTemplateAssignmentType = BackendRubricTemplateAssignmentType;

export type IeltsQuestionOptionType = BackendIeltsQuestionOptionType;
export type IeltsQuestionSkillType =
  BackendIeltsConfigResponse['question_types']['reading'][number]['skill_type'];
export type IeltsAssignmentTypeRecord = BackendIeltsAssignmentType;
export type IeltsQuestionTypeRecord = BackendIeltsQuestionType;
export type IeltsWritingTaskTypeRecord = BackendIeltsWritingTaskType;
export type IeltsSpeakingPartTypeRecord = BackendIeltsSpeakingPartType;
export type IeltsCompletionFormatRecord = BackendIeltsCompletionFormat;
export type IeltsSampleTimingOptionRecord = BackendIeltsSampleTimingOption;
export type IeltsConfigResponse = BackendIeltsConfigResponse;
export type IeltsConfigVersion = BackendIeltsConfigVersion;
export type IeltsConfigVersionsResponse = BackendIeltsConfigVersionsResponse;
export type IeltsQuestionOption = BackendIeltsQuestionOption;
export type IeltsQuestionOptionsResponse = BackendIeltsQuestionOptionsResponse;

export type CreateSubmissionStatus = NonNullable<BackendCreateSubmissionPayload['status']>;
