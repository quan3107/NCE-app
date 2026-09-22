/** Admin reporting page: explicit scope, coverage and denominators make descriptive metrics interpretable. */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@components/common/PageHeader';
import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { useCoursesQuery } from '@features/courses/api';
import { apiClient } from '@lib/apiClient';
import { useAdminAnalytics, type AdminFilters } from '../admin-api';
import { AdminAnalyticsReport } from './AdminAnalyticsReport';

export function AdminAnalyticsPage() {
  const [params, setParams] = useSearchParams();
  const today = new Date().toISOString().slice(0, 10);
  const filters: AdminFilters = {
    from:
      params.get('from') ??
      new Date(new Date(`${today}T00:00:00Z`).getTime() - 29 * 86400000)
        .toISOString()
        .slice(0, 10),
    to: params.get('to') ?? today,
    ...(params.get('courseId') ? { courseId: params.get('courseId')! } : {}),
  };
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<{
    url: string;
    scope: string;
  } | null>(null);
  const scope = JSON.stringify(filters);
  useEffect(
    () => () => {
      if (prepared)
        window.setTimeout(() => URL.revokeObjectURL(prepared.url), 60000);
    },
    [prepared],
  );
  const report = useAdminAnalytics(filters);
  const courses = useCoursesQuery();
  const exportCsv = async () => {
    setExporting(true);
    setExportError(null);
    setPrepared(null);
    try {
      const blob = await apiClient<Blob>('/api/v1/analytics/admin', {
        auth: 'required',
        params: { ...filters, format: 'csv' },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(blob);
      setPrepared({ url, scope });
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'admin-analytics.csv';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'Export failed. Please retry.',
      );
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform analytics"
        description="Participation, progress and results across the platform"
      />
      <Card>
        <CardContent className="pt-6">
          <form
            key={scope}
            className="flex flex-wrap items-end gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              setExportError(null);
              const form = new FormData(event.currentTarget);
              const courseId = String(
                form.get('courseId') ?? filters.courseId ?? '',
              );
              setParams({
                from: String(form.get('from')),
                to: String(form.get('to')),
                ...(courseId ? { courseId } : {}),
              });
            }}
          >
            <div>
              <Label htmlFor="admin-from">From (UTC)</Label>
              <Input
                id="admin-from"
                name="from"
                type="date"
                required
                defaultValue={filters.from}
                max={today}
                disabled={exporting}
              />
            </div>
            <div>
              <Label htmlFor="admin-to">To (UTC, inclusive)</Label>
              <Input
                id="admin-to"
                name="to"
                type="date"
                required
                defaultValue={filters.to}
                max={today}
                disabled={exporting}
              />
            </div>
            <div className="min-w-48">
              <Label htmlFor="admin-course">Course</Label>
              <select
                id="admin-course"
                name="courseId"
                className="block h-9 w-full rounded-md border bg-background px-3 text-sm"
                defaultValue={filters.courseId ?? ''}
                disabled={exporting || courses.isLoading}
              >
                {filters.courseId &&
                  !courses.data?.some((c) => c.id === filters.courseId) && (
                    <option value={filters.courseId}>
                      Selected course (details unavailable)
                    </option>
                  )}
                <option value="">All courses</option>
                {courses.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={report.isFetching || exporting}>
              Apply filters
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={report.isFetching || exporting}
              onClick={() => {
                setPrepared(null);
                void report.refetch();
              }}
            >
              Refresh
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={
                !report.data || report.isFetching || report.isError || exporting
              }
              onClick={() => void exportCsv()}
            >
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
          </form>
          {courses.isError && (
            <p role="alert" className="mt-3">
              Course list unavailable.{' '}
              <button
                className="underline"
                onClick={() => void courses.refetch()}
              >
                Retry course list
              </button>
            </p>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            Default: last 30 UTC calendar days, including today. Maximum: 366
            days. Filters apply after selecting Apply filters.
          </p>
          {exportError && (
            <p role="alert" className="mt-3 text-destructive">
              {exportError}
            </p>
          )}
          {prepared?.scope === scope &&
            !report.isFetching &&
            !report.isError && (
              <p role="status" className="mt-3 text-sm">
                CSV prepared. If the download did not start,{' '}
                <a
                  className="underline"
                  href={prepared.url}
                  download="admin-analytics.csv"
                >
                  download admin-analytics.csv
                </a>
                .
              </p>
            )}
        </CardContent>
      </Card>
      {report.isFetching ? (
        <p role="status">Loading analytics…</p>
      ) : report.isError ? (
        <Card>
          <CardContent className="pt-6">
            <p role="alert">Unable to load analytics: {report.error.message}</p>
            <Button className="mt-3" onClick={() => void report.refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : report.data ? (
        <AdminAnalyticsReport data={report.data} />
      ) : null}
    </div>
  );
}
