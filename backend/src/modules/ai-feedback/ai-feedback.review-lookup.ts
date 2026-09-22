/** Load active AI review targets; replacement tombstones hide old drafts. */
import { prisma } from '../../prisma/client.js'
import { createNotFoundError } from '../../utils/httpError.js'
import type { DraftWithSubmission } from './ai-feedback.teacher-review.js'

export async function findDraftForDecision(
  submissionId: string,
  draftId: string,
): Promise<DraftWithSubmission> {
  const draft = await prisma.aiFeedbackDraft.findFirst({
    where: {
      id: draftId,
      submissionId,
      deletedAt: null,
      submission: {
        deletedAt: null,
        assignment: {
          deletedAt: null,
          course: {
            deletedAt: null,
          },
        },
      },
    },
    include: {
      submission: {
        select: {
          id: true,
          grade: {
            select: {
              id: true,
              feedback: true,
              deletedAt: true,
            },
          },
          assignment: {
            select: {
              type: true,
              course: {
                select: {
                  ownerId: true,
                  enrollments: {
                    select: {
                      userId: true,
                      roleInCourse: true,
                      deletedAt: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!draft) {
    throw createNotFoundError('AI feedback draft', draftId)
  }

  return draft as DraftWithSubmission
}

export type ReviewDraft = {
  id: string
  submissionId: string
  assignmentId: string
  status: string
  visibilityMode: 'teacher_reviewed' | 'instant_student_visible' | 'hidden'
  generatedFeedback: unknown
  teacherEditedFeedback: unknown
  normalizedCriterionSuggestions: unknown
  decision: string | null
  decisionActorId: string | null
  decidedAt: Date | null
  finalizedAt: Date | null
  failureCode: string | null
  failureMessage: string | null
  gradeId: string | null
  createdAt: Date
  updatedAt: Date
}
