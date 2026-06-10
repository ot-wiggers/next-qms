import { z } from "zod";

export const createCapaSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich").max(200),
  description: z.string().max(3000).optional(),
  responsible: z.string().max(200).optional(),
  effectivenessCriterion: z.string().max(1000).optional(),
  capaType: z.enum(["CORRECTIVE", "PREVENTIVE"]),
  sourceType: z.enum(["AUDIT", "COMPLAINT", "TRAINING", "RISK", "QUALITY_OBJECTIVE", "MGMT_REVIEW", "MANUAL"]),
  dueAt: z.number().optional(),
});

export const capaMeasureSchema = z.object({
  description: z.string().min(1, "Beschreibung ist erforderlich").max(2000),
  dueAt: z.number().optional(),
});

export const effectivenessSchema = z.object({
  effectivenessResult: z.enum(["EFFECTIVE", "INEFFECTIVE"]),
  effectivenessNote: z.string().min(1, "Begründung ist erforderlich").max(2000),
});

export type CreateCapaInput = z.infer<typeof createCapaSchema>;
export type CapaMeasureInput = z.infer<typeof capaMeasureSchema>;
export type EffectivenessInput = z.infer<typeof effectivenessSchema>;
