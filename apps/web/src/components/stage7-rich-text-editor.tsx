"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import * as React from "react";

interface Stage7RichTextEditorProps {
  readonly value: Record<string, unknown>;
  readonly onChange: (value: Record<string, unknown>) => void;
}

export function Stage7RichTextEditor({
  value,
  onChange,
}: Stage7RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content:
      Object.keys(value).length > 0 ? value : { type: "doc", content: [] },
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-[10rem] rounded-[20px] border border-[color:var(--line)] bg-black/10 px-4 py-3 text-sm outline-none",
      },
    },
    onUpdate({ editor: nextEditor }) {
      React.startTransition(() => {
        onChange(nextEditor.getJSON() as Record<string, unknown>);
      });
    },
  });

  React.useEffect(() => {
    if (!editor) {
      return;
    }

    const next = Object.keys(value).length > 0 ? value : { type: "doc", content: [] };

    if (JSON.stringify(editor.getJSON()) !== JSON.stringify(next)) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, value]);

  return <EditorContent editor={editor} />;
}
