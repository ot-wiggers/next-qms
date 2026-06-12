"use client";

import { Button } from "@/components/ui/button";

/** Ja/Nein-Umschalter mit drittem Zustand „unbeantwortet" (erneuter Klick hebt auf) */
export function YesNoField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (v: boolean | undefined) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
      <span className="flex-1 text-sm">{label}</span>
      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          variant={value === true ? "default" : "outline"}
          disabled={disabled}
          onClick={() => onChange(value === true ? undefined : true)}
        >
          Ja
        </Button>
        <Button
          type="button"
          size="sm"
          variant={value === false ? "destructive" : "outline"}
          disabled={disabled}
          onClick={() => onChange(value === false ? undefined : false)}
        >
          Nein
        </Button>
      </div>
    </div>
  );
}
