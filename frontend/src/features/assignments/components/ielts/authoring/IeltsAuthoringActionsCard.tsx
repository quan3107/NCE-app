/**
 * Location: features/assignments/components/ielts/authoring/IeltsAuthoringActionsCard.tsx
 * Purpose: Render the publish actions card per Figma design.
 * Why: Keeps action styling aligned with the authoring mockups.
 */

import { Save, Send } from 'lucide-react';

import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';

type IeltsAuthoringActionsCardProps = {
  canSave: boolean;
  isLoading: boolean;
  onSaveDraft: () => void;
  onPublish: () => void;
};

export function IeltsAuthoringActionsCard({
  canSave,
  isLoading,
  onSaveDraft,
  onPublish,
}: IeltsAuthoringActionsCardProps) {
  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium mb-1">Ready to publish?</h4>
            <p className="text-sm text-muted-foreground">Save as draft or publish for students</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onSaveDraft} disabled={!canSave || isLoading}>
              <Save className="mr-2 size-4" />
              Save Draft
            </Button>
            <Button onClick={onPublish} disabled={!canSave || isLoading}>
              <Send className="mr-2 size-4" />
              Publish Assignment
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
