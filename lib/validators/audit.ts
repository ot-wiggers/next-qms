import { z } from "zod";

export const createAuditSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich").max(200),
  auditYear: z.number().int().min(2020).max(2100),
  auditType: z.enum(["INTERNAL", "EXTERNAL"]),
  auditTeam: z.string().max(500).optional(),
  basis: z.string().max(1000).optional(),
  location: z.string().max(500).optional(),
  reportingPeriod: z.string().max(200).optional(),
  plannedFor: z.string().max(50).optional(),
});

export const updateAnswerSchema = z.object({
  rating: z
    .enum(["KONFORM", "ABWEICHUNG", "FESTSTELLUNG", "EMPFEHLUNG", "NICHT_ANWENDBAR"])
    .optional(),
  evidence: z.string().max(2000).optional(),
  sample: z.string().max(2000).optional(),
  interviewedWith: z.string().max(500).optional(),
  comments: z.string().max(2000).optional(),
});

export const createFindingSchema = z.object({
  classification: z.enum(["ABWEICHUNG", "FESTSTELLUNG", "EMPFEHLUNG"]),
  description: z.string().min(1, "Beschreibung ist erforderlich").max(2000),
});

export const templateItemSchema = z.object({
  chapter: z.string().min(1, "Kapitel ist erforderlich").max(20),
  chapterTitle: z.string().min(1, "Überschrift ist erforderlich").max(300),
  requirements: z.string().min(1, "Prüfpunkte sind erforderlich").max(3000),
});

export type CreateAuditInput = z.infer<typeof createAuditSchema>;
export type UpdateAnswerInput = z.infer<typeof updateAnswerSchema>;
export type CreateFindingInput = z.infer<typeof createFindingSchema>;
export type TemplateItemInput = z.infer<typeof templateItemSchema>;
