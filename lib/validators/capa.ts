import { z } from "zod";
import {
  CAPA_TYPES,
  CAPA_SOURCE_TYPES,
  EFFECTIVENESS_RESULTS,
} from "@/lib/types/enums";

export const createCapaSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich").max(200),
  description: z.string().max(3000).optional(),
  responsible: z.string().max(200).optional(),
  effectivenessCriterion: z.string().max(1000).optional(),
  capaType: z.enum(CAPA_TYPES, { message: "Ungültiger CAPA-Typ" }),
  sourceType: z.enum(CAPA_SOURCE_TYPES, { message: "Ungültige Quelle" }),
  dueAt: z.number().min(1).optional(),
});

export const capaMeasureSchema = z.object({
  description: z.string().min(1, "Beschreibung ist erforderlich").max(2000),
  dueAt: z.number().min(1).optional(),
});

export const effectivenessSchema = z.object({
  effectivenessResult: z.enum(EFFECTIVENESS_RESULTS, { message: "Ungültiges Ergebnis" }),
  effectivenessNote: z.string().min(1, "Begründung ist erforderlich").max(2000),
});

export type CreateCapaInput = z.infer<typeof createCapaSchema>;
export type CapaMeasureInput = z.infer<typeof capaMeasureSchema>;
export type EffectivenessInput = z.infer<typeof effectivenessSchema>;
