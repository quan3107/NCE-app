/**
 * Location: src/features/dashboard-config/types.ts
 * Purpose: Define shared contracts and runtime guards for dashboard widget config APIs.
 * Why: Keeps dashboard pages and config hooks aligned on a validated payload shape.
 */

import type { DashboardRole } from '@lib/backend-schema';

export type DashboardWidgetPosition = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type DashboardWidgetValueFormat = string;

export type DashboardWidgetDefault = {
  id: string;
  type: string;
  label: string;
  icon_name: string;
  color: string;
  data_source: string;
  value_format: DashboardWidgetValueFormat;
  default_order: number;
  default_visible: boolean;
  position: DashboardWidgetPosition;
};

export type DashboardWidget = {
  id: string;
  type: string;
  label: string;
  icon_name: string;
  color: string;
  data_source: string;
  value_format: DashboardWidgetValueFormat;
  visible: boolean;
  order: number;
  position: DashboardWidgetPosition;
};

export type DashboardWidgetDefaultsResponse = {
  role: DashboardRole;
  version: string;
  widgets: DashboardWidgetDefault[];
};

export type MyDashboardConfigResponse = {
  role: DashboardRole;
  version: string;
  personalized: boolean;
  widgets: DashboardWidget[];
};

export type UpdateMyDashboardConfigRequest = {
  widgets: Array<{
    id: string;
    visible: boolean;
    order: number;
    position: DashboardWidgetPosition;
  }>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isPosition = (value: unknown): value is DashboardWidgetPosition => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.x === 'number' &&
    typeof value.y === 'number' &&
    typeof value.w === 'number' &&
    typeof value.h === 'number'
  );
};

const isDashboardRole = (value: unknown): value is DashboardRole =>
  typeof value === 'string' && value.length > 0;

const isDashboardWidgetDefault = (value: unknown): value is DashboardWidgetDefault => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    typeof value.label === 'string' &&
    typeof value.icon_name === 'string' &&
    typeof value.color === 'string' &&
    typeof value.data_source === 'string' &&
    typeof value.value_format === 'string' &&
    typeof value.default_order === 'number' &&
    typeof value.default_visible === 'boolean' &&
    isPosition(value.position)
  );
};

const isDashboardWidget = (value: unknown): value is DashboardWidget => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    typeof value.label === 'string' &&
    typeof value.icon_name === 'string' &&
    typeof value.color === 'string' &&
    typeof value.data_source === 'string' &&
    typeof value.value_format === 'string' &&
    typeof value.visible === 'boolean' &&
    typeof value.order === 'number' &&
    isPosition(value.position)
  );
};

export const isDashboardWidgetDefaultsResponse = (
  value: unknown,
): value is DashboardWidgetDefaultsResponse => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isDashboardRole(value.role) &&
    typeof value.version === 'string' &&
    Array.isArray(value.widgets) &&
    value.widgets.every(isDashboardWidgetDefault)
  );
};

export const isMyDashboardConfigResponse = (
  value: unknown,
): value is MyDashboardConfigResponse => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isDashboardRole(value.role) &&
    typeof value.version === 'string' &&
    typeof value.personalized === 'boolean' &&
    Array.isArray(value.widgets) &&
    value.widgets.every(isDashboardWidget)
  );
};
