/**
 * File: tests/modules/ai-feedback/ai-feedback.repository.fixtures.ts
 * Purpose: Share stable IDs and configs for AI feedback repository tests.
 * Why: Keeps persistence test cases focused on behavior instead of setup noise.
 */
export const assignmentId = "f08fd6ff-a35d-4b89-8db8-d82e87cb08e9";
export const submissionId = "87b3a89f-745e-4c9a-9960-59a58d91b9ff";
export const requesterId = "599db5d5-7a3f-4039-b92f-5332c97371a9";
export const draftId = "b10d2a30-87bd-465f-8a5e-f23ca65be272";

export const instantAssignmentConfig = {
  version: 1,
  aiPolicy: {
    writingFeedbackMode: "instant_student_visible",
    objectiveExplanations: "off",
    providerTier: "low_cost",
  },
};
