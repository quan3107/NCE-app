/**
 * Location: features/admin/components/AdminDashboardPage.tsx
 * Purpose: Render the Admin Dashboard Page component for the Admin domain.
 * Why: Keeps the feature module organized under the new structure.
 */

import { Card, CardContent } from '@components/ui/card';
import { PageHeader } from '@components/common/PageHeader';
import { Users, BookOpen, CheckCircle2, FileText, RefreshCw } from 'lucide-react';
import { useAdminDashboardMetrics } from '@features/admin/api';

export function AdminDashboardPage() {
  const { metrics, isLoading, error, refresh } = useAdminDashboardMetrics();
  const stats = [
    { label: 'Total Users', value: metrics.users, icon: <Users className="size-5" /> },
    { label: 'Courses', value: metrics.courses, icon: <BookOpen className="size-5" /> },
    { label: 'Enrollments', value: metrics.enrollments, icon: <CheckCircle2 className="size-5" /> },
    { label: 'Assignments', value: metrics.assignments, icon: <FileText className="size-5" /> },
  ];

  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        description="System overview and management"
        actions={
          <Card>
            <CardContent className="py-2 px-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => refresh()}
                disabled={isLoading}
              >
                <RefreshCw className="size-4" />
                Refresh
              </button>
            </CardContent>
          </Card>
        }
      />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading dashboard metrics...
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center text-destructive">
              Unable to load dashboard metrics.
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-4 gap-4">
            {stats.map((stat, index) => (
              <Card key={index}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="text-3xl font-medium mt-1">{stat.value}</p>
                    </div>
                    <div className="text-muted-foreground">{stat.icon}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}









