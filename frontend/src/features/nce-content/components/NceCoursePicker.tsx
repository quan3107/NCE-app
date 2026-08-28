/**
 * Location: features/nce-content/components/NceCoursePicker.tsx
 * Purpose: Select an educator-accessible course by name.
 * Why: NCE workflows must not require teachers to discover or paste internal UUIDs.
 */

import { Label } from "@components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select";
import { useCoursesQuery } from "@features/courses/api";

type Props = {
  courseId: string;
  onChange: (courseId: string) => void;
};

export function NceCoursePicker({ courseId, onChange }: Props) {
  const coursesQuery = useCoursesQuery();

  return (
    <div className="space-y-2">
      <Label htmlFor="nce-course">Course</Label>
      <Select
        value={courseId}
        onValueChange={onChange}
        disabled={coursesQuery.isLoading}
      >
        <SelectTrigger id="nce-course">
          <SelectValue
            placeholder={
              coursesQuery.isLoading ? "Loading courses" : "Select a course"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {(coursesQuery.data ?? []).map((course) => (
            <SelectItem key={course.id} value={course.id}>
              {course.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {coursesQuery.error ? (
        <p role="alert" className="text-sm text-destructive">
          Unable to load accessible courses.
        </p>
      ) : null}
    </div>
  );
}
