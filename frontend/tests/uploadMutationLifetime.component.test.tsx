/**
 * Location: tests/uploadMutationLifetime.component.test.tsx
 * Purpose: Exercise duplicate selections and late upload completion callbacks.
 * Why: Uploaded media must remain attached only to the initiating mounted session.
 */
import React from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { FileUploader } from "../src/components/common/FileUploader";
import { setAuthenticatedQueryScope } from "../src/lib/authenticated-query-scope";

vi.mock("@features/files/configApi", () => ({
  useFileUploadConfig: () => ({
    data: {
      limits: { maxFileSize: 1024, maxTotalSize: 4096, maxFilesPerUpload: 4 },
      accept: ".pdf",
      typeLabel: "PDF",
    },
  }),
}));
vi.mock("@features/files/fileUpload", () => ({
  isAllowedFile: () => ({ ok: true }),
}));
afterEach(() => {
  cleanup();
  setAuthenticatedQueryScope({ generation: 0, userId: null });
});

test.each(["unmount", "identity"] as const)(
  "ignores completion after %s",
  async (mode) => {
    let finish!: (value: {
      id: string;
      name: string;
      size: number;
      mime: string;
    }) => void;
    const upload = vi.fn(
      () =>
        new Promise<{ id: string; name: string; size: number; mime: string }>(
          (resolve) => {
            finish = resolve;
          },
        ),
    );
    const onChange = vi.fn();
    const view = render(
      <FileUploader value={[]} onChange={onChange} uploadFn={upload} />,
    );
    const file = new File(["test"], "test.pdf", { type: "application/pdf" });
    const input = view.container.querySelector('input[type="file"]')!;
    act(() => {
      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.change(input, { target: { files: [file] } });
    });
    expect(upload).toHaveBeenCalledTimes(1);
    if (mode === "unmount") view.unmount();
    else
      setAuthenticatedQueryScope({ generation: 1, userId: "another-student" });
    await act(async () =>
      finish({ id: "file", name: file.name, size: 4, mime: file.type }),
    );
    expect(onChange).not.toHaveBeenCalled();
  },
);
