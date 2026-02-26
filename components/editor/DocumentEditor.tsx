"use client";

import { useState, useCallback } from "react";
import { useEditor, EditorContent, type Editor as TiptapEditor, ReactRenderer } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Link } from "@tiptap/extension-link";
import { Image } from "@tiptap/extension-image";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Placeholder } from "@tiptap/extension-placeholder";
import { TextAlign } from "@tiptap/extension-text-align";
import { Highlight } from "@tiptap/extension-highlight";
import { Underline } from "@tiptap/extension-underline";
import { Typography } from "@tiptap/extension-typography";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { Toolbar } from "./Toolbar";
import SlashCommand, { defaultSlashItems, type SlashCommandItem } from "./extensions/slash-command";
import { SlashMenu } from "./SlashMenu";
import { DocumentReference } from "./extensions/document-reference";
import { AttachmentBlock } from "./extensions/attachment-block";
import { CalloutBlock } from "./extensions/callout-block";
import { ProcessDiagram } from "./extensions/process-diagram";
import { TableOfContents } from "./extensions/table-of-contents";
import { DocumentPickerDialog } from "./DocumentPickerDialog";

interface DocumentEditorProps {
  content?: any; // Tiptap JSON
  onChange?: (json: any) => void;
  editable?: boolean;
  extraSlashItems?: SlashCommandItem[];
}

export function DocumentEditor({
  content,
  onChange,
  editable = true,
  extraSlashItems = [],
}: DocumentEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const allSlashItems: SlashCommandItem[] = [
    ...defaultSlashItems,
    {
      title: "Dokument-Referenz",
      description: "Verweis auf ein anderes QMS-Dokument",
      icon: "FileText",
      category: "QMS",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        setPickerOpen(true);
      },
    },
    ...extraSlashItems,
  ];

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Link.configure({ openOnClick: false }),
      Image,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: "Schreiben Sie hier oder tippen Sie / für Befehle...",
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight,
      Underline,
      Typography,
      DocumentReference,
      AttachmentBlock,
      CalloutBlock,
      ProcessDiagram,
      TableOfContents,
      SlashCommand.configure({
        suggestion: {
          items: ({ query }: { query: string }) => {
            return allSlashItems.filter((item) =>
              item.title.toLowerCase().includes(query.toLowerCase()),
            );
          },
          render: () => {
            let component: ReactRenderer<{ onKeyDown: (props: { event: KeyboardEvent }) => boolean }> | null = null;
            let popup: TippyInstance[] | null = null;

            return {
              onStart: (props: any) => {
                component = new ReactRenderer(SlashMenu, {
                  props,
                  editor: props.editor,
                });

                if (!props.clientRect) return;

                popup = tippy("body", {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: "manual",
                  placement: "bottom-start",
                });
              },
              onUpdate: (props: any) => {
                component?.updateProps(props);
                if (popup?.[0] && props.clientRect) {
                  popup[0].setProps({
                    getReferenceClientRect: props.clientRect,
                  });
                }
              },
              onKeyDown: (props: any) => {
                if (props.event.key === "Escape") {
                  popup?.[0]?.hide();
                  return true;
                }
                return component?.ref?.onKeyDown(props) ?? false;
              },
              onExit: () => {
                popup?.[0]?.destroy();
                component?.destroy();
              },
            };
          },
        },
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor: e }) => {
      onChange?.(e.getJSON());
    },
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tiptap prose prose-sm max-w-none focus:outline-none",
      },
    },
  });

  const handleDocumentSelect = useCallback(
    (doc: {
      documentId: string;
      documentCode: string;
      documentTitle: string;
      documentStatus: string;
    }) => {
      if (!editor) return;
      editor
        .chain()
        .focus()
        .insertContent({
          type: "documentReference",
          attrs: {
            documentId: doc.documentId,
            documentCode: doc.documentCode,
            documentTitle: doc.documentTitle,
            documentStatus: doc.documentStatus,
          },
        })
        .run();
    },
    [editor],
  );

  if (!editor) return null;

  return (
    <div className="border rounded-lg overflow-hidden">
      {editable && <Toolbar editor={editor} />}
      <EditorContent editor={editor} className="p-4 min-h-[400px]" />
      {editable && (
        <DocumentPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelect={handleDocumentSelect}
        />
      )}
    </div>
  );
}

export function useDocumentEditor() {
  // Utility hook for accessing editor externally if needed
  return null;
}
