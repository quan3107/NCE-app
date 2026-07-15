/**
 * Location: features/analytics/components/AnalyticsCharts.tsx
 * Purpose: Render course and rubric analytics charts.
 * Why: Keeps chart-specific normalization and presentation out of the page controller.
 */
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts@2.15.2";

import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@components/ui/chart";
import type {
  AnalyticsCourseSummary,
  AnalyticsRubricAverage,
} from "@features/analytics/api";

type AnalyticsChartsProps = {
  courses: AnalyticsCourseSummary[];
  rubricAverages: AnalyticsRubricAverage[];
};

const truncateLabel = (value: string) =>
  value.length > 14 ? `${value.slice(0, 14)}…` : value;

export function AnalyticsCharts({
  courses,
  rubricAverages,
}: AnalyticsChartsProps) {
  const courseChartData = useMemo(
    () =>
      courses.map((course) => ({
        name: course.courseTitle,
        // Charts require numbers, while summary cards preserve missing metrics as N/A.
        onTimeRate: course.onTimeRate ?? 0,
        averageScore: course.averageScore ?? 0,
      })),
    [courses],
  );
  const rubricChartData = useMemo(
    () =>
      rubricAverages.map((item) => ({
        criterion: item.criterion,
        averageScore: item.averageScore,
        sampleSize: item.sampleSize,
      })),
    [rubricAverages],
  );

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Course Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {courseChartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              No submissions yet. Analytics will appear after grading starts.
            </div>
          ) : (
            <ChartContainer
              config={{
                onTimeRate: {
                  label: "On-time %",
                  color: "var(--color-chart-1)",
                },
                averageScore: {
                  label: "Avg score",
                  color: "var(--color-chart-2)",
                },
              }}
              className="h-72"
            >
              <BarChart data={courseChartData} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  tickFormatter={truncateLabel}
                />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  dataKey="onTimeRate"
                  fill="var(--color-onTimeRate)"
                  radius={4}
                />
                <Bar
                  dataKey="averageScore"
                  fill="var(--color-averageScore)"
                  radius={4}
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rubric Averages</CardTitle>
        </CardHeader>
        <CardContent>
          {rubricChartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              Rubric insights appear after graded submissions.
            </div>
          ) : (
            <ChartContainer
              config={{
                averageScore: {
                  label: "Average points",
                  color: "var(--color-chart-3)",
                },
              }}
              className="h-72"
            >
              <BarChart data={rubricChartData} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="criterion"
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  tickFormatter={truncateLabel}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  domain={[0, (dataMax: number) => Math.ceil(dataMax + 2)]}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <div className="flex flex-1 justify-between gap-4">
                          <span className="text-muted-foreground">{name}</span>
                          <span className="font-mono font-medium tabular-nums">
                            {Number(value).toFixed(1)}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Bar
                  dataKey="averageScore"
                  fill="var(--color-averageScore)"
                  radius={4}
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
