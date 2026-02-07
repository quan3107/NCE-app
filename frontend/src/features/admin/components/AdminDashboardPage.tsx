/**
 * Location: features/admin/components/AdminDashboardPage.tsx
 * Purpose: Render the Admin Dashboard Page component for the Admin domain.
 * Why: Keeps the feature module organized under the new structure.
 */

import { Card, CardContent } from '@components/ui/card';
import { PageHeader } from '@components/common/PageHeader';
import { useState } from 'react';
import { RefreshCw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@components/ui/button';
import { useAdminDashboardMetrics } from '@features/admin/api';
import { DashboardStatsGrid } from '@features/dashboard-config/components/DashboardStatsGrid';
import { DashboardWidgetEditor } from '@features/dashboard-config/components/DashboardWidgetEditor';
import type { DashboardWidget } from '@features/dashboard-config/types';
import { useDashboardConfig } from '@features/dashboard-config/useDashboardConfig';

export function AdminDashboardPage() {
  const [isWidgetEditorOpen, setIsWidgetEditorOpen] = useState(false);
  const dashboardConfig = useDashboardConfig();
  const { metrics, isLoading, error, refetch } = useAdminDashboardMetrics();
  const widgetMetrics = {
    'admin.users_total': metrics.users,
    'admin.courses_total': metrics.courses,
    'admin.enrollments_total': metrics.enrollments,
    'admin.assignments_total': metrics.assignments,
  };

  const handleSaveWidgetConfig = async (widgets: DashboardWidget[]) => {
    await dashboardConfig.saveConfig({
      widgets: widgets.map((widget) => ({
        id: widget.id,
        visible: widget.visible,
        order: widget.order,
        position: widget.position,
      })),
    });
  };

  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        description="System overview and management"
        actions={
          <div className="flex items-center gap-2">
            <Card>
              <CardContent className="py-2 px-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => refetch()}
                  disabled={isLoading}
                >
                  <RefreshCw className="size-4" />
                  Refresh
                </button>
              </CardContent>
            </Card>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setIsWidgetEditorOpen(true)}
              disabled={!dashboardConfig.config}
            >
              <SlidersHorizontal className="size-4" />
              Customize
            </Button>
          </div>
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
          <DashboardStatsGrid
            widgets={dashboardConfig.config?.widgets ?? []}
            metrics={widgetMetrics}
            gridClassName="grid sm:grid-cols-4 gap-4"
          />
        )}
      </div>

      {dashboardConfig.config && (
        <DashboardWidgetEditor
          open={isWidgetEditorOpen}
          onOpenChange={setIsWidgetEditorOpen}
          widgets={dashboardConfig.config.widgets}
          onSave={handleSaveWidgetConfig}
          onReset={dashboardConfig.resetConfig}
          isSaving={dashboardConfig.isSaving}
          isResetting={dashboardConfig.isResetting}
        />
      )}
    </div>
  );
}









