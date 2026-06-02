/**
 * File: src/modules/submissions/submissions.ielts-content.ts
 * Purpose: Validate final IELTS submission payload content.
 * Why: Keeps status-aware IELTS content checks separate from persistence flow.
 */
import { AssignmentType } from "../../prisma/index.js";
import { createHttpError } from "../../utils/httpError.js";
import { isIeltsAssignmentType } from "../assignments/ielts.schema.js";

function hasNonEmptyAnswer(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => typeof item === "string" && item.trim() !== "");
  }
  return typeof value === "string" ? value.trim() !== "" : value !== undefined;
}

export function assertSubmittedIeltsPayloadHasContent({
  type,
  status,
  payload,
}: {
  type: AssignmentType;
  status: string;
  payload: unknown;
}) {
  if (status === "draft" || !isIeltsAssignmentType(type)) {
    return;
  }

  const record =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  if (type === "reading" || type === "listening") {
    const answers = Array.isArray(record.answers) ? record.answers : [];
    const hasAnswer = answers.some((item) => {
      if (!item || typeof item !== "object") {
        return false;
      }
      return hasNonEmptyAnswer((item as Record<string, unknown>).value);
    });
    if (!hasAnswer) {
      throw createHttpError(
        400,
        "IELTS submissions require at least one answer.",
      );
    }
    return;
  }

  if (type === "writing") {
    const task1 = record.task1 as Record<string, unknown> | undefined;
    const task2 = record.task2 as Record<string, unknown> | undefined;
    if (
      typeof task1?.text !== "string" ||
      task1.text.trim() === "" ||
      typeof task2?.text !== "string" ||
      task2.text.trim() === ""
    ) {
      throw createHttpError(
        400,
        "IELTS writing submissions require responses for both tasks.",
      );
    }
    return;
  }

  if (type === "speaking") {
    const recordings = Array.isArray(record.recordings)
      ? record.recordings
      : [];
    if (recordings.length === 0) {
      throw createHttpError(
        400,
        "IELTS speaking submissions require recording metadata.",
      );
    }
  }
}
