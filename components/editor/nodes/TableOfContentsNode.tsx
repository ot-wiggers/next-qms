"use client";

import { NodeViewWrapper } from "@tiptap/react";
import { useEffect, useState, useCallback } from "react";
import { List } from "lucide-react";

interface HeadingItem {
  level: number;
  text: string;
  id: string;
}

export function TableOfContentsNode({ editor }: { editor: any }) {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);

  const extractHeadings = useCallback(() => {
    if (!editor) return;
    const items: HeadingItem[] = [];
    const doc = editor.state.doc;

    doc.descendants((node: any, pos: number) => {
      if (node.type.name === "heading") {
        items.push({
          level: node.attrs.level,
          text: node.textContent,
          id: `heading-${pos}`,
        });
      }
    });

    setHeadings(items);
  }, [editor]);

  useEffect(() => {
    extractHeadings();
    if (editor) {
      editor.on("update", extractHeadings);
      return () => {
        editor.off("update", extractHeadings);
      };
    }
  }, [editor, extractHeadings]);

  const scrollToHeading = (id: string) => {
    const pos = parseInt(id.replace("heading-", ""), 10);
    if (editor && !isNaN(pos)) {
      editor.chain().focus().setTextSelection(pos).run();
      // Scroll into view
      const domAtPos = editor.view.domAtPos(pos);
      if (domAtPos?.node) {
        const element = domAtPos.node instanceof HTMLElement ? domAtPos.node : domAtPos.node.parentElement;
        element?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  };

  return (
    <NodeViewWrapper>
      <div className="toc-container" contentEditable={false}>
        <div className="flex items-center gap-2 mb-2">
          <List className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Inhaltsverzeichnis</span>
        </div>
        {headings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine Überschriften gefunden. Fügen Sie Überschriften hinzu, um ein
            Inhaltsverzeichnis zu erstellen.
          </p>
        ) : (
          <ol className="list-none space-y-0.5">
            {headings.map((heading, index) => (
              <li
                key={index}
                style={{ paddingLeft: `${(heading.level - 1) * 1}rem` }}
              >
                <button
                  onClick={() => scrollToHeading(heading.id)}
                  className="text-sm text-primary hover:underline text-left"
                >
                  {heading.text || "Unbenannte Überschrift"}
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </NodeViewWrapper>
  );
}
