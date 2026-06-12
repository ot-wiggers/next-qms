"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Check, PenLine, RotateCcw } from "lucide-react";

/** Unterschriften-Feld: öffnet einen Canvas-Dialog, liefert PNG-DataURL über onChange */
export function SignaturePad({
  value,
  onChange,
  label = "Unterschrift Prüfer/in",
  disabled,
}: {
  value: string;
  onChange: (dataUrl: string) => void;
  label?: string;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [isEmpty, setIsEmpty] = useState(!value);

  // Canvas vorbereiten + vorhandene Unterschrift laden, sobald der Dialog offen ist
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (value.startsWith("data:image")) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = value;
      setIsEmpty(false);
    } else {
      setIsEmpty(true);
    }
  }, [open, value]);

  function pointFromEvent(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const source = "touches" in e ? e.touches[0] : e;
    if (!source) return null;
    // Skalierung: CSS-Breite ≠ Canvas-Pixel — umrechnen, sonst versetzte Striche
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (source.clientX - rect.left) * scaleX, y: (source.clientY - rect.top) * scaleY };
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    const ctx = canvasRef.current?.getContext("2d");
    const p = pointFromEvent(e);
    if (!ctx || !p) return;
    drawingRef.current = true;
    setIsEmpty(false);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    const p = pointFromEvent(e);
    if (!ctx || !p) return;
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function end() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    onChange("");
  }

  return (
    <div>
      <Label className="mb-1 block">{label}</Label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md border p-3 text-sm text-muted-foreground hover:bg-muted/50 disabled:cursor-default"
      >
        {value ? (
          <>
            <Check className="h-4 w-4 text-green-600" />
            <span className="font-medium text-foreground">Unterschrift vorhanden</span>
          </>
        ) : (
          <>
            <PenLine className="h-4 w-4" />
            Zum Unterschreiben klicken
          </>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Unterschrift</DialogTitle></DialogHeader>
          <div className="rounded-md border-2 p-1">
            <canvas
              ref={canvasRef}
              width={440}
              height={180}
              className="h-auto w-full cursor-crosshair touch-none rounded bg-white"
              onMouseDown={start}
              onMouseMove={move}
              onMouseUp={end}
              onMouseLeave={end}
              onTouchStart={(e) => { e.preventDefault(); start(e); }}
              onTouchMove={(e) => { e.preventDefault(); move(e); }}
              onTouchEnd={end}
            />
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Unterschrift mit Maus oder Finger zeichnen
          </p>
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={clear} disabled={isEmpty}>
              <RotateCcw className="mr-2 h-4 w-4" /> Löschen
            </Button>
            <Button type="button" onClick={() => setOpen(false)}>Fertig</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
