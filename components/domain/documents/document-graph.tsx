"use client";

import { useCallback, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/shared/status-badge";
import { DOCUMENT_TYPE_LABELS } from "@/lib/types/enums";

const TYPE_COLORS: Record<string, string> = {
  qm_handbook: "#3b82f6",
  process_description: "#8b5cf6",
  work_instruction: "#f59e0b",
  form_template: "#10b981",
};

const LINK_TYPE_LABELS: Record<string, string> = {
  references: "referenziert",
  supersedes: "ersetzt",
  implements: "implementiert",
  related: "verwandt",
};

interface DocumentForGraph {
  _id: string;
  documentCode: string;
  title?: string;
  documentType: string;
  status: string;
  isArchived: boolean;
}

interface DocumentLink {
  _id: string;
  sourceDocumentId: string;
  targetDocumentId: string;
  linkType: string;
}

export function DocumentGraph() {
  const router = useRouter();
  const documents = useQuery(api.documents.list, {}) as
    | DocumentForGraph[]
    | undefined;
  const links = useQuery(api.documentLinks.listAll) as
    | DocumentLink[]
    | undefined;

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!documents || !links) return { initialNodes: [], initialEdges: [] };

    const cols = 3;
    const xGap = 280;
    const yGap = 120;

    const nodes: Node[] = documents.map((doc, i) => ({
      id: doc._id,
      position: { x: (i % cols) * xGap + 50, y: Math.floor(i / cols) * yGap + 50 },
      data: {
        label: doc.title ?? doc.documentCode,
        code: doc.documentCode,
        type: doc.documentType,
        status: doc.status,
      },
      style: {
        background: "#fff",
        border: `2px solid ${TYPE_COLORS[doc.documentType] ?? "#94a3b8"}`,
        borderRadius: "8px",
        padding: "8px 12px",
        fontSize: "12px",
        minWidth: "200px",
      },
    }));

    const edges: Edge[] = links.map((link) => ({
      id: link._id,
      source: link.sourceDocumentId,
      target: link.targetDocumentId,
      label: LINK_TYPE_LABELS[link.linkType] ?? link.linkType,
      animated: link.linkType === "supersedes",
      style: { stroke: "#94a3b8" },
      labelStyle: { fontSize: "10px", fill: "#71717a" },
    }));

    return { initialNodes: nodes, initialEdges: edges };
  }, [documents, links]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes/edges when data changes
  useMemo(() => {
    if (initialNodes.length > 0) {
      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_: any, node: Node) => {
      router.push(`/documents/${node.id}`);
    },
    [router]
  );

  if (!documents || !links) {
    return <p className="text-sm text-muted-foreground">Laden...</p>;
  }

  if (documents.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine Dokumente vorhanden</p>;
  }

  return (
    <div className="h-[600px] w-full rounded-lg border bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(n) => TYPE_COLORS[n.data?.type as string] ?? "#94a3b8"}
          style={{ height: 80, width: 120 }}
        />
      </ReactFlow>
      <div className="flex gap-4 px-4 py-2 border-t text-xs text-muted-foreground">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-sm"
              style={{ background: color }}
            />
            {DOCUMENT_TYPE_LABELS[type as keyof typeof DOCUMENT_TYPE_LABELS] ?? type}
          </div>
        ))}
      </div>
    </div>
  );
}
