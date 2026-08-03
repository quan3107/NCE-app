/**
 * Location: features/profile/components/TeacherProfilePage.tsx
 * Purpose: Render the Teacher Profile Page component for instructor account settings.
 * Why: Gives teachers a dedicated profile route without reusing the student UI verbatim.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';
import { Switch } from '@components/ui/switch';
import { PageHeader } from '@components/common/PageHeader';
import { ProfileDetailsCard } from './ProfileDetailsCard';
import {
  useMyNotificationPreferences,
  useResetMyNotificationPreferences,
  useSaveMyNotificationPreferences,
} from '@features/notifications/preferences.api';
import { toast } from 'sonner@2.0.3';

export function TeacherProfilePage() {
  const preferencesQuery = useMyNotificationPreferences();
  const savePreferencesMutation = useSaveMyNotificationPreferences();
  const resetPreferencesMutation = useResetMyNotificationPreferences();

  const preferenceTypes = preferencesQuery.data?.types ?? [];
  const isSavingPreferences =
    savePreferencesMutation.isPending || resetPreferencesMutation.isPending;

  const handleTogglePreference = async (id: string, enabled: boolean) => {
    try {
      await savePreferencesMutation.mutateAsync({
        types: [{ id, enabled }],
      });
    } catch (error) {
      console.error('[notifications] failed to save teacher preference', {
        id,
        enabled,
        error,
      });
      toast.error('Unable to save notification preference. Please try again.');
    }
  };

  const handleResetPreferences = async () => {
    try {
      await resetPreferencesMutation.mutateAsync();
      toast.success('Notification preferences reset to defaults.');
    } catch (error) {
      console.error('[notifications] failed to reset teacher preferences', { error });
      toast.error('Unable to reset preferences. Please try again.');
    }
  };

  return (
    <div>
      <PageHeader
        title="Profile"
        description="Manage your instructor account settings"
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl space-y-6">
          <ProfileDetailsCard />

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <CardTitle>Teaching Preferences</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetPreferences}
                  disabled={isSavingPreferences}
                >
                  Reset
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {preferencesQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">
                  Loading notification preferences...
                </p>
              ) : preferencesQuery.error ? (
                <p className="text-sm text-destructive">
                  Unable to load notification preferences right now.
                </p>
              ) : preferenceTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No notification types are available for this role.
                </p>
              ) : (
                preferenceTypes.map((type) => (
                  <div key={type.id} className="flex items-center justify-between">
                    <div>
                      <Label>{type.label}</Label>
                      <p className="text-sm text-muted-foreground">{type.description}</p>
                    </div>
                    <Switch
                      checked={type.enabled}
                      onCheckedChange={(enabled) =>
                        void handleTogglePreference(type.id, enabled)
                      }
                      disabled={isSavingPreferences}
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
