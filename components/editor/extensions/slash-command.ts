import { Extension } from "@tiptap/react";
import { type Editor, type Range } from "@tiptap/react";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: string;
  category: string;
  command: (props: { editor: Editor; range: Range }) => void;
}

export const defaultSlashItems: SlashCommandItem[] = [
  // Text
  {
    title: "Überschrift 1",
    description: "Große Überschrift",
    icon: "Heading1",
    category: "Text",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run();
    },
  },
  {
    title: "Überschrift 2",
    description: "Mittlere Überschrift",
    icon: "Heading2",
    category: "Text",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run();
    },
  },
  {
    title: "Überschrift 3",
    description: "Kleine Überschrift",
    icon: "Heading3",
    category: "Text",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run();
    },
  },
  {
    title: "Überschrift 4",
    description: "Kleinste Überschrift",
    icon: "Heading4",
    category: "Text",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 4 }).run();
    },
  },
  // Listen
  {
    title: "Aufzählung",
    description: "Einfache Aufzählungsliste",
    icon: "List",
    category: "Listen",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "Nummerierte Liste",
    description: "Nummerierte Liste",
    icon: "ListOrdered",
    category: "Listen",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: "Checkliste",
    description: "Aufgaben-Checkliste",
    icon: "ListTodo",
    category: "Listen",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  // Medien
  {
    title: "Tabelle",
    description: "Tabelle einfügen",
    icon: "Table",
    category: "Medien",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    },
  },
  {
    title: "Zitat",
    description: "Blockzitat",
    icon: "Quote",
    category: "Medien",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setBlockquote().run();
    },
  },
  {
    title: "Trennlinie",
    description: "Horizontale Trennlinie",
    icon: "Minus",
    category: "Medien",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  // QMS items are added by custom extensions
];

const SlashCommand = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: SlashCommandItem }) => {
          props.command({ editor, range });
        },
      } as Partial<SuggestionOptions>,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export default SlashCommand;
