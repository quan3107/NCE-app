/**
 * Location: features/profile/components/StudentProfilePage.tsx
 * Purpose: Render the Student Profile Page component for the Profile domain.
 * Why: Keeps the feature module organized under the new structure.
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

export function StudentProfilePage() {
  const { currentUser } = useAuthStore();
  const [editing, setEditing] = useState(false);

  if (!currentUser) return null;

  return (
    <div>
      <PageHeader
        title="Profile"
        description="Manage your account settings"
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
              <CardTitle>Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive updates via email</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Assignment Reminders</Label>
                  <p className="text-sm text-muted-foreground">Get reminders 24h before due dates</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Grade Notifications</Label>
                  <p className="text-sm text-muted-foreground">Notify when assignments are graded</p>
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










