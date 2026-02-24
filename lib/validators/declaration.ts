import { z } from "zod";

export const createDeclarationSchema = z.object({
  productId: z.string().min(1, "Produkt ist erforderlich"),
  version: z.string().min(1, "Version ist erforderlich").max(20),
  issuedAt: z.number().min(1, "Ausstellungsdatum ist erforderlich"),
  validFrom: z.number().min(1, "Gültig ab ist erforderlich"),
  validUntil: z.number().min(1, "Gültig bis ist erforderlich"),
  notifiedBody: z.string().max(200).optional(),
  certificateNumber: z.string().max(100).optional(),
}).refine(data => data.validUntil > data.validFrom, {
  message: "Gültig bis muss nach Gültig ab liegen",
  path: ["validUntil"],
});

export const reviewDeclarationSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["VALID", "IN_REVIEW"]),
});

export type CreateDeclarationInput = z.infer<typeof createDeclarationSchema>;
export type ReviewDeclarationInput = z.infer<typeof reviewDeclarationSchema>;
