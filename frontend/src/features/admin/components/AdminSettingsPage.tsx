/**
 * Location: features/admin/components/AdminSettingsPage.tsx
 * Purpose: Render the Admin Settings Page component for the Admin domain.
 * Why: Keeps the feature module organized under the new structure.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Switch } from '@components/ui/switch';
import { PageHeader } from '@components/common/PageHeader';

export function AdminSettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="System configuration" />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>User Registration</Label>
                  <p className="text-sm text-muted-foreground">Allow new users to register</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Send system notifications via email</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Maintenance Mode</Label>
                  <p className="text-sm text-muted-foreground">Temporarily disable the platform</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Course Limits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Max Students per Course</Label>
                <Input type="number" defaultValue="50" />
              </div>
              <div className="space-y-2">
                <Label>Max File Upload Size (MB)</Label>
                <Input type="number" defaultValue="10" />
              </div>
            </CardContent>
          </Card>

          <Button>Save Settings</Button>
        </div>
      </div>
    </div>
  );
}








