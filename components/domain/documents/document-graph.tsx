"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useRouter } from "next/navigation";
import { DOCUMENT_TYPE_LABELS } from "@/lib/types/enums";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const TYPE_COLORS: Record<string, string> = {
  qm_handbook: "#3b82f6",
  process_description: "#8b5cf6",
  work_instruction: "#f59e0b",
  form_template: "#10b981",
};

const LINK_TYPE_LABELS: Record<string, string> = {
  references: "referenziert",
  supersedes: "ersetzt",
  implements: "gehört zu",
  related: "verwandt",
};

// Zeilen-Bänder je Dokumenttyp (Handbuch oben → Formblätter unten)
const TYPE_ORDER = ["qm_handbook", "process_description", "work_instruction", "form_template"];
const CHAPTERS = ["1–3", "4", "5", "6", "7", "8"];
const NODE_W = 210;
const COL_GAP = 60;
const ROW_H = 58;
const PER_ROW = 2; // Knoten nebeneinander je Kapitel-Spalte

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

/** ISO-Kapitel aus dem Dokumentcode („PA 7.4.3“ → 7, „QMH 1+2“ → 1–3, „AA OT-01“ → 7) */
export function chapterOf(code: string): string {
  const m = code.match(/(\d+)/);
  if (/^(AA (OT|RT|SA)|FO [BW])/.test(code)) return "7";
  if (/^AA VG/.test(code)) return "4";
  if (/^FO L/.test(code)) return "6";
  if (!m) return "1–3";
  const n = Number(m[1]);
  return n <= 3 ? "1–3" : String(n);
}

export function DocumentGraph() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const documents = useQuery(api.documents.list, {}) as DocumentForGraph[] | undefined;
  const links = useQuery(api.documentLinks.listAll) as DocumentLink[] | undefined;

  const [chapter, setChapter] = useState<string>("alle");
  const [showRefs, setShowRefs] = useState(true);

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!documents || !links) return { initialNodes: [], initialEdges: [] };

    // Bei Kapitelfilter: Dokumente des Kapitels + direkt verknüpfte Nachbarn
    const inChapter = new Set(
      documents.filter((d) => chapter === "alle" || chapterOf(d.documentCode) === chapter).map((d) => d._id),
    );
    const visibleLinks = links.filter(
      (l) =>
        (showRefs || l.linkType !== "references") &&
        (inChapter.has(l.sourceDocumentId) || inChapter.has(l.targetDocumentId)),
    );
    const visible = new Set(inChapter);
    if (chapter !== "alle") {
      for (const l of visibleLinks) { visible.add(l.sourceDocumentId); visible.add(l.targetDocumentId); }
    }
    const docs = documents
      .filter((d) => visible.has(d._id))
      .sort((a, b) => a.documentCode.localeCompare(b.documentCode, "de", { numeric: true }));

    // Layout: Spalte = Kapitel, Band = Dokumenttyp, im Band PER_ROW Knoten nebeneinander
    const colWidth = PER_ROW * NODE_W + COL_GAP;
    // nur Kapitel mit sichtbaren Dokumenten als Spalten (kompakt bei Filter)
    const cols = CHAPTERS.filter((c) => docs.some((d) => chapterOf(d.documentCode) === c));
    const bandRows: Record<string, number> = {};
    for (const t of TYPE_ORDER) {
      bandRows[t] = Math.max(
        1,
        ...cols.map((c) => Math.ceil(docs.filter((d) => d.documentType === t && chapterOf(d.documentCode) === c).length / PER_ROW)),
      );
    }
    const bandTop: Record<string, number> = {};
    let y = 0;
    for (const t of TYPE_ORDER) { bandTop[t] = y; y += bandRows[t] * ROW_H + 40; }

    const counters: Record<string, number> = {};
    const nodes: Node[] = docs.map((doc) => {
      const c = chapterOf(doc.documentCode);
      const key = `${c}|${doc.documentType}`;
      const i = counters[key] ?? 0;
      counters[key] = i + 1;
      const faded = chapter !== "alle" && !inChapter.has(doc._id);
      return {
        id: doc._id,
        position: {
          x: cols.indexOf(c) * colWidth + (i % PER_ROW) * NODE_W,
          y: (bandTop[doc.documentType] ?? 0) + Math.floor(i / PER_ROW) * ROW_H,
        },
        data: { label: `${doc.documentCode} · ${doc.title ?? ""}`, type: doc.documentType },
        style: {
          background: "var(--card)",
          color: "var(--card-foreground)",
          border: `2px solid ${TYPE_COLORS[doc.documentType] ?? "#94a3b8"}`,
          borderRadius: "8px",
          padding: "4px 8px",
          fontSize: "11px",
          width: NODE_W - 16,
          opacity: faded ? 0.5 : 1,
        },
      };
    });

    const edges: Edge[] = visibleLinks.map((link) => {
      const hierarchy = link.linkType === "implements";
      return {
        id: link._id,
        source: link.sourceDocumentId,
        target: link.targetDocumentId,
        label: chapter === "alle" ? undefined : LINK_TYPE_LABELS[link.linkType] ?? link.linkType,
        animated: link.linkType === "supersedes",
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
        style: hierarchy
          ? { stroke: "#64748b", strokeWidth: 1.5 }
          : { stroke: "#94a3b8", strokeDasharray: "4 3", opacity: chapter === "alle" ? 0.35 : 0.8 },
        labelStyle: { fontSize: "10px", fill: "var(--muted-foreground)" },
      };
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [documents, links, chapter, showRefs]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Kapitel:</span>
        {["alle", ...CHAPTERS].map((c) => (
          <Button key={c} size="sm" variant={chapter === c ? "default" : "outline"} onClick={() => setChapter(c)}>
            {c === "alle" ? "Alle" : c}
          </Button>
        ))}
        <label className="ml-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showRefs} onChange={(e) => setShowRefs(e.target.checked)} />
          Querverweise anzeigen
        </label>
        <span className="ml-auto text-xs text-muted-foreground">
          {nodes.length} Dokumente · {edges.length} Verknüpfungen
        </span>
      </div>
      <div className="h-[70vh] min-h-[500px] w-full rounded-lg border bg-background">
        <ReactFlow
          key={`${chapter}|${showRefs}`}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          colorMode={resolvedTheme === "dark" ? "dark" : "light"}
          fitView
          fitViewOptions={{ padding: 0.1 }}
          minZoom={0.1}
        >
          <Background />
          <Controls />
          <MiniMap
            nodeColor={(n) => TYPE_COLORS[n.data?.type as string] ?? "#94a3b8"}
            style={{ height: 80, width: 120 }}
          />
        </ReactFlow>
      </div>
      <div className="flex flex-wrap gap-4 px-1 text-xs text-muted-foreground">
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm" style={{ background: color }} />
              {DOCUMENT_TYPE_LABELS[type as keyof typeof DOCUMENT_TYPE_LABELS] ?? type}
            </div>
          ))}
          <span>— gehört zu (Hierarchie)</span>
          <span>- - - referenziert</span>
          <span>Spalten = ISO-Kapitel 1–3, 4 … 8</span>
      </div>
    </div>
  );
}
