/**
 * Location: features/profile/components/TeacherProfilePage.tsx
 * Purpose: Render the Teacher Profile Page component for instructor account settings.
 * Why: Gives teachers a dedicated profile route without reusing the student UI verbatim.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Switch } from '@components/ui/switch';
import { PageHeader } from '@components/common/PageHeader';
import { useAuthStore } from '@store/authStore';
import { Edit } from 'lucide-react';

export function TeacherProfilePage() {
  const { currentUser } = useAuthStore();
  const [editing, setEditing] = useState(false);

  if (!currentUser) return null;

  return (
    <div>
      <PageHeader
        title="Profile"
        description="Manage your instructor account settings"
        actions={
          <Button variant="outline" onClick={() => setEditing(!editing)}>
            <Edit className="mr-2 size-4" />
            {editing ? 'Cancel' : 'Edit Profile'}
          </Button>
        }
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-6">
                <div className="size-20 rounded-full bg-gradient-to-br from-[#E6F0FF] to-[#BFD9FF] flex items-center justify-center text-2xl font-medium">
                  {currentUser.name.split(' ').map(n => n[0]).join('')}
                </div>
                {editing && <Button variant="outline" size="sm">Change Photo</Button>}
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={currentUser.name} disabled={!editing} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={currentUser.email} disabled={!editing} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Input value={currentUser.role} disabled className="capitalize" />
              </div>
              {editing && (
                <Button className="w-full">Save Changes</Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Teaching Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Course Updates</Label>
                  <p className="text-sm text-muted-foreground">Notifications about course changes</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Submission Alerts</Label>
                  <p className="text-sm text-muted-foreground">Get alerted when students submit work</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Grading Reminders</Label>
                  <p className="text-sm text-muted-foreground">Weekly reminders for pending grading</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
