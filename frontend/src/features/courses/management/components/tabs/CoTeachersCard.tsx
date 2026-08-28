/**
 * Location: features/courses/management/components/tabs/CoTeachersCard.tsx
 * Purpose: Let a course owner select, grant, inspect, and revoke co-teacher access.
 * Why: Delegation needs an explicit roster while peer-management remains owner-only.
 */

import { useState } from "react";
import { Button } from "@components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@components/ui/card";
import { Label } from "@components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select";
import { Trash2, UserPlus } from "lucide-react";
import {
  addCourseTeacher,
  removeCourseTeacher,
  useCourseTeacherCandidatesQuery,
  useCourseTeachersQuery,
} from "../../api";

type Props = { courseId: string; canManage: boolean };

export function CoTeachersCard({ courseId, canManage }: Props) {
  const teachersQuery = useCourseTeachersQuery(courseId);
  const candidatesQuery = useCourseTeacherCandidatesQuery(courseId, canManage);
  const [candidateId, setCandidateId] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const candidates = candidatesQuery.data?.teachers ?? [];
  const candidate = candidates.find((teacher) => teacher.id === candidateId);

  const add = async () => {
    if (!candidate) return;
    setPendingId(candidate.id);
    setError(null);
    try {
      await addCourseTeacher(courseId, candidate.email);
      setCandidateId("");
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Unable to add co-teacher.",
      );
    } finally {
      setPendingId(null);
    }
  };

  const remove = async (teacherId: string) => {
    setPendingId(teacherId);
    setError(null);
    try {
      await removeCourseTeacher(courseId, teacherId);
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Unable to remove co-teacher.",
      );
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Co-teachers</CardTitle>
        <CardDescription>
          Delegated educators can manage course learning work, but only the
          owner can change this roster.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage ? (
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="co-teacher-candidate">Active teacher</Label>
              <Select
                value={candidateId}
                onValueChange={setCandidateId}
                disabled={candidatesQuery.isLoading}
              >
                <SelectTrigger id="co-teacher-candidate">
                  <SelectValue placeholder="Select an active teacher" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.fullName} ({teacher.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button disabled={!candidate || pendingId !== null} onClick={add}>
              <UserPlus className="mr-2 size-4" />
              Add co-teacher
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            The course owner manages delegation.
          </p>
        )}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {teachersQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">
            Loading co-teachers...
          </p>
        ) : null}
        {(teachersQuery.data?.teachers ?? []).map((teacher) => (
          <div
            key={teacher.id}
            className="flex items-center justify-between gap-3 rounded-md border p-3"
          >
            <div>
              <p className="font-medium">{teacher.fullName}</p>
              <p className="text-sm text-muted-foreground">{teacher.email}</p>
            </div>
            {canManage ? (
              <Button
                size="icon"
                variant="outline"
                aria-label={`Remove ${teacher.fullName}`}
                disabled={pendingId !== null}
                onClick={() => remove(teacher.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </div>
        ))}
        {!teachersQuery.isLoading &&
        (teachersQuery.data?.teachers.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            No co-teachers have been delegated.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
