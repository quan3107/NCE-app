/**
 * Location: src/features/dashboard-config/components/DashboardStatsGrid.tsx
 * Purpose: Render dashboard stat cards from backend widget definitions and metric maps.
 * Why: Removes duplicated stat-card rendering logic across student, teacher, and admin dashboards.
 */

import { Card, CardContent } from '@components/ui/card';
import { getIcon } from '@features/navigation/utils/iconMap';

import type { DashboardMetricValue } from '../valueResolvers';
import type { DashboardWidget } from '../types';
import {
  formatDashboardWidgetValue,
  resolveDashboardWidgetValue,
} from '../valueResolvers';

type DashboardStatsGridProps = {
  widgets: DashboardWidget[];
  metrics: Record<string, DashboardMetricValue>;
  gridClassName: string;
};

export function DashboardStatsGrid({ widgets, metrics, gridClassName }: DashboardStatsGridProps) {
  const visibleWidgets = widgets
    .filter((widget) => widget.visible)
    .sort((left, right) => left.order - right.order);

  return (
    <div className={gridClassName}>
      {visibleWidgets.map((widget) => {
        const Icon = getIcon(widget.icon_name);
        const rawValue = resolveDashboardWidgetValue(widget.data_source, metrics);
        const value = formatDashboardWidgetValue(rawValue, widget.value_format);

        return (
          <Card key={widget.id}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{widget.label}</p>
                  <p className="text-3xl font-medium mt-1">{value}</p>
                </div>
                <div className={widget.color}>
                  <Icon className="size-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
