/**
 * File: src/modules/router.ts
 * Purpose: Compose individual feature routers into the versioned API surface.
 * Why: Keeps module wiring centralized and aligns with the PRD's layered architecture.
 */
import { Router } from "express";

import { analyticsRouter } from "./analytics/analytics.routes.js";
import { assignmentRouter } from "./assignments/assignments.routes.js";
import { authRouter } from "./auth/auth.routes.js";
import { auditLogRouter } from "./audit-logs/audit-logs.routes.js";
import { courseRouter } from "./courses/courses.routes.js";
import { enrollmentRouter } from "./enrollments/enrollments.routes.js";
import { fileRouter } from "./files/files.routes.js";
import { gradeRouter } from "./grades/grades.routes.js";
import { meRouter } from "./me/me.routes.js";
import { notificationRouter } from "./notifications/notifications.routes.js";
import { rubricRouter } from "./rubrics/rubrics.routes.js";
import { submissionRouter } from "./submissions/submissions.routes.js";
import { userRouter } from "./users/users.routes.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/me", meRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/analytics", analyticsRouter);
apiRouter.use("/audit-logs", auditLogRouter);
apiRouter.use("/enrollments", enrollmentRouter);
apiRouter.use("/courses", courseRouter);
apiRouter.use("/courses/:courseId/assignments", assignmentRouter);
apiRouter.use("/courses/:courseId/rubrics", rubricRouter);
apiRouter.use(
  "/assignments/:assignmentId/submissions",
  submissionRouter,
);
apiRouter.use("/submissions/:submissionId/grade", gradeRouter);
apiRouter.use("/notifications", notificationRouter);
apiRouter.use("/files", fileRouter);
