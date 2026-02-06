/**
 * Location: src/features/dashboard-config/valueResolvers.ts
 * Purpose: Resolve and format dashboard widget values from page-level metric maps.
 * Why: Keeps widget rendering generic while each dashboard route computes its own metrics.
 */

import type { DashboardWidgetValueFormat } from './types';

export type DashboardMetricValue = number | string | null;

export function resolveDashboardWidgetValue(
  dataSource: string,
  metrics: Record<string, DashboardMetricValue>,
): DashboardMetricValue {
  if (!(dataSource in metrics)) {
    return null;
  }

  return metrics[dataSource];
}

export function formatDashboardWidgetValue(
  value: DashboardMetricValue,
  valueFormat: DashboardWidgetValueFormat,
): string | number {
  if (value === null || value === undefined) {
    return 'N/A';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (!Number.isFinite(value)) {
    return 'N/A';
  }

  if (valueFormat === 'percent') {
    return `${value.toFixed(1)}%`;
  }

  if (valueFormat === 'days') {
    return `${value.toFixed(1)} days`;
  }

  return value;
}
