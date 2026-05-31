/**
 * Location: features/courses/management/components/tabs/AnnouncementsTab.tsx
 * Purpose: Display announcements and entry points for creating new course updates.
 * Why: Extract tab content to keep TeacherCourseManagement.tsx concise.
 */

import { Alert, AlertDescription } from '@components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Megaphone } from 'lucide-react';

export function AnnouncementsTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Course Announcements</CardTitle>
          <CardDescription>Communicate important updates to all students</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <AnnouncementCard
              title="Welcome to the course!"
              message="Please review the syllabus and complete the first assignment by Friday."
              footer="Posted 3 days ago"
            />
            <AnnouncementCard
              title="Office Hours This Week"
              message="I'll be available for office hours on Thursday from 2-4 PM. Book a slot in advance."
              footer="Posted 1 week ago"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type AnnouncementCardProps = {
  title: string;
  message: string;
  footer: string;
};

function AnnouncementCard({ title, message, footer }: AnnouncementCardProps) {
  return (
    <Alert>
      <Megaphone className="size-4" />
      <AlertDescription>
        <div>
          <p className="font-medium mb-1">{title}</p>
          <p className="text-sm text-muted-foreground">{message}</p>
          <p className="text-xs text-muted-foreground mt-2">{footer}</p>
        </div>
      </AlertDescription>
    </Alert>
  );
}
