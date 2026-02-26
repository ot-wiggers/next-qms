import { Node, mergeAttributes } from "@tiptap/react";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CalloutBlockNode } from "../nodes/CalloutBlockNode";

export const CalloutBlock = Node.create({
  name: "calloutBlock",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      type: {
        default: "info",
        parseHTML: (element) => element.getAttribute("data-type") || "info",
        renderHTML: (attributes) => ({ "data-type": attributes.type }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-node-type="callout-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-node-type": "callout-block", class: "callout-block" }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutBlockNode);
  },
});
