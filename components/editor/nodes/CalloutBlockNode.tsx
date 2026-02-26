"use client";

import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import { Info, AlertTriangle, AlertCircle, Lightbulb } from "lucide-react";

const calloutConfig = {
  info: { icon: Info, label: "Info" },
  warning: { icon: AlertTriangle, label: "Warnung" },
  danger: { icon: AlertCircle, label: "Achtung" },
  tip: { icon: Lightbulb, label: "Tipp" },
} as const;

const calloutTypes = ["info", "warning", "danger", "tip"] as const;

export function CalloutBlockNode({
  node,
  updateAttributes,
  editor,
}: {
  node: any;
  updateAttributes: (attrs: Record<string, any>) => void;
  editor: any;
}) {
  const calloutType = (node.attrs.type || "info") as keyof typeof calloutConfig;
  const config = calloutConfig[calloutType] || calloutConfig.info;
  const Icon = config.icon;
  const isEditable = editor?.isEditable;

  return (
    <NodeViewWrapper>
      <div className="callout-block" data-type={calloutType}>
        <div className="flex items-start gap-2">
          <div className="flex items-center gap-1 shrink-0 pt-0.5">
            <Icon className="size-4" />
            {isEditable && (
              <select
                contentEditable={false}
                value={calloutType}
                onChange={(e) => updateAttributes({ type: e.target.value })}
                className="text-xs bg-transparent border-none outline-none cursor-pointer opacity-60 hover:opacity-100"
              >
                {calloutTypes.map((t) => (
                  <option key={t} value={t}>
                    {calloutConfig[t].label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <NodeViewContent className="callout-content" />
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
}
