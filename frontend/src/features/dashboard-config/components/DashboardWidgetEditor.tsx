/**
 * Location: src/features/dashboard-config/components/DashboardWidgetEditor.tsx
 * Purpose: Render a simple dashboard widget personalization editor modal.
 * Why: Supports v1 show/hide and ordering controls without drag-and-drop complexity.
 */

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, RotateCcw } from 'lucide-react';

import { Button } from '@components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@components/ui/dialog';
import { Switch } from '@components/ui/switch';

import type { DashboardWidget } from '../types';

type DashboardWidgetEditorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widgets: DashboardWidget[];
  onSave: (widgets: DashboardWidget[]) => Promise<void>;
  onReset: () => Promise<void>;
  isSaving?: boolean;
  isResetting?: boolean;
};

const byOrder = (left: DashboardWidget, right: DashboardWidget) => left.order - right.order;

function normalizeOrder(widgets: DashboardWidget[]): DashboardWidget[] {
  return widgets.map((widget, index) => ({
    ...widget,
    order: index,
  }));
}

export function DashboardWidgetEditor({
  open,
  onOpenChange,
  widgets,
  onSave,
  onReset,
  isSaving = false,
  isResetting = false,
}: DashboardWidgetEditorProps) {
  const initialWidgets = useMemo(
    () => normalizeOrder([...widgets].sort(byOrder)),
    [widgets],
  );
  const [draftWidgets, setDraftWidgets] = useState<DashboardWidget[]>(initialWidgets);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraftWidgets(initialWidgets);
  }, [initialWidgets, open]);

  const isBusy = isSaving || isResetting;

  const moveWidget = (index: number, direction: -1 | 1) => {
    setDraftWidgets((previous) => {
      const nextIndex = index + direction;

      if (nextIndex < 0 || nextIndex >= previous.length) {
        return previous;
      }

      const copy = [...previous];
      const [selected] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, selected);

      return normalizeOrder(copy);
    });
  };

  const toggleVisibility = (index: number, visible: boolean) => {
    setDraftWidgets((previous) =>
      previous.map((widget, currentIndex) =>
        currentIndex === index ? { ...widget, visible } : widget,
      ),
    );
  };

  const handleSave = async () => {
    try {
      await onSave(draftWidgets);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save dashboard widget preferences.', error);
    }
  };

  const handleReset = async () => {
    try {
      await onReset();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to reset dashboard widget preferences.', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Customize Widgets</DialogTitle>
          <DialogDescription>
            Choose which widgets are visible and set the order they appear on your dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {draftWidgets.map((widget, index) => {
            const canMoveUp = index > 0;
            const canMoveDown = index < draftWidgets.length - 1;

            return (
              <div key={widget.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{widget.label}</p>
                  <p className="text-xs text-muted-foreground">{widget.data_source}</p>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={widget.visible}
                    onCheckedChange={(checked) => toggleVisibility(index, checked)}
                    disabled={isBusy}
                    aria-label={`Toggle ${widget.label}`}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={!canMoveUp || isBusy}
                    onClick={() => moveWidget(index, -1)}
                    aria-label={`Move ${widget.label} up`}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={!canMoveDown || isBusy}
                    onClick={() => moveWidget(index, 1)}
                    aria-label={`Move ${widget.label} down`}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={isBusy}
            className="gap-2"
          >
            <RotateCcw className="size-4" />
            Reset Defaults
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isBusy}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={isBusy}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
