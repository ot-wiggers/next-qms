import { Node, mergeAttributes } from "@tiptap/react";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ProcessDiagramNode } from "../nodes/ProcessDiagramNode";

const DEFAULT_MERMAID = `graph TD
    A[Start] --> B[Prozessschritt]
    B --> C{Entscheidung}
    C -->|Ja| D[Ergebnis A]
    C -->|Nein| E[Ergebnis B]`;

export const ProcessDiagram = Node.create({
  name: "processDiagram",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      code: { default: DEFAULT_MERMAID },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="process-diagram"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "process-diagram" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ProcessDiagramNode);
  },
});
