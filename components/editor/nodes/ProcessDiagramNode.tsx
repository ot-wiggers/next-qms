"use client";

import { NodeViewWrapper } from "@tiptap/react";
import { useState, useEffect, useCallback, useId } from "react";
import { Code, Eye, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ProcessDiagramNode({
  node,
  updateAttributes,
  editor,
}: {
  node: any;
  updateAttributes: (attrs: Record<string, any>) => void;
  editor: any;
}) {
  const [showCode, setShowCode] = useState(false);
  const [svgHtml, setSvgHtml] = useState<string>("");
  const [error, setError] = useState<string>("");
  const diagramId = useId().replace(/:/g, "-");
  const isEditable = editor?.isEditable;
  const code = node.attrs.code || "";

  const renderDiagram = useCallback(async () => {
    if (!code.trim()) {
      setSvgHtml("");
      setError("");
      return;
    }
    try {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({ startOnLoad: false, theme: "default" });
      const { svg } = await mermaid.render(`diagram-${diagramId}`, code);
      setSvgHtml(svg);
      setError("");
    } catch (err: any) {
      setError(err.message || "Mermaid-Syntaxfehler");
      setSvgHtml("");
    }
  }, [code, diagramId]);

  useEffect(() => {
    if (!showCode) {
      renderDiagram();
    }
  }, [showCode, renderDiagram]);

  return (
    <NodeViewWrapper>
      <div className="process-diagram-container">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">Prozessdiagramm</span>
          {isEditable && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setShowCode(false)}
                className={!showCode ? "bg-accent" : ""}
              >
                <Eye className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setShowCode(true)}
                className={showCode ? "bg-accent" : ""}
              >
                <Code className="size-3.5" />
              </Button>
            </div>
          )}
        </div>

        {showCode && isEditable ? (
          <textarea
            value={code}
            onChange={(e) => updateAttributes({ code: e.target.value })}
            className="w-full min-h-[120px] p-2 font-mono text-sm bg-muted rounded-md border-none resize-y focus:outline-none"
            placeholder="Mermaid-Diagramm hier eingeben..."
          />
        ) : (
          <>
            {error ? (
              <div className="flex items-center gap-2 text-sm text-destructive p-2">
                <AlertCircle className="size-4" />
                <span>{error}</span>
              </div>
            ) : svgHtml ? (
              <div
                className="overflow-x-auto [&_svg]:max-w-full"
                dangerouslySetInnerHTML={{ __html: svgHtml }}
              />
            ) : (
              <div className="text-sm text-muted-foreground p-2">Kein Diagramm</div>
            )}
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
}
