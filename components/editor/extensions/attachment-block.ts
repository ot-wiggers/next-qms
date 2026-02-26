import { Node, mergeAttributes } from "@tiptap/react";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { AttachmentBlockNode } from "../nodes/AttachmentBlockNode";

export const AttachmentBlock = Node.create({
  name: "attachmentBlock",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      fileId: { default: null },
      fileName: { default: "" },
      fileSize: { default: 0 },
      uploadedAt: { default: 0 },
      uploadedBy: { default: "" },
      fileUrl: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="attachment-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "attachment-block" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AttachmentBlockNode);
  },
});
