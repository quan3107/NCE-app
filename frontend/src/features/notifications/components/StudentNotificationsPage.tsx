/**
 * Location: features/notifications/components/StudentNotificationsPage.tsx
 * Purpose: Render the Student Notifications Page component for the Notifications domain.
 * Why: Keeps the feature module organized under the new structure.
 */

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@components/ui/tabs';
import { PageHeader } from '@components/common/PageHeader';
import { useAuthStore } from '@store/authStore';
import { Badge } from '@components/ui/badge';
import { CheckCircle2, Clock, Bell } from 'lucide-react';
import { formatDistanceToNow } from '@lib/utils';
import { toast } from 'sonner@2.0.3';
import { markNotificationsRead, useUserNotifications } from '@features/notifications/api';

export function StudentNotificationsPage() {
  const { currentUser } = useAuthStore();
  const [filter, setFilter] = useState('all');
  const { notifications, isLoading, error } = useUserNotifications(currentUser?.id);

  if (!currentUser) return null;

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
                <TabsTrigger value="graded">Graded</TabsTrigger>
                <TabsTrigger value="due_soon">Due Soon</TabsTrigger>
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
              filteredNotifications.map(notification => (
                <Card key={notification.id} className={notification.read ? 'opacity-60' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`mt-1 ${notification.type === 'graded' ? 'text-green-500' : notification.type === 'due_soon' ? 'text-orange-500' : 'text-blue-500'}`}>
                        {notification.type === 'graded' ? <CheckCircle2 className="size-5" /> : notification.type === 'due_soon' ? <Clock className="size-5" /> : <Bell className="size-5" />}
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
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
