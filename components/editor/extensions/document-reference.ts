import { Node, mergeAttributes } from "@tiptap/react";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { DocumentReferenceNode } from "../nodes/DocumentReferenceNode";

export const DocumentReference = Node.create({
  name: "documentReference",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      documentId: { default: null },
      documentCode: { default: "" },
      documentTitle: { default: "" },
      documentStatus: { default: "DRAFT" },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="document-reference"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-type": "document-reference" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DocumentReferenceNode);
  },
});
