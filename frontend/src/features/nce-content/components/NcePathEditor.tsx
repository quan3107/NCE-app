/**
 * Location: features/nce-content/components/NcePathEditor.tsx
 * Purpose: Replace a course's ordered NCE path and availability windows.
 * Why: Course educators need a named, bounded workflow instead of raw assignment requests.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import {
  assignCourseNceLessons,
  useNceBooksQuery,
  useNceLessonsQuery,
  useNceUnitsQuery,
} from "../api";
import type { CourseNceLesson, NceLesson } from "../types";

type Props = {
  courseId: string;
  lessons: CourseNceLesson[];
  total: number;
  onSaved: () => Promise<unknown>;
};

type PathLesson = CourseNceLesson & {
  availableInput: string;
  dueInput: string;
};

const toLocalInput = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const toPathLesson = (lesson: CourseNceLesson): PathLesson => ({
  ...lesson,
  availableInput: toLocalInput(lesson.availableFrom),
  dueInput: toLocalInput(lesson.dueAt),
});

export function NcePathEditor({ courseId, lessons, total, onSaved }: Props) {
  const activeCourseId = useRef(courseId);
  const [items, setItems] = useState<PathLesson[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookId, setBookId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const booksQuery = useNceBooksQuery();
  const unitsQuery = useNceUnitsQuery(bookId || undefined);
  const libraryQuery = useNceLessonsQuery(unitId || undefined, {
    page: 1,
    pageSize: 100,
  });

  useEffect(() => {
    if (activeCourseId.current !== courseId) {
      activeCourseId.current = courseId;
      setItems(lessons.map(toPathLesson));
      setDirty(false);
      setSaving(false);
      setError(null);
      setBookId("");
      setUnitId("");
      setLessonId("");
      return;
    }

    if (!dirty) setItems(lessons.map(toPathLesson));
  }, [courseId, dirty, lessons]);

  const libraryLessons = libraryQuery.data?.lessons ?? [];
  const selectedLibraryLesson = libraryLessons.find(
    (lesson) => lesson.id === lessonId,
  );
  const existingIds = useMemo(
    () => new Set(items.map((lesson) => lesson.id)),
    [items],
  );
  const isComplete = total === lessons.length;

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    setItems((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setDirty(true);
  };

  const addLesson = (lesson: NceLesson | undefined) => {
    if (!lesson || existingIds.has(lesson.id)) return;
    setItems((current) =>
      current.concat(
        toPathLesson({
          ...lesson,
          sequence: current.length + 1,
          availableFrom: null,
          dueAt: null,
          canEdit: false,
          canPublish: false,
          isCourseOwned: false,
        }),
      ),
    );
    setLessonId("");
    setDirty(true);
  };

  const save = async () => {
    if (!isComplete) {
      setError(
        "This course has more than 100 path items. Narrowing or partial replacement is disabled.",
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await assignCourseNceLessons(courseId, {
        lessons: items.map((lesson, index) => ({
          lessonId: lesson.id,
          sequence: index + 1,
          availableFrom: lesson.availableInput
            ? new Date(lesson.availableInput).toISOString()
            : null,
          dueAt: lesson.dueInput
            ? new Date(lesson.dueInput).toISOString()
            : null,
        })),
      });
      await onSaved();
      setDirty(false);
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Unable to save the NCE path.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Add a published library lesson
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
          <Picker
            id="path-book"
            label="Book"
            value={bookId}
            placeholder="Select book"
            onChange={(value) => {
              setBookId(value);
              setUnitId("");
              setLessonId("");
            }}
            options={(booksQuery.data?.books ?? []).map((book) => ({
              value: book.id,
              label: book.title,
            }))}
          />
          <Picker
            id="path-unit"
            label="Unit"
            value={unitId}
            placeholder="Select unit"
            onChange={(value) => {
              setUnitId(value);
              setLessonId("");
            }}
            options={(unitsQuery.data?.units ?? []).map((unit) => ({
              value: unit.id,
              label: `Unit ${unit.unitNumber}: ${unit.title}`,
            }))}
          />
          <Picker
            id="path-lesson"
            label="Lesson"
            value={lessonId}
            placeholder="Select lesson"
            onChange={setLessonId}
            options={libraryLessons.map((lesson) => ({
              value: lesson.id,
              label: `Lesson ${lesson.lessonNumber}: ${lesson.title}`,
            }))}
          />
          <Button
            variant="outline"
            disabled={!selectedLibraryLesson || existingIds.has(lessonId)}
            onClick={() => addLesson(selectedLibraryLesson)}
          >
            <Plus className="mr-2 size-4" />
            Add
          </Button>
        </CardContent>
      </Card>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No lessons are assigned. Add a published lesson to start the course
          path.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((lesson, index) => (
            <Card key={lesson.id}>
              <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_11rem_11rem_auto] lg:items-end">
                <div>
                  <div className="font-medium">
                    {index + 1}. {lesson.title}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Lesson {lesson.lessonNumber} · {lesson.status}
                    {lesson.isCourseOwned ? " · course-owned" : ""}
                  </div>
                </div>
                <DateField
                  id={`available-${lesson.id}`}
                  label="Available from"
                  value={lesson.availableInput}
                  onChange={(value) => {
                    setItems((current) =>
                      current.map((item) =>
                        item.id === lesson.id
                          ? { ...item, availableInput: value }
                          : item,
                      ),
                    );
                    setDirty(true);
                  }}
                />
                <DateField
                  id={`due-${lesson.id}`}
                  label="Due at"
                  value={lesson.dueInput}
                  onChange={(value) => {
                    setItems((current) =>
                      current.map((item) =>
                        item.id === lesson.id
                          ? { ...item, dueInput: value }
                          : item,
                      ),
                    );
                    setDirty(true);
                  }}
                />
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label={`Move ${lesson.title} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label={`Move ${lesson.title} down`}
                    disabled={index === items.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label={`Remove ${lesson.title}`}
                    disabled={lesson.isCourseOwned}
                    onClick={() => {
                      setItems((current) =>
                        current.filter((item) => item.id !== lesson.id),
                      );
                      setDirty(true);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <div className="flex justify-end">
        <Button disabled={!dirty || saving || !isComplete} onClick={save}>
          <Save className="mr-2 size-4" />
          {saving ? "Saving path" : "Save path"}
        </Button>
      </div>
    </div>
  );
}

function Picker({
  id,
  label,
  value,
  placeholder,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
