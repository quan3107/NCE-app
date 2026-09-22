/** Shared admin report contract; null represents unavailable metrics. */
export type AdminAnalytics = {
  generatedAt: string
  filters: { from: string; to: string; courseId: string | null; timezone: string }
  overview: {
    students: number
    teachers: number
    courses: number
    publishedCourses: null
    enrollments: number
    eligibleLearners: number
  }
  engagement: {
    trackingSince: string | null
    completeCoverage: boolean
    observedActive: number | null
    noObservedActivity: number
    students: { id: string; name: string }[]
    studentsTruncated: boolean
    trend: { day: string; learners: number | null; coverage: string }[]
  }
  submissions: {
    onTime: number
    late: number
    noDeadline: number
    awaitingGrading: number
    submitted: number
    lateWindow: number
    missing: number
  }
  progress: {
    courseId: string
    courseTitle: string
    learners: number
    lessonOpportunities: number
    completedLessons: number
    assignmentOpportunities: number
    submittedAssignments: number
  }[]
  results: {
    courseId: string
    courseTitle: string
    assignmentId: string
    assignmentTitle: string
    skill: string
    scale: string
    samples: number
    average: number | null
  }[]
}
