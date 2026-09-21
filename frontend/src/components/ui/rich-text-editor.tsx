/*
 * File: frontend/src/components/ui/rich-text-editor.tsx
 * Purpose: A reusable rich text editor component using TipTap for rich text editing.
 * Why: Provides a consistent, minimal rich text editing experience with bold, italic,
 *      underline, lists, and links across the application.
 */

import * as React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { cn } from './utils';
import { normalizeRichText } from '@lib/rich-text';
import { RichTextEditorToolbar } from './rich-text-editor-toolbar';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start typing...',
  className,
  'aria-label': ariaLabel = 'Rich text',
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        linkOnPaste: true,
        protocols: ['http', 'https', 'mailto'],
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: normalizeRichText(value),
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const text = editor.getText().trim();
      // Store empty string if no content
      onChange(text === '' ? '' : html);
    },
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-label': ariaLabel,
        'aria-multiline': 'true',
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
          'min-h-500 px-3 py-2',
        ),
      },
    },
  });

  // Sync external value changes
  React.useEffect(() => {
    if (!editor) return;

    const currentContent = editor.getHTML();
    const normalizedValue = normalizeRichText(value);

    // Only update if different and editor is not focused (to avoid cursor jumps)
    if (currentContent !== normalizedValue && !editor.isFocused) {
      editor.commands.setContent(normalizedValue);
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div
      className={cn(
        'border-input bg-input-background rounded-md border min-h-600',
        'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
        'transition-[color,box-shadow]',
        className,
      )}
    >
      <RichTextEditorToolbar editor={editor} />

      {/* Editor Content */}
      <EditorContent
        editor={editor}
        className="rich-text-editor-content"
      />
    </div>
  );
}

export default RichTextEditor;
