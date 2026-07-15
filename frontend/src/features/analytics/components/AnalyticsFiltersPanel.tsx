/**
 * Location: features/analytics/components/AnalyticsFiltersPanel.tsx
 * Purpose: Render teacher analytics filters and CSV export controls.
 * Why: Keeps query selection UI separate from analytics chart presentation.
 */
import { Download } from "lucide-react";

import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import type { AnalyticsFilters } from "@features/analytics/api";

type FilterKey = keyof AnalyticsFilters;

type AnalyticsFiltersPanelProps = {
  filters: AnalyticsFilters;
  courseOptions: Array<{ id: string; title: string }>;
  courseOptionsError: string | null;
  courseOptionsLoading: boolean;
  exportError: string | null;
  isExporting: boolean;
  onChange: (key: FilterKey, value: string) => void;
  onExport: () => void;
};

export function AnalyticsFiltersPanel({
  filters,
  courseOptions,
  courseOptionsError,
  courseOptionsLoading,
  exportError,
  isExporting,
  onChange,
  onExport,
}: AnalyticsFiltersPanelProps) {
  return (
    <section
      className="rounded-xl border bg-card p-4"
      aria-label="Analytics filters"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="space-y-2">
          <Label htmlFor="analytics-from">From (UTC)</Label>
          <Input
            id="analytics-from"
            type="date"
            value={filters.from ?? ""}
            onChange={(event) => onChange("from", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="analytics-to">To (UTC)</Label>
          <Input
            id="analytics-to"
            type="date"
            value={filters.to ?? ""}
            onChange={(event) => onChange("to", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="analytics-course">Course</Label>
          <select
            id="analytics-course"
            className="border-input bg-input-background h-10 w-full rounded-lg border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            value={filters.courseId ?? ""}
            onChange={(event) => onChange("courseId", event.target.value)}
            disabled={courseOptionsLoading || Boolean(courseOptionsError)}
            aria-describedby={
              courseOptionsLoading || courseOptionsError
                ? "analytics-course-status"
                : undefined
            }
          >
            <option value="">All accessible courses</option>
            {courseOptions.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
          {courseOptionsLoading ? (
            <p
              id="analytics-course-status"
              className="text-xs text-muted-foreground"
            >
              Loading accessible courses…
            </p>
          ) : courseOptionsError ? (
            <p
              id="analytics-course-status"
              className="text-xs text-destructive"
            >
              {courseOptionsError}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="analytics-cohort">Cohort</Label>
          <Input
            id="analytics-cohort"
            placeholder="Schedule label"
            value={filters.cohort ?? ""}
            onChange={(event) => onChange("cohort", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="analytics-role">Course role</Label>
          <select
            id="analytics-role"
            className="border-input bg-input-background h-10 w-full rounded-lg border px-3 text-sm"
            value={filters.role ?? ""}
            onChange={(event) => onChange("role", event.target.value)}
          >
            <option value="">All accessible</option>
            <option value="owner">Owner</option>
            <option value="coTeacher">Co-teacher</option>
          </select>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Dates are inclusive UTC days. Cohort exactly matches the course
          schedule label.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={onExport}
          disabled={isExporting}
        >
          <Download />
          {isExporting ? "Exporting…" : "Export CSV"}
        </Button>
      </div>
      {exportError ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {exportError}
        </p>
      ) : null}
    </section>
  );
}
