/**
 * Location: tests/retainedMediaRemoval.component.test.tsx
 * Purpose: Exercise explicit media removal after upload success and save failure.
 * Why: Retained media must not survive a deliberate removal in the retry payload.
 */
import React from "react";
import type { ComponentProps } from "react";
import type { TeacherIeltsAssignmentEditor } from "../src/features/assignments/components/TeacherIeltsAssignmentEditor";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { TeacherIeltsAssignmentCreatePage } from "../src/features/assignments/components/TeacherIeltsAssignmentCreatePage";
const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  create: vi.fn(),
  type: "listening" as "listening" | "writing",
}));
vi.mock("@features/assignments/api", () => ({
  useAssignmentResources: () => ({
    courses: [{ id: "course", title: "Course" }],
    isLoading: false,
  }),
  useCreateAssignmentMutation: () => ({
    mutateAsync: mocks.create,
    isPending: false,
  }),
}));
vi.mock("@features/files/fileUpload", () => ({
  uploadFileWithProgress: mocks.upload,
}));
vi.mock("@lib/router", () => ({ useRouter: () => ({ navigate: vi.fn() }) }));
vi.mock("@lib/use-auto-save", () => ({
  useAutoSave: () => ({ clearDraft: vi.fn() }),
}));
vi.mock(
  "../src/features/assignments/components/teacherIeltsCreate.logic",
  async (original) => {
    const actual =
      await original<
        typeof import("../src/features/assignments/components/teacherIeltsCreate.logic")
      >();
    const { createIeltsAssignmentConfig } = await import("../src/lib/ielts");
    return {
      ...actual,
      getInitialStateFromDraft: () => ({
        type: mocks.type,
        timestamp: Date.now(),
        data: {
          assignmentTitle: "Media removal",
          courseId: "course",
          assignmentConfig: createIeltsAssignmentConfig(mocks.type),
        },
      }),
    };
  },
);
vi.mock(
  "../src/features/assignments/components/TeacherIeltsAssignmentEditor",
  () => ({
    TeacherIeltsAssignmentEditor: ({
      listeningConfig,
      onAudioSelect,
      onWritingImageSelect,
      onSaveDraft,
      isLoading,
    }: ComponentProps<typeof TeacherIeltsAssignmentEditor>) => (
      <>
        <button
          onClick={() =>
            listeningConfig
              ? onAudioSelect(
                  listeningConfig.sections[0].id,
                  new File(["wav"], "one.wav"),
                )
              : onWritingImageSelect(new File(["png"], "one.png"))
          }
        >
          Select media
        </button>
        <button
          onClick={() =>
            listeningConfig
              ? onAudioSelect(listeningConfig.sections[0].id, null)
              : onWritingImageSelect(null)
          }
        >
          Remove media
        </button>
        <button disabled={isLoading} onClick={onSaveDraft}>
          Save
        </button>
      </>
    ),
  }),
);
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
test.each(["listening", "writing"] as const)(
  "%s removal after upload-success/save-failure omits media on retry",
  async (type) => {
    mocks.type = type;
    mocks.upload.mockResolvedValue({ id: "uploaded-audio" });
    mocks.create
      .mockRejectedValueOnce(new Error("Assignment save failed"))
      .mockResolvedValueOnce({});
    render(<TeacherIeltsAssignmentCreatePage />);
    fireEvent.click(screen.getByText("Select media"));
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Assignment save failed",
      ),
    );
    fireEvent.click(screen.getByText("Remove media"));
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    const config = mocks.create.mock.calls[1][0].payload.assignmentConfig;
    expect(
      type === "listening"
        ? config.sections[0].audioFileId
        : config.task1.imageFileId,
    ).toBeNull();
    expect(mocks.upload).toHaveBeenCalledTimes(1);
  },
);
