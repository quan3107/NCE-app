/**
 * Location: features/notifications/components/StudentNotificationsPage.tsx
 * Purpose: Render the Student Notifications Page component for the Notifications domain.
 * Why: Keeps the feature module organized under the new structure.
 */

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@components/ui/tabs';
import { PageHeader } from '@components/common/PageHeader';
import { useAuthStore } from '@store/authStore';
import { Badge } from '@components/ui/badge';
import { CheckCircle2, Bell } from 'lucide-react';
import { formatDistanceToNow } from '@lib/utils';
import { toast } from 'sonner@2.0.3';
import { markNotificationsRead, useUserNotifications } from '@features/notifications/api';
import {
  getNotificationTypeLabel,
  useNotificationTypes,
} from '@features/notifications/config.api';
import {
  getNotificationAccentClass,
  getNotificationIconNode,
} from '@features/notifications/notificationVisuals';

export function StudentNotificationsPage() {
  const { currentUser } = useAuthStore();
  const [filter, setFilter] = useState('all');
  const { notifications, isLoading, error } = useUserNotifications(currentUser?.id);
  const notificationRole =
    currentUser?.role === 'teacher' || currentUser?.role === 'admin'
      ? currentUser.role
      : 'student';
  const notificationTypesQuery = useNotificationTypes(notificationRole);

  if (!currentUser) return null;

  const configuredTypes = notificationTypesQuery.data ?? [];
  const typeConfigById = useMemo(
    () => new Map(configuredTypes.map(type => [type.id, type])),
    [configuredTypes],
  );

  const filterTypes = useMemo(() => {
    const types = configuredTypes.map(type => ({
      id: type.id,
      label: type.label,
      sortOrder: type.sortOrder,
    }));
    const known = new Set(types.map(type => type.id));

    // Keep unknown backend types filterable even before config rows are added.
    for (const notification of notifications) {
      if (known.has(notification.type)) {
        continue;
      }
      types.push({
        id: notification.type,
        label: getNotificationTypeLabel(notification.type, configuredTypes),
        sortOrder: Number.MAX_SAFE_INTEGER,
      });
      known.add(notification.type);
    }

    return types.sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.label.localeCompare(right.label),
    );
  }, [configuredTypes, notifications]);

  useEffect(() => {
    const validFilters = new Set(['all', 'unread', ...filterTypes.map(type => type.id)]);
    if (!validFilters.has(filter)) {
      setFilter('all');
    }
  }, [filter, filterTypes]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const filteredNotifications = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter(n => !n.read);
    return notifications.filter(n => n.type === filter);
  }, [notifications, filter]);

  const handleMarkAllRead = () => {
    markNotificationsRead({ userId: currentUser.id });
    toast.success('All notifications marked as read');
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Stay updated on assignments and grades"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0 || isLoading}
          >
            <CheckCircle2 className="mr-2 size-4" />
            Mark All Read
          </Button>
        }
      />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <Card>
          <CardContent className="pt-6">
            <Tabs value={filter} onValueChange={setFilter}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="unread">Unread</TabsTrigger>
                {filterTypes.map(type => (
                  <TabsTrigger key={type.id} value={type.id}>
                    {type.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading notifications...
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center text-destructive">
              Unable to load notifications. Try again later.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredNotifications.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Bell className="size-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="mb-2">No Notifications</h3>
                  <p className="text-muted-foreground">You're all caught up!</p>
                </CardContent>
              </Card>
            ) : (
              filteredNotifications.map(notification => {
                const typeConfig = typeConfigById.get(notification.type);

                return (
                  <Card key={notification.id} className={notification.read ? 'opacity-60' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div
                          className={`mt-1 ${getNotificationAccentClass(typeConfig?.accent, notification.type)}`}
                        >
                          {getNotificationIconNode(typeConfig?.icon, notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="mb-1">{notification.title}</h4>
                          <p className="text-sm text-muted-foreground">{notification.message}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                          </p>
                        </div>
                        {!notification.read && (
                          <Badge variant="default" className="flex-shrink-0">New</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
