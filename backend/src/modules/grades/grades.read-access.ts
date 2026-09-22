/** Grade read authorization shared by current and replacement grading flows. */
import { Prisma, UserRole, EnrollmentRole } from '../../prisma/index.js'
import { createHttpError } from '../../utils/httpError.js'
type GradingActor = { id: string; role: UserRole }

export function buildGradeReadWhere(
  submissionId: string,
  actor: GradingActor | undefined,
): Prisma.GradeWhereInput {
  if (!actor) {
    throw createHttpError(401, 'Authentication is required to view grades.')
  }

  const activeSubmission = {
    deletedAt: null,
    assignment: {
      deletedAt: null,
      course: {
        deletedAt: null,
      },
    },
  }

  if (actor.role === UserRole.admin) {
    return {
      submissionId,
      deletedAt: null,
      submission: activeSubmission,
    }
  }

  if (actor.role === UserRole.student) {
    return {
      submissionId,
      deletedAt: null,
      submission: {
        ...activeSubmission,
        studentId: actor.id,
      },
    }
  }

  if (actor.role === UserRole.teacher) {
    return {
      submissionId,
      deletedAt: null,
      submission: {
        deletedAt: null,
        assignment: {
          deletedAt: null,
          course: {
            deletedAt: null,
            OR: [
              { ownerId: actor.id },
              {
                enrollments: {
                  some: {
                    userId: actor.id,
                    roleInCourse: EnrollmentRole.teacher,
                    deletedAt: null,
                  },
                },
              },
            ],
          },
        },
      },
    }
  }

  throw createHttpError(403, 'You do not have permission to view this grade.')
}
