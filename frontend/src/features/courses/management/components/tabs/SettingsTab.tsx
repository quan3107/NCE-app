/**
 * Location: features/courses/management/components/tabs/SettingsTab.tsx
 * Purpose: Render rubric controls and course visibility toggles for teacher management settings.
 * Why: Separating tab markup clarifies the main management screen responsibilities.
 */

import { Button } from '@components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Switch } from '@components/ui/switch';
import { Edit } from 'lucide-react';

import type { RubricHandlers } from '../../hooks/useTeacherCourseManagement';
import type { RubricState } from '../../types';

type SettingsTabProps = {
  rubric: RubricState;
  handlers: RubricHandlers;
  onEditRubric: () => void;
};

export function SettingsTab({ rubric, handlers, onEditRubric }: SettingsTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Grading Rubric</CardTitle>
          <CardDescription>Configure the default rubric for this course</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {rubric.criteria.map((criterion, index) => (
              <div key={criterion.name} className="flex items-center gap-4 p-3 rounded-lg border">
                <div className="flex-1">
                  <p className="font-medium">{criterion.name}</p>
                  <p className="text-sm text-muted-foreground">{criterion.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={criterion.weight}
                    onChange={(event) => handlers.updateWeight(index, parseInt(event.target.value, 10) || 0)}
                    className="w-20 text-center"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-muted-foreground">Total: {rubric.totalWeight}%</p>
            <Button onClick={onEditRubric}>
              <Edit className="mr-2 size-4" />
              Edit Rubric
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Course Visibility</CardTitle>
          <CardDescription>Control who can see and enroll in this course</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <VisibilityToggle
            title="Published"
            description="Make this course visible to students"
            defaultChecked
          />
          <VisibilityToggle
            title="Allow Self-Enrollment"
            description="Students can enroll without invitation"
          />
          <VisibilityToggle
            title="Email Notifications"
            description="Send automatic updates to students"
            defaultChecked
          />
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions for this course</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <DangerRow
            title="Archive Course"
            description="Hide from active courses list"
            actionLabel="Archive"
            variant="outline"
          />
          <DangerRow
            title="Delete Course"
            description="Permanently remove all data"
            actionLabel="Delete"
            variant="destructive"
          />
        </CardContent>
      </Card>
    </div>
  );
}

type VisibilityToggleProps = {
  title: string;
  description: string;
  defaultChecked?: boolean;
};

function VisibilityToggle({ title, description, defaultChecked }: VisibilityToggleProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}

type DangerRowProps = {
  title: string;
  description: string;
  actionLabel: string;
  variant: 'outline' | 'destructive';
};

function DangerRow({ title, description, actionLabel, variant }: DangerRowProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button variant={variant}>{actionLabel}</Button>
    </div>
  );
}
