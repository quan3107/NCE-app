/** Paste regressions cover clipboard-context validation and the application's TipTap formatting. */
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Schema } from '@tiptap/pm/model';
import { EditorState } from '@tiptap/pm/state';
import { EditorView } from '@tiptap/pm/view';
import { RichTextEditor } from '../src/components/ui/rich-text-editor';

afterEach(cleanup);

it('validates clipboard context attributes while preserving valid context', () => {
  const schema = new Schema({
    nodes: {
      doc: { content: 'block+' },
      paragraph: {
        group: 'block',
        content: 'text*',
        toDOM: () => ['p', 0],
        parseDOM: [{ tag: 'p' }],
      },
      wrapper: {
        group: 'block',
        content: 'paragraph+',
        attrs: { note: { default: '', validate: 'string' } },
        toDOM: (node) => ['section', { 'data-note': node.attrs.note }, 0],
      },
      text: {},
    },
  });
  const host = document.body.appendChild(document.createElement('div'));
  let context: unknown;
  const view = new EditorView(host, {
    state: EditorState.create({ schema }),
    handlePaste: (_view, _event, slice) => {
      context = slice.content.firstChild?.attrs.note;
      return true;
    },
  });
  try {
    const paste = (note: unknown) => {
      const html = document.createElement('p');
      html.textContent = 'Clipboard text';
      html.setAttribute('data-pm-slice', `1 1 ${JSON.stringify(['wrapper', { note }])}`);
      context = undefined;
      // jsdom lacks ClipboardEvent; the public API accepts an explicit paste event.
      view.pasteHTML(html.outerHTML, new Event('paste') as ClipboardEvent);
      return context;
    };
    expect(paste(['img', { src: 'x', onerror: 'window.pasteAttack = true' }])).toBeUndefined();
    expect(paste({ unexpected: 'attribute object' })).toBeUndefined();
    expect(paste('valid note')).toBe('valid note');
  } finally {
    view.destroy();
    host.remove();
  }
});

it('preserves formatted HTML and plain-text paste through the actual rich text editor', async () => {
  const onChange = vi.fn();
  render(<RichTextEditor value="" onChange={onChange} aria-label="Paste editor" />);
  const editor = await screen.findByRole('textbox', { name: 'Paste editor' });
  const paste = (html: string, text: string) =>
    fireEvent.paste(editor, {
      clipboardData: { getData: (type: string) => (type === 'text/html' ? html : text), files: [] },
    });
  paste(
    '<p><strong>Bold text</strong> <a href="https://example.com">safe link</a></p>',
    'Bold text safe link',
  );
  await waitFor(() => expect(onChange).toHaveBeenCalled());
  expect(editor.querySelector('strong')?.textContent).toBe('Bold text');
  expect(editor.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
  paste('', 'Plain text');
  await waitFor(() => expect(editor.textContent).toContain('Plain text'));
});
