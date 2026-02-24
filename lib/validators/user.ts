import { z } from "zod";
import { USER_ROLES } from "@/lib/types/enums";

export const createUserSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
  firstName: z.string().min(1, "Vorname ist erforderlich").max(100),
  lastName: z.string().min(1, "Nachname ist erforderlich").max(100),
  role: z.enum(USER_ROLES, { message: "Ungültige Rolle" }),
  organizationId: z.string().min(1, "Organisation ist erforderlich"),
  locationId: z.string().optional(),
  departmentId: z.string().optional(),
});

export const updateUserSchema = createUserSchema.partial().extend({
  id: z.string().min(1),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
