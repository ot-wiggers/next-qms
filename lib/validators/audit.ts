import { z } from "zod";
import {
  AUDIT_TYPES,
  AUDIT_RATINGS,
  FINDING_CLASSIFICATIONS,
} from "@/lib/types/enums";

export const createAuditSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich").max(200),
  auditYear: z.number().int().min(2000).max(2100),
  auditType: z.enum(AUDIT_TYPES, { message: "Ungültiger Audit-Typ" }),
  auditTeam: z.string().max(500).optional(),
  basis: z.string().max(1000).optional(),
  location: z.string().max(500).optional(),
  reportingPeriod: z.string().max(200).optional(),
  plannedFor: z.string().max(50).optional(),
});

export const updateAnswerSchema = z.object({
  rating: z.enum(AUDIT_RATINGS, { message: "Ungültige Bewertung" }).optional(),
  evidence: z.string().max(2000).optional(),
  sample: z.string().max(2000).optional(),
  interviewedWith: z.string().max(500).optional(),
  comments: z.string().max(2000).optional(),
});

export const createFindingSchema = z.object({
  classification: z.enum(FINDING_CLASSIFICATIONS, { message: "Ungültige Klassifizierung" }),
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
