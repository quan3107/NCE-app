/**
 * Location: features/nce-content/components/NceAttemptSummaries.tsx
 * Purpose: Render paginated learner NCE activity for one authorized course.
 * Why: Owners and delegated educators need a usable view over the existing scoped summary API.
 */

import { useEffect, useState } from "react";
import { Button } from "@components/ui/button";
import { Card, CardContent } from "@components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@components/ui/table";
import { useCourseNceAttemptSummariesQuery } from "../api";

const PAGE_SIZE = 20;

export function NceAttemptSummaries({ courseId }: { courseId: string }) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [courseId]);

  const query = useCourseNceAttemptSummariesQuery(courseId, {
    page,
    pageSize: PAGE_SIZE,
  });
  const attempts = query.data?.attempts ?? [];
  const total = query.data?.pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (query.isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading learner activity...
      </p>
    );
  }

  if (query.error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-destructive">
          Unable to load NCE attempt summaries for this course.
        </CardContent>
      </Card>
    );
  }

  if (attempts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No NCE attempts yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Learner</TableHead>
                <TableHead>Lesson</TableHead>
                <TableHead>Exercise</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attempts.map((attempt) => (
                <TableRow key={attempt.id}>
                  <TableCell>
                    <div className="font-medium">
                      {attempt.student.fullName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {attempt.student.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    Lesson {attempt.exercise.lesson.lessonNumber}:{" "}
                    {attempt.exercise.lesson.title}
                  </TableCell>
                  <TableCell className="capitalize">
                    {attempt.exercise.exerciseType.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell className="capitalize">{attempt.status}</TableCell>
                  <TableCell>
                    {attempt.score === null
                      ? "Pending"
                      : `${attempt.score}/${attempt.maxScore ?? "—"}`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {page} of {totalPages} · {total} attempts
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={page === 1 || query.isFetching}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={page >= totalPages || query.isFetching}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
