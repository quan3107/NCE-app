/**
 * Location: features/analytics/components/TeacherAnalyticsPage.tsx
 * Purpose: Coordinate filtered teacher analytics data and presentation.
 * Why: Keeps URL state and export behavior at the analytics route boundary.
 */
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Award, BookOpen, Clock, Gauge } from "lucide-react";

import { PageHeader } from "@components/common/PageHeader";
import { Card, CardContent } from "@components/ui/card";
import {
  type AnalyticsFilters,
  fetchTeacherAnalyticsCsv,
  useTeacherAnalyticsQuery,
} from "@features/analytics/api";
import { useCoursesQuery } from "@features/courses/api";
import { formatDistanceToNow } from "@lib/utils";

import { AnalyticsCharts } from "./AnalyticsCharts";
import { AnalyticsFiltersPanel } from "./AnalyticsFiltersPanel";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const readFilters = (searchParams: URLSearchParams): AnalyticsFilters => {
  const role = searchParams.get("role");
  const courseId = searchParams.get("courseId");
  return {
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    courseId:
      courseId && UUID_PATTERN.test(courseId) ? courseId : undefined,
    cohort: searchParams.get("cohort") ?? undefined,
    role: role === "owner" || role === "coTeacher" ? role : undefined,
  };
};

export function TeacherAnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const coursesQuery = useCoursesQuery();
  const analyticsQuery = useTeacherAnalyticsQuery(filters);

  const handleFilterChange = (key: keyof AnalyticsFilters, value: string) => {
    const next = new URLSearchParams(searchParams);
    const normalized = value.trim();
    if (normalized) {
      next.set(key, normalized);
    } else {
      next.delete(key);
    }
    setSearchParams(next, { replace: true });
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const blob = await fetchTeacherAnalyticsCsv(filters);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "teacher-analytics.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : "Unable to export analytics.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  const stats = useMemo(() => {
    const data = analyticsQuery.data;
    const percent = (value: number | null) =>
      value === null ? "N/A" : `${value.toFixed(1)}%`;
    const score = (value: number | null) =>
      value === null ? "N/A" : value.toFixed(1);
    const days = (value: number | null) =>
      value === null ? "N/A" : `${value.toFixed(1)} days`;

    return [
      {
        label: "On-time Rate",
        value: percent(data?.onTimeRate ?? null),
        icon: <Gauge className="size-5 text-emerald-500" />,
      },
      {
        label: "Avg Score",
        value: score(data?.averageScore ?? null),
        icon: <Award className="size-5 text-indigo-500" />,
      },
      {
        label: "Avg Turnaround",
        value: days(data?.averageTurnaroundDays ?? null),
        icon: <Clock className="size-5 text-orange-500" />,
      },
      {
        label: "Courses Tracked",
        value: data?.courseCount ?? 0,
        icon: <BookOpen className="size-5 text-sky-500" />,
      },
    ];
  }, [analyticsQuery.data]);

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Course performance and insights"
      />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <AnalyticsFiltersPanel
          filters={filters}
          courseOptions={coursesQuery.data ?? []}
          courseOptionsError={
            coursesQuery.error ? "Unable to load accessible courses." : null
          }
          courseOptionsLoading={coursesQuery.isLoading}
          exportError={exportError}
          isExporting={isExporting}
          onChange={handleFilterChange}
          onExport={handleExport}
        />
        {analyticsQuery.isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading analytics...
            </CardContent>
          </Card>
        ) : analyticsQuery.error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-destructive font-medium">
                Unable to load analytics.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {analyticsQuery.error.message}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((stat) => (
                <Card key={stat.label}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {stat.label}
                        </p>
                        <p className="text-3xl font-medium mt-1">
                          {stat.value}
                        </p>
                      </div>
                      <div>{stat.icon}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <AnalyticsCharts
              courses={analyticsQuery.data?.courses ?? []}
              rubricAverages={analyticsQuery.data?.rubricAverages ?? []}
            />
            {analyticsQuery.data?.generatedAt ? (
              <p className="text-xs text-muted-foreground">
                Updated{" "}
                {formatDistanceToNow(
                  new Date(analyticsQuery.data.generatedAt),
                  {
                    addSuffix: true,
                  },
                )}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
