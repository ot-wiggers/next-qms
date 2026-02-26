"use client";

import { diffLines, type Change } from "diff";
import { cn } from "@/lib/utils";

interface VersionDiffProps {
  oldText: string;
  newText: string;
  oldLabel: string;
  newLabel: string;
}

export function VersionDiff({
  oldText,
  newText,
  oldLabel,
  newLabel,
}: VersionDiffProps) {
  const changes = diffLines(oldText, newText);

  return (
    <div className="rounded-md border overflow-hidden">
      <div className="flex border-b bg-muted/50 text-xs font-medium">
        <div className="flex-1 px-3 py-2 border-r text-red-700">{oldLabel}</div>
        <div className="flex-1 px-3 py-2 text-green-700">{newLabel}</div>
      </div>
      <div className="flex text-sm font-mono">
        {/* Left (old) */}
        <div className="flex-1 border-r overflow-x-auto">
          {changes.map((change, i) => (
            <DiffBlock key={i} change={change} side="old" />
          ))}
        </div>
        {/* Right (new) */}
        <div className="flex-1 overflow-x-auto">
          {changes.map((change, i) => (
            <DiffBlock key={i} change={change} side="new" />
          ))}
        </div>
      </div>
    </div>
  );
}

function DiffBlock({ change, side }: { change: Change; side: "old" | "new" }) {
  const lines = change.value.split("\n").filter((_, i, arr) =>
    // Remove trailing empty line from split
    i < arr.length - 1 || arr[i] !== ""
  );

  if (change.added && side === "old") {
    // Placeholder lines on old side for additions
    return (
      <>
        {lines.map((_, i) => (
          <div key={i} className="px-3 py-0.5 bg-muted/30 min-h-[1.5rem]" />
        ))}
      </>
    );
  }

  if (change.removed && side === "new") {
    // Placeholder lines on new side for removals
    return (
      <>
        {lines.map((_, i) => (
          <div key={i} className="px-3 py-0.5 bg-muted/30 min-h-[1.5rem]" />
        ))}
      </>
    );
  }

  if (change.added && side === "new") {
    return (
      <>
        {lines.map((line, i) => (
          <div key={i} className="px-3 py-0.5 bg-green-50 text-green-900 dark:bg-green-950/30 dark:text-green-200">
            <span className="select-none text-green-600 mr-2">+</span>
            {line}
          </div>
        ))}
      </>
    );
  }

  if (change.removed && side === "old") {
    return (
      <>
        {lines.map((line, i) => (
          <div key={i} className="px-3 py-0.5 bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-200">
            <span className="select-none text-red-600 mr-2">-</span>
            {line}
          </div>
        ))}
      </>
    );
  }

  // Unchanged
  return (
    <>
      {lines.map((line, i) => (
        <div key={i} className="px-3 py-0.5 text-muted-foreground">
          <span className="select-none mr-2">&nbsp;</span>
          {line}
        </div>
      ))}
    </>
  );
}
