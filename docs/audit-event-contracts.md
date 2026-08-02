<!--
File: docs/audit-event-contracts.md
Purpose: Inventory the version 1 audit action contracts and rollout policy.
Why: Reviewers need a finite matrix of data allowed to cross the audit boundary.
-->

# Audit Event Contracts

Every row uses schema version `1`. The searchable envelope is limited to
`actorId`, `action`, `entity`, and `entityId`; the listed fields are the complete
`eventData` allowlist. All Zod objects are strict, so unregistered actions,
incorrect entities, missing fields, and unknown properties fail before Prisma.

| Action | Entity | Allowed event data | Write policy |
| --- | --- | --- | --- |
| `auth.login_succeeded` | `auth_session` | `role`, `status` | Failure-safe |
| `auth.google_login_succeeded` | `auth_session` | `role`, `status`, `identityLinked`, `emailVerifiedUpdated` | Failure-safe |
| `auth.registered` | `user` | `role`, `status` | Failure-safe |
| `auth.session_refreshed` | `auth_session` | `sessionRotated` | Failure-safe |
| `auth.session_revoked` | `auth_session` | `sessionRevoked` | Failure-safe |
| `user.created` | `user` | `role`, `status` | Failure-safe |
| `user.invited` | `user` | `role`, `status` | Failure-safe |
| `user.profile_updated` | `user` | `fullNameChanged` | Strict |
| `user.teacher_approved` | `user` | `previousStatus`, `status` | Failure-safe |
| `user.teacher_rejected` | `user` | `previousStatus`, `status` | Failure-safe |
| `course.created` | `course` | `ownerTeacherId` | Failure-safe |
| `course.updated` | `course` | reviewed `*Changed` markers | Failure-safe |
| `course.archived` | `course` | `lifecycleChanged` | Failure-safe |
| `course.restored` | `course` | `lifecycleChanged` | Failure-safe |
| `course.teacher_added` | `enrollment` | `courseId`, `userId`, `roleInCourse`, `membershipChanged` | Failure-safe |
| `course.teacher_removed` | `enrollment` | `courseId`, `userId`, `roleInCourse`, `membershipChanged` | Failure-safe |
| `course.student_added` | `enrollment` | `courseId`, `userId`, `roleInCourse`, `membershipChanged` | Failure-safe |
| `course.student_removed` | `enrollment` | `courseId`, `userId`, `roleInCourse`, `membershipChanged` | Failure-safe |
| `enrollment.created` | `enrollment` | `courseId`, `userId`, `roleInCourse` | Failure-safe |
| `enrollment.deleted` | `enrollment` | `courseId`, `userId`, `roleInCourse`, `membershipChanged` | Failure-safe |
| `assignment.created` | `assignment` | `courseId`, `type`, `published` | Failure-safe |
| `assignment.updated` | `assignment` | `courseId`, reviewed `*Changed` markers | Failure-safe |
| `assignment.deleted` | `assignment` | `courseId`, `lifecycleChanged` | Failure-safe |
| `submission.created` | `submission` | assignment/course/student IDs, status transition, timestamp/content markers | Failure-safe |
| `submission.updated` | `submission` | assignment/course/student IDs, status transition, timestamp/content markers | Failure-safe |
| `submission.submitted` | `submission` | assignment/course/student IDs, status transition, timestamp/content markers | Failure-safe |
| `grade.upserted` | `grade` | `submissionId`, `graderId`, score/feedback markers | Failure-safe |
| `cms.draft_updated` | `cms_page_content` | page key, draft versions, content marker | Failure-safe |
| `cms.published` | `cms_page_content` | page/revision IDs and number, content marker | Failure-safe |
| `cms.rolled_back` | `cms_page_content` | page/revision/source IDs and numbers, content marker | Failure-safe |
| `cms.homepage_stats_refreshed` | `cms_page_content` | page/section keys, item count, sync marker | Failure-safe |
| `dashboard_config.saved` | `user_dashboard_config` | `role`, widget and visible counts | Failure-safe |
| `dashboard_config.reset` | `user_dashboard_config` | `role`, widget count | Failure-safe |
| `cleanup.retention_executed` | `maintenance_job` | deletion/batch counts, limits, cutoffs, limit markers | Failure-safe |
| `ai_feedback.policy_changed` | `assignment` | assignment/course IDs and policy-field markers | Failure-safe |
| `ai_feedback.writing_requested` | `ai_feedback_draft` | entity IDs, bounded route/provider, model/version, status/visibility, use markers | Strict |
| `ai_feedback.writing_generated` | `ai_feedback_draft` | entity IDs, bounded route/provider, model/version, status/output marker | Strict |
| `ai_feedback.writing_failed` | `ai_feedback_draft` | generated-event fields, bounded failure code, false output marker | Strict |
| `ai_feedback.writing_approved` | `ai_feedback_draft` | entity IDs, decision, feedback marker | Strict |
| `ai_feedback.writing_rejected` | `ai_feedback_draft` | entity IDs, decision, feedback marker | Strict |
| `ai_feedback.writing_finalized` | `ai_feedback_draft` | entity IDs, decision, feedback marker | Strict |
| `ai_feedback.explanation_requested` | `ai_objective_explanation` | entity IDs, bounded route/provider, model/version, status/use markers | Strict |
| `ai_feedback.explanation_generated` | `ai_objective_explanation` | entity IDs, bounded route/provider, model/version, status/output marker | Strict |
| `ai_feedback.explanation_failed` | `ai_objective_explanation` | generated-event fields, bounded failure code, false output marker | Strict |
| `ai_feedback.grade_feedback_updated` | `grade` | entity IDs, decision, feedback marker | Strict |

## Data that is never accepted

Contracts omit complete database records, request metadata, credentials, user
profiles, course or assignment prose, submission payloads, scores, feedback,
prompts, accepted answers, explanations, model output, failure messages, and
provider bodies. Content-derived hashes, lengths, previews, fragments,
encodings, and generic redaction objects are also prohibited.

## Migration and rollout

The forward migration intentionally deletes all preproduction `audit_logs`
rows before dropping `diff`; legacy payloads are not transformed or retained.
Do not execute it against any shared environment until the owner confirms that
audit-history loss is acceptable. Rehearse on a disposable nonproduction
database with `prisma:migrate:deploy`, reference seeding, and the audit test
suite, then inspect representative rows from every event family.
