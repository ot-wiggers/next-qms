"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import {
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
  ListTodo,
  Table,
  Quote,
  Minus,
  FileText,
  Paperclip,
  Info,
  GitBranch,
  TableOfContents,
} from "lucide-react";
import type { SlashCommandItem } from "./extensions/slash-command";

const iconMap: Record<string, React.ElementType> = {
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
  ListTodo,
  Table,
  Quote,
  Minus,
  FileText,
  Paperclip,
  Info,
  GitBranch,
  TableOfContents,
};

interface SlashMenuProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

export const SlashMenu = forwardRef<{ onKeyDown: (props: { event: KeyboardEvent }) => boolean }, SlashMenuProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) command(item);
      },
      [items, command],
    );

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const onKeyDown = useCallback(
      ({ event }: { event: KeyboardEvent }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
      [items.length, selectedIndex, selectItem],
    );

    useImperativeHandle(ref, () => ({ onKeyDown }));

    if (items.length === 0) return null;

    // Group items by category
    const grouped: Record<string, SlashCommandItem[]> = {};
    for (const item of items) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }

    let flatIndex = 0;

    return (
      <div className="z-50 w-72 rounded-lg border bg-popover p-1 shadow-md">
        {Object.entries(grouped).map(([category, categoryItems]) => (
          <div key={category}>
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              {category}
            </div>
            {categoryItems.map((item) => {
              const currentIndex = flatIndex++;
              const Icon = iconMap[item.icon] ?? FileText;
              return (
                <button
                  key={item.title}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                    currentIndex === selectedIndex
                      ? "bg-accent text-accent-foreground"
                      : "text-popover-foreground hover:bg-accent/50"
                  }`}
                  onClick={() => selectItem(currentIndex)}
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{item.title}</span>
                    <span className="text-xs text-muted-foreground">{item.description}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  },
);

SlashMenu.displayName = "SlashMenu";
