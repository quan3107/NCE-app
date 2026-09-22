/** Read active AI drafts and retry identity without exposing historical replacements. */
import { z } from 'zod'
import { prisma } from '../../prisma/client.js'
import { studentVisibleAiFeedbackDraftParamsSchema } from './ai-feedback.schema.js'
const studentVisibleDraftStatuses = ['accepted', 'approved', 'finalized'] as const

const instantVisibleAssignmentConfigSchema = z
  .object({
    aiPolicy: z
      .object({
        writingFeedbackMode: z.literal('instant_student_visible'),
      })
      .passthrough(),
  })
  .passthrough()

function isInstantVisibleAssignmentPolicy(assignmentConfig: unknown): boolean {
  return instantVisibleAssignmentConfigSchema.safeParse(assignmentConfig).success
}

export async function getStudentVisibleAiFeedbackDraft(input: unknown) {
  const { submissionId, studentId } =
    studentVisibleAiFeedbackDraftParamsSchema.parse(input)
  const draft = await prisma.aiFeedbackDraft.findFirst({
    where: {
      submissionId,
      deletedAt: null,
      visibilityMode: 'instant_student_visible',
      status: {
        in: [...studentVisibleDraftStatuses],
      },
      submission: {
        studentId,
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
          assignment: {
            select: {
              assignmentConfig: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  if (!draft) {
    return null
  }

  return isInstantVisibleAssignmentPolicy(draft.submission.assignment.assignmentConfig)
    ? draft
    : null
}

export async function findLatestAiFeedbackDraftBySubmission(submissionId: string) {
  return prisma.aiFeedbackDraft.findFirst({
    where: {
      submissionId,
      deletedAt: null,
    },
    select: {
      id: true,
      inputHash: true,
      nextRetryAt: true,
      submissionId: true,
      status: true,
      visibilityMode: true,
      generatedFeedback: true,
      failureCode: true,
      failureMessage: true,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })
}
