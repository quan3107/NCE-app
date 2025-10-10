/**
 * Location: features/courses/management/components/dialogs/AnnouncementDialog.tsx
 * Purpose: Provide the announcement creation dialog for the teacher management flow.
 * Why: Makes dialog logic reusable and keeps the page component smaller than 300 LOC.
 */

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Switch } from '@components/ui/switch';
import { Textarea } from '@components/ui/textarea';
import { Button } from '@components/ui/button';
import { Send } from 'lucide-react';

type AnnouncementDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  sendEmail: boolean;
  onTitleChange: (value: string) => void;
  onMessageChange: (value: string) => void;
  onSendEmailChange: (value: boolean) => void;
  onSubmit: () => void;
};

export function AnnouncementDialog({
  open,
  onOpenChange,
  title,
  message,
  sendEmail,
  onTitleChange,
  onMessageChange,
  onSendEmailChange,
  onSubmit,
}: AnnouncementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Announcement</DialogTitle>
          <DialogDescription>Send an announcement to all students in this course</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input placeholder="Announcement title" value={title} onChange={(event) => onTitleChange(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              placeholder="Your announcement message..."
              value={message}
              onChange={(event) => onMessageChange(event.target.value)}
              rows={4}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={sendEmail} onCheckedChange={onSendEmailChange} />
            <Label>Also send via email</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit}>
            <Send className="mr-2 size-4" />
            Post Announcement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
