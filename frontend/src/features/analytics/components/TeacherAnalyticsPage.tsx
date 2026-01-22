/**
 * Location: features/analytics/components/TeacherAnalyticsPage.tsx
 * Purpose: Render the Teacher Analytics Page component for the Analytics domain.
 * Why: Keeps the feature module organized under the new structure.
 */

import { useMemo } from 'react';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis } from 'recharts@2.15.2';
import { Award, BookOpen, Clock, Gauge } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { PageHeader } from '@components/common/PageHeader';
import { formatDistanceToNow } from '@lib/utils';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@components/ui/chart';
import { useTeacherAnalyticsQuery } from '@features/analytics/api';

export function TeacherAnalyticsPage() {
  const analyticsQuery = useTeacherAnalyticsQuery();

  const stats = useMemo(() => {
    const data = analyticsQuery.data;
    const formatPercent = (value: number | null) =>
      value === null ? 'N/A' : `${value.toFixed(1)}%`;
    const formatScore = (value: number | null) =>
      value === null ? 'N/A' : value.toFixed(1);
    const formatDays = (value: number | null) =>
      value === null ? 'N/A' : `${value.toFixed(1)} days`;

    return [
      { label: 'On-time Rate', value: formatPercent(data?.onTimeRate ?? null), icon: <Gauge className="size-5 text-emerald-500" /> },
      { label: 'Avg Score', value: formatScore(data?.averageScore ?? null), icon: <Award className="size-5 text-indigo-500" /> },
      { label: 'Avg Turnaround', value: formatDays(data?.averageTurnaroundDays ?? null), icon: <Clock className="size-5 text-orange-500" /> },
      { label: 'Courses Tracked', value: data?.courseCount ?? 0, icon: <BookOpen className="size-5 text-sky-500" /> },
    ];
  }, [analyticsQuery.data]);

  const courseChartData = useMemo(() => {
    const courses = analyticsQuery.data?.courses ?? [];
    // Charts require numeric values, so normalize null metrics to 0 while summaries show N/A.
    return courses.map(course => ({
      name: course.courseTitle,
      onTimeRate: course.onTimeRate ?? 0,
      averageScore: course.averageScore ?? 0,
    }));
  }, [analyticsQuery.data]);

  const rubricChartData = useMemo(() => {
    const rubrics = analyticsQuery.data?.rubricAverages ?? [];
    return rubrics.map(item => ({
      criterion: item.criterion,
      averageScore: item.averageScore,
      sampleSize: item.sampleSize,
    }));
  }, [analyticsQuery.data]);

  const truncateLabel = (value: string) =>
    value.length > 14 ? `${value.slice(0, 14)}…` : value;

  return (
    <div>
      <PageHeader title="Analytics" description="Course performance and insights" />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {analyticsQuery.isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading analytics...
            </CardContent>
          </Card>
        ) : analyticsQuery.error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-destructive font-medium">Unable to load analytics.</p>
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
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                        <p className="text-3xl font-medium mt-1">{stat.value}</p>
                      </div>
                      <div>{stat.icon}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

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
                        onTimeRate: { label: 'On-time %', color: 'var(--color-chart-1)' },
                        averageScore: { label: 'Avg score', color: 'var(--color-chart-2)' },
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
                        <YAxis
                          domain={[0, 100]}
                          tickLine={false}
                          axisLine={false}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar dataKey="onTimeRate" fill="var(--color-onTimeRate)" radius={4} />
                        <Bar dataKey="averageScore" fill="var(--color-averageScore)" radius={4} />
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
                        averageScore: { label: 'Average points', color: 'var(--color-chart-3)' },
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
                              formatter={(value, name, item) => (
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
                        <Bar dataKey="averageScore" fill="var(--color-averageScore)" radius={4} />
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {analyticsQuery.data?.generatedAt ? (
              <p className="text-xs text-muted-foreground">
                Updated {formatDistanceToNow(new Date(analyticsQuery.data.generatedAt), { addSuffix: true })}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}









