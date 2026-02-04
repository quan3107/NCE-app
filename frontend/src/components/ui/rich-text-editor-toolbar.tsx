/**
 * Location: frontend/src/components/ui/rich-text-editor-toolbar.tsx
 * Purpose: Provide the toolbar and link dialog for the RichTextEditor.
 * Why: Keep the editor component focused and within the file size guideline.
 */

import * as React from 'react';
import type { Editor } from '@tiptap/react';
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Link as LinkIcon, Undo, Redo, Trash2 } from 'lucide-react';
import { cn } from './utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { Input } from './input';
import { Button } from './button';
import { Label } from './label';

interface RichTextEditorToolbarProps {
  editor: Editor;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}

function ToolbarButton({ onClick, isActive, disabled, children, title }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'disabled:pointer-events-none disabled:opacity-50',
        isActive && 'bg-accent text-accent-foreground',
      )}
    >
      {children}
    </button>
  );
}

export function RichTextEditorToolbar({ editor }: RichTextEditorToolbarProps) {
  const [isLinkDialogOpen, setIsLinkDialogOpen] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState('');
  const [isEditingLink, setIsEditingLink] = React.useState(false);

  const openLinkDialog = React.useCallback(() => {
    const previousUrl = editor.getAttributes('link').href as string;
    setLinkUrl(previousUrl || '');
    setIsEditingLink(!!previousUrl);
    setIsLinkDialogOpen(true);
  }, [editor]);

  const saveLink = React.useCallback(() => {
    if (linkUrl.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      let finalUrl = linkUrl.trim();
      if (!/^https?:\/\//i.test(finalUrl) && !/^mailto:/i.test(finalUrl)) {
        finalUrl = `https://${finalUrl}`;
      }
      editor.chain().focus().extendMarkRange('link').setLink({ href: finalUrl }).run();
    }

    setIsLinkDialogOpen(false);
    setLinkUrl('');
  }, [editor, linkUrl]);

  const removeLink = React.useCallback(() => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setIsLinkDialogOpen(false);
    setLinkUrl('');
  }, [editor]);

  const handleDialogClose = React.useCallback((open: boolean) => {
    if (!open) {
      setIsLinkDialogOpen(false);
      setLinkUrl('');
    }
  }, []);

  return (
    <div className="border-b border-border px-2 py-1 flex flex-wrap items-center gap-0.5">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Bold (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Italic (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title="Underline (Ctrl+U)"
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>

      <div className="mx-1 h-4 w-px bg-border" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Bullet List"
      >
        <List className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Numbered List"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>

      <div className="mx-1 h-4 w-px bg-border" />

      <ToolbarButton
        onClick={openLinkDialog}
        isActive={editor.isActive('link')}
        title="Add Link"
      >
        <LinkIcon className="h-4 w-4" />
      </ToolbarButton>

      <Dialog open={isLinkDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{isEditingLink ? 'Edit Link' : 'Add Link'}</DialogTitle>
            <DialogDescription>
              Enter the URL for the link. Links will open in a new tab.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveLink();
                  }
                  if (e.key === 'Escape') {
                    handleDialogClose(false);
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            {isEditingLink && (
              <Button
                type="button"
                variant="destructive"
                onClick={removeLink}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogClose(false)}
              >
                Cancel
              </Button>
              <Button type="button" onClick={saveLink}>
                {isEditingLink ? 'Save' : 'Add Link'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mx-1 h-4 w-px bg-border" />

      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo"
      >
        <Undo className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo"
      >
        <Redo className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}
