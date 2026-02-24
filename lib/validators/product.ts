import { z } from "zod";
import { RISK_CLASSES } from "@/lib/types/enums";

export const createProductSchema = z.object({
  name: z.string().min(1, "Produktname ist erforderlich").max(200),
  articleNumber: z.string().min(1, "Artikelnummer ist erforderlich").max(50),
  udi: z.string().max(100).optional(),
  productGroup: z.string().max(100).optional(),
  manufacturerId: z.string().optional(),
  riskClass: z.enum(RISK_CLASSES, { message: "Ungültige Risikoklasse" }),
  notes: z.string().max(2000).optional(),
});

export const updateProductSchema = createProductSchema.partial().extend({
  id: z.string().min(1),
});

export const createManufacturerSchema = z.object({
  name: z.string().min(1, "Herstellername ist erforderlich").max(200),
  country: z.string().max(100).optional(),
  contactInfo: z.string().max(500).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateManufacturerInput = z.infer<typeof createManufacturerSchema>;
