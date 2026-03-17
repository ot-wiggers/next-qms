"use client";

import { useState, useCallback, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
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
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LegacyRow {
  name: string;
  manufacturer: string;
  productGroup?: string;
  riskClass: string;
  ceMarkPresent: boolean;
  instructionsPresent: boolean;
  docPresent: boolean;
  regulatoryBasis: string;
  externalUrl?: string;
  issuedAt?: number;
  validUntil?: number;
  notes?: string;
}

function excelDateToTimestamp(val: any): number | undefined {
  if (!val) return undefined;
  if (val instanceof Date) return val.getTime();
  if (typeof val === "number") {
    // Excel serial date
    return new Date((val - 25569) * 86400000).getTime();
  }
  const parsed = Date.parse(String(val));
  return isNaN(parsed) ? undefined : parsed;
}

export function LegacyImportDialog({ open, onOpenChange }: Props) {
  const [rows, setRows] = useState<LegacyRow[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const [fileName, setFileName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importLegacy = useMutation(api.products.importLegacyProducts);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setFileName(file.name);

      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, {
          header: 1,
          defval: "",
        });

        // Skip row 0 (date header) and row 1 (column headers), process from row 2
        const parsed: LegacyRow[] = [];
        let skipped = 0;

        for (let i = 2; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || !Array.isArray(row)) continue;

          const name = String(row[3] ?? "").trim();
          if (!name) {
            skipped++;
            continue;
          }

          const manufacturer = String(row[1] ?? "").trim();
          const productGroupRaw = row[2];
          const productGroup = productGroupRaw !== "" && productGroupRaw != null
            ? String(productGroupRaw)
            : undefined;

          const ceStr = String(row[6] ?? "").toLowerCase().trim();
          const instrStr = String(row[7] ?? "").toLowerCase().trim();
          const docStr = String(row[8] ?? "").toLowerCase().trim();

          const basisRaw = String(row[9] ?? "").trim();
          let regulatoryBasis = "MDR";
          if (basisRaw.toLowerCase().includes("richtlinie")) {
            regulatoryBasis = "DIRECTIVE";
          }

          const externalUrl = String(row[10] ?? "").trim() || undefined;
          const issuedAt = excelDateToTimestamp(row[11]);
          const validUntil = excelDateToTimestamp(row[12]);
          const notes = String(row[13] ?? "").trim() || undefined;

          parsed.push({
            name,
            manufacturer,
            productGroup,
            riskClass: "I",
            ceMarkPresent: ceStr === "ja",
            instructionsPresent: instrStr === "ja",
            docPresent: docStr === "ja",
            regulatoryBasis,
            externalUrl,
            issuedAt,
            validUntil,
            notes,
          });
        }

        setRows(parsed);
        setSkippedCount(skipped);
      } catch (err) {
        toast.error(
          "Fehler beim Lesen der Datei: " +
            (err instanceof Error ? err.message : "Unbekannter Fehler")
        );
      }

      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    []
  );

  const handleImportConfirm = useCallback(async () => {
    if (rows.length === 0) return;

    setIsImporting(true);
    try {
      const result = await importLegacy({ products: rows });
      toast.success(
        `${(result as any).imported ?? rows.length} Produkt(e) erfolgreich importiert.`
      );
      onOpenChange(false);
      setRows([]);
      setSkippedCount(0);
      setFileName("");
    } catch (err) {
      toast.error(
        "Import fehlgeschlagen: " +
          (err instanceof Error ? err.message : "Unbekannter Fehler")
      );
    } finally {
      setIsImporting(false);
    }
  }, [rows, importLegacy, onOpenChange]);

  // Summary stats
  const uniqueManufacturers = new Set(rows.map((r) => r.manufacturer).filter(Boolean));
  const docCount = rows.filter((r) => r.docPresent).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Wiggers Excel importieren</DialogTitle>
          <DialogDescription>
            {rows.length > 0
              ? `${rows.length} Produkte, ${uniqueManufacturers.size} Hersteller, ${docCount} Konformitaetserklaerungen`
              : "Bitte eine Excel-Datei (.xlsx, .xls) auswaehlen"}
            {skippedCount > 0 && ` — ${skippedCount} Zeile(n) ohne Produktname uebersprungen`}
          </DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Excel-Datei auswaehlen
            </Button>
            {fileName && (
              <p className="text-sm text-muted-foreground">Datei: {fileName}</p>
            )}
          </div>
        ) : (
          <div className="overflow-auto flex-1 rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">#</TableHead>
                  <TableHead>Hersteller</TableHead>
                  <TableHead>Produkt</TableHead>
                  <TableHead>Klasse</TableHead>
                  <TableHead>CE</TableHead>
                  <TableHead>Grundlage</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => {
                  const valid = !!row.name && !!row.manufacturer;
                  return (
                    <TableRow
                      key={idx}
                      className={valid ? "bg-green-50/50" : "bg-red-50/50"}
                    >
                      <TableCell className="text-muted-foreground text-xs">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.manufacturer || "\u2014"}
                      </TableCell>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-sm">{row.riskClass}</TableCell>
                      <TableCell className="text-sm">
                        {row.ceMarkPresent ? "Ja" : "Nein"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.regulatoryBasis === "MDR" ? "MDR" : "Richtlinie"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {valid ? (
                          <span className="text-green-700">Bereit</span>
                        ) : (
                          <span className="text-red-700">Unvollstaendig</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setRows([]);
              setSkippedCount(0);
              setFileName("");
            }}
          >
            Abbrechen
          </Button>
          {rows.length > 0 && (
            <Button onClick={handleImportConfirm} disabled={isImporting || rows.length === 0}>
              {isImporting ? "Importiere..." : `${rows.length} Produkt(e) importieren`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
