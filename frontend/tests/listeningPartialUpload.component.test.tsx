/**
 * Location: tests/listeningPartialUpload.component.test.tsx
 * Purpose: Verify completed audio survives a partially failed upload batch.
 * Why: Retrying an assignment must not duplicate already uploaded media.
 */
import { expect, test, vi } from "vitest";
import type { IeltsListeningConfig } from "../src/lib/ielts";
const upload = vi.hoisted(() => vi.fn());
vi.mock("../src/features/files/fileUpload", () => ({
  uploadFileWithProgress: upload,
}));
import { uploadListeningAudioFiles } from "../src/features/assignments/components/teacherIeltsCreate.logic";

test("waits for remaining audio and preserves its ID when another upload fails", async () => {
  let finish!: (value: { id: string }) => void;
  upload.mockRejectedValueOnce(new Error("Storage rejected file"));
  upload.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const config = {
    sections: [
      { id: "a", audioFileId: "" },
      { id: "b", audioFileId: "" },
    ],
  } as IeltsListeningConfig;
  const completed = vi.fn();
  const result = uploadListeningAudioFiles(
    config,
    "listening",
    {
      a: new File(["a"], "a.wav"),
      b: new File(["b"], "b.wav"),
    },
    completed,
  );
  let settled = false;
  const observed = result.catch((error) => {
    settled = true;
    return error;
  });
  await Promise.resolve();
  expect(settled).toBe(false);
  finish({ id: "completed-b" });
  expect((await observed).message).toContain(
    "1 audio upload(s) completed; 1 failed",
  );
  expect(completed).toHaveBeenCalledWith("b", "completed-b");
});
