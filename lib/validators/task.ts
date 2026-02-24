import { z } from "zod";
import { TASK_TYPES, TASK_PRIORITIES } from "@/lib/types/enums";

export const createTaskSchema = z.object({
  type: z.enum(TASK_TYPES).default("GENERAL"),
  title: z.string().min(1, "Titel ist erforderlich").max(200),
  description: z.string().max(2000).optional(),
  assigneeId: z.string().min(1, "Zuständige Person ist erforderlich"),
  dueDate: z.number().optional(),
  priority: z.enum(TASK_PRIORITIES).default("MEDIUM"),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
