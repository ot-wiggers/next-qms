"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PRODUCT_STATUSES, RISK_CLASSES, STATUS_LABELS } from "@/lib/types/enums";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useRouter } from "next/navigation";
import { useState, useRef, useCallback } from "react";
import { Plus, Upload, Download, FileJson, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import type { Id } from "../../../../convex/_generated/dataModel";
import { LegacyImportDialog } from "@/components/domain/products/legacy-import-dialog";

interface ProductRow {
  _id: string;
  name: string;
  articleNumber: string;
  riskClass: string;
  status: string;
  manufacturerId?: string;
  departmentId?: string;
}

interface Manufacturer {
  _id: string;
  name: string;
}

interface Department {
  _id: string;
  name: string;
  type: string;
}

interface ImportRow {
  name: string;
  articleNumber: string;
  udi?: string;
  productGroup?: string;
  riskClass: string;
  notes?: string;
  departmentId?: Id<"organizations">;
}

export default function ProductsPage() {
  const { can } = usePermissions();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskClassFilter, setRiskClassFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  // Import dialog state
  const [importOpen, setImportOpen] = useState(false);
  const [legacyImportOpen, setLegacyImportOpen] = useState(false);
  const [importData, setImportData] = useState<ImportRow[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const products = useQuery(api.products.list, {
    status: statusFilter !== "all" ? statusFilter : undefined,
    riskClass: statusFilter !== "all" ? undefined : (riskClassFilter !== "all" ? riskClassFilter : undefined),
    departmentId: departmentFilter !== "all" ? (departmentFilter as Id<"organizations">) : undefined,
  }) as ProductRow[] | undefined;

  const manufacturers = useQuery(api.products.listManufacturers) as Manufacturer[] | undefined;
  const departments = useQuery(api.organizations.list, { type: "department" }) as Department[] | undefined;
  const exportData = useQuery(api.products.exportProducts);

  const importProducts = useMutation(api.products.importProducts);

  const getManufacturerName = (id?: string) => {
    if (!id) return "\u2014";
    const m = (manufacturers ?? []).find((m: Manufacturer) => m._id === id);
    return m?.name ?? "\u2014";
  };

  const getDepartmentName = (id?: string) => {
    if (!id) return "\u2014";
    const d = (departments ?? []).find((d: Department) => d._id === id);
    return d?.name ?? "\u2014";
  };

  // Client-side risk class filter (since API only supports one filter at a time)
  const filteredProducts = (products ?? []).filter((p: ProductRow) => {
    if (riskClassFilter !== "all" && p.riskClass !== riskClassFilter) return false;
    return true;
  });

  // ── Import handling ──────────────────────────────────────────

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);

    try {
      if (file.name.endsWith(".json")) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const rows: ImportRow[] = Array.isArray(parsed) ? parsed : [parsed];
        setImportData(rows);
      } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<ImportRow>(sheet);
        setImportData(rows);
      } else {
        toast.error("Nur JSON und XLSX Dateien werden unterstuetzt.");
        return;
      }
      setImportOpen(true);
    } catch (err) {
      toast.error("Fehler beim Lesen der Datei: " + (err instanceof Error ? err.message : "Unbekannter Fehler"));
    }

    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleImportConfirm = useCallback(async () => {
    if (importData.length === 0) return;

    setIsImporting(true);
    try {
      const result = await importProducts({
        products: importData.map((row) => ({
          name: String(row.name || ""),
          articleNumber: String(row.articleNumber || ""),
          udi: row.udi ? String(row.udi) : undefined,
          productGroup: row.productGroup ? String(row.productGroup) : undefined,
          riskClass: String(row.riskClass || "I"),
          notes: row.notes ? String(row.notes) : undefined,
          departmentId: row.departmentId || undefined,
        })),
      });
      toast.success(`${result.imported} Produkt(e) erfolgreich importiert.`);
      setImportOpen(false);
      setImportData([]);
    } catch (err) {
      toast.error("Import fehlgeschlagen: " + (err instanceof Error ? err.message : "Unbekannter Fehler"));
    } finally {
      setIsImporting(false);
    }
  }, [importData, importProducts]);

  // ── Export handling ──────────────────────────────────────────

  const handleExportJSON = useCallback(() => {
    if (!exportData || exportData.length === 0) {
      toast.error("Keine Produkte zum Exportieren vorhanden.");
      return;
    }
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `produkte-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("JSON-Export heruntergeladen.");
  }, [exportData]);

  const handleExportXLSX = useCallback(() => {
    if (!exportData || exportData.length === 0) {
      toast.error("Keine Produkte zum Exportieren vorhanden.");
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Produkte");
    XLSX.writeFile(workbook, `produkte-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("XLSX-Export heruntergeladen.");
  }, [exportData]);

  // ── Table columns ───────────────────────────────────────────

  const columns: Column<ProductRow>[] = [
    {
      key: "article",
      header: "Art.-Nr.",
      className: "w-[100px]",
      cell: (row) => <code className="text-sm">{row.articleNumber}</code>,
    },
    {
      key: "name",
      header: "Produkt",
      cell: (row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="text-xs text-muted-foreground">
            {getManufacturerName(row.manufacturerId)}
          </p>
        </div>
      ),
    },
    {
      key: "department",
      header: "Abteilung",
      className: "w-[140px]",
      cell: (row) => (
        <span className="text-sm">{getDepartmentName(row.departmentId)}</span>
      ),
    },
    {
      key: "riskClass",
      header: "Klasse",
      className: "w-[80px]",
      cell: (row) => (
        <span className="text-sm font-medium">{row.riskClass}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      className: "w-[100px]",
      cell: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produkte"
        description="Medizinprodukte und Risikoklassifizierung"
        actions={
          <div className="flex items-center gap-2">
            {can("products:create") && (
              <>
                {/* Hidden file input for import */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-1 h-4 w-4" />
                  Import
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLegacyImportOpen(true)}
                >
                  <FileSpreadsheet className="mr-1 h-4 w-4" />
                  Wiggers Excel importieren
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportJSON}
            >
              <FileJson className="mr-1 h-4 w-4" />
              JSON
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportXLSX}
            >
              <FileSpreadsheet className="mr-1 h-4 w-4" />
              XLSX
            </Button>
            {can("products:create") && (
              <Button size="sm" asChild>
                <Link href="/mdr/products/new">
                  <Plus className="mr-1 h-4 w-4" />
                  Neues Produkt
                </Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {PRODUCT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={riskClassFilter} onValueChange={setRiskClassFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Risikoklasse" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Klassen</SelectItem>
            {RISK_CLASSES.map((rc) => (
              <SelectItem key={rc} value={rc}>
                Klasse {rc}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Abteilung" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Abteilungen</SelectItem>
            {(departments ?? []).map((dept) => (
              <SelectItem key={dept._id} value={dept._id}>
                {dept.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={filteredProducts}
        onRowClick={(row) => router.push(`/mdr/products/${row._id}`)}
        emptyMessage="Keine Produkte vorhanden"
      />

      {/* ── Import Preview Dialog ────────────────────────────── */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Produkte importieren</DialogTitle>
            <DialogDescription>
              Datei: {importFileName} &mdash; {importData.length} Produkt(e) erkannt
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-auto flex-1 rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Art.-Nr.</TableHead>
                  <TableHead>UDI</TableHead>
                  <TableHead>Gruppe</TableHead>
                  <TableHead>Klasse</TableHead>
                  <TableHead>Notizen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importData.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-muted-foreground text-xs">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>
                      <code className="text-sm">{row.articleNumber}</code>
                    </TableCell>
                    <TableCell className="text-sm">{row.udi || "\u2014"}</TableCell>
                    <TableCell className="text-sm">{row.productGroup || "\u2014"}</TableCell>
                    <TableCell className="text-sm font-medium">{row.riskClass}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {row.notes || "\u2014"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleImportConfirm} disabled={isImporting || importData.length === 0}>
              {isImporting ? "Importiere..." : `${importData.length} Produkt(e) importieren`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Legacy Import Dialog ──────────────────────────────── */}
      <LegacyImportDialog open={legacyImportOpen} onOpenChange={setLegacyImportOpen} />
    </div>
  );
}
