/** Shared course announcement UI: accessible authoring, publication, reading, and moderation. */
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Textarea } from "@components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@components/ui/dialog";
import { useAuthStore } from "@store/authStore";
import { useMutationLifetime } from "@lib/useMutationLifetime";
import {
  createAnnouncement,
  deleteAnnouncement,
  editAnnouncement,
  fetchAnnouncements,
  type Announcement,
} from "./api";

export function CourseAnnouncements({ courseId }: { courseId: string }) {
  const { currentUser } = useAuthStore();
  const teacher = currentUser?.role === "teacher";
  const manager = teacher || currentUser?.role === "admin";
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: ["announcements", courseId, offset],
    queryFn: () => fetchAnnouncements(courseId, offset),
    retry: false,
  });
  const [editor, setEditor] = useState<Announcement | "new" | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [deleting, setDeleting] = useState<Announcement | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const busy = useRef(false);
  const request = useRef({ signature: "", id: crypto.randomUUID() });
  const captureLifetime = useMutationLifetime();

  const openEditor = (row: Announcement | "new") => {
    setTitle(row === "new" ? "" : row.title);
    setBody(row === "new" ? "" : row.body);
    setError("");
    setNotice("");
    setEditor(row);
    request.current = { signature: "", id: crypto.randomUUID() };
  };

  const run = async (operation: () => Promise<unknown>, message: string) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    const isCurrent = captureLifetime();
    try {
      await operation();
      if (!isCurrent()) return;
      setEditor(null);
      setDeleting(null);
      setNotice(message);
      await query.refetch();
    } catch (cause) {
      if (isCurrent())
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to save. Please retry.",
        );
    } finally {
      if (isCurrent()) {
        busy.current = false;
        setPending(false);
      }
    }
  };

  const save = (publish: boolean) => {
    if (busy.current) return;
    const content = { title: title.trim(), body: body.trim(), publish };
    if (!content.title || !content.body) {
      setError("Enter a title and message.");
      return;
    }
    const signature = JSON.stringify(content);
    if (request.current.signature !== signature)
      request.current = { signature, id: crypto.randomUUID() };
    void run(
      () =>
        editor === "new"
          ? createAnnouncement(courseId, {
              ...content,
              requestId: request.current.id,
            })
          : editAnnouncement(courseId, (editor as Announcement).id, {
              ...content,
              revision: (editor as Announcement).revision,
            }),
      publish
        ? "Announcement published. Student notifications are queued."
        : "Announcement saved.",
    );
  };

  return (
    <section className="space-y-4" aria-label="Course announcements">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2>Course Announcements</h2>
        {teacher && (
          <Button onClick={() => openEditor("new")} disabled={pending}>
            New announcement
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Published updates for this course. Publishing sends one in-app
        notification and one email to every currently enrolled student. Edits do
        not send another notification.
      </p>
      {notice && <p role="status">{notice}</p>}
      {query.isPending ? (
        <p role="status">Loading announcements…</p>
      ) : query.error ? (
        <div role="alert">
          <p>Unable to load announcements. {query.error.message}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          {!query.data?.data.length && <p>No announcements yet.</p>}
          {query.data?.data.map((row) => (
            <Card key={row.id}>
              <CardHeader>
                <CardTitle className="break-words">{row.title}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {row.publishedAt
                    ? `Published ${new Date(row.publishedAt).toLocaleString()}`
                    : "Draft — only course teachers can publish"}
                  {row.revision > 1 ? " · Updated" : ""}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="whitespace-pre-wrap break-words">{row.body}</p>
                {manager && (
                  <div className="flex gap-2">
                    {teacher && (
                      <Button
                        variant="outline"
                        onClick={() => openEditor(row)}
                        disabled={pending}
                        aria-label={`Edit ${row.title}`}
                      >
                        Edit{!row.publishedAt ? " / Publish" : ""}
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setDeleting(row);
                        setError("");
                      }}
                      disabled={pending}
                      aria-label={`Delete ${row.title}`}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          <div className="flex gap-2">
            {offset > 0 && (
              <Button
                variant="outline"
                onClick={() => setOffset(Math.max(0, offset - 20))}
              >
                Previous
              </Button>
            )}
            {query.data?.nextOffset != null && (
              <Button
                variant="outline"
                onClick={() => setOffset(query.data!.nextOffset!)}
              >
                Next
              </Button>
            )}
          </div>
        </>
      )}
      <Dialog
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setEditor(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editor === "new" ? "New announcement" : "Edit announcement"}
            </DialogTitle>
            <DialogDescription>
              Save a draft or publish to all currently enrolled students.
              Published edits are silent; previously sent messages cannot be
              recalled.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              save(false);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="announcement-title">Title</Label>
              <Input
                id="announcement-title"
                maxLength={200}
                required
                value={title}
                disabled={pending}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="announcement-body">Message</Label>
              <Textarea
                id="announcement-body"
                rows={6}
                maxLength={10000}
                required
                value={body}
                disabled={pending}
                onChange={(event) => setBody(event.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            {pending && <p role="status">Saving announcement…</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pending}>
                {editor !== "new" && editor?.publishedAt
                  ? "Save changes"
                  : "Save draft"}
              </Button>
              {(editor === "new" || !editor?.publishedAt) && (
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => save(true)}
                >
                  Publish
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setEditor(null)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete announcement?</DialogTitle>
            <DialogDescription>
              Delete “{deleting?.title}” and cancel unsent notifications. Email
              already sent or in flight cannot be recalled.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              void run(
                () => deleteAnnouncement(courseId, deleting!.id),
                "Announcement deleted.",
              )
            }
          >
            {pending ? "Deleting…" : "Confirm delete"}
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => setDeleting(null)}
          >
            Cancel
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
