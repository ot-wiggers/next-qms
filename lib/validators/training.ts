import { z } from "zod";

export const createTrainingSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich").max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  isRequired: z.boolean().default(false),
  effectivenessCheckAfterDays: z.number().min(1).max(365).default(30),
  targetOrganizationIds: z.array(z.string()).optional(),
});

export const createSessionSchema = z.object({
  trainingId: z.string().min(1),
  scheduledDate: z.number().min(1, "Datum ist erforderlich"),
  endDate: z.number().optional(),
  location: z.string().max(200).optional(),
  trainerId: z.string().optional(),
  trainerName: z.string().max(200).optional(),
  maxParticipants: z.number().min(1).optional(),
  notes: z.string().max(2000).optional(),
});

const ratingField = z.number().min(1, "Bewertung erforderlich").max(6);

export const trainingFeedbackSchema = z.object({
  participantId: z.string().min(1),
  sessionId: z.string().min(1),
  ratings: z.object({
    contentRelevance: ratingField,
    trainerCompetence: ratingField,
    methodology: ratingField,
    practicalApplicability: ratingField,
    organizationQuality: ratingField,
    overallSatisfaction: ratingField,
  }),
  comments: z.string().max(2000).optional(),
  improvementSuggestions: z.string().max(2000).optional(),
  wouldRecommend: z.boolean(),
});

export const effectivenessCheckSchema = z.object({
  participantId: z.string().min(1),
  goalAchieved: z.boolean(),
  applicationVisible: z.boolean(),
  errorRateReduced: z.boolean(),
  decision: z.enum(["EFFECTIVE", "INEFFECTIVE"]),
  justification: z.string().min(1, "Begründung ist erforderlich").max(2000),
});

export const trainingRequestSchema = z.object({
  topic: z.string().min(1, "Thema ist erforderlich").max(200),
  justification: z.string().min(1, "Begründung ist erforderlich").max(2000),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  externalLink: z.string().url("Ungültige URL").optional().or(z.literal("")),
  estimatedCost: z.number().min(0).optional(),
});

export type CreateTrainingInput = z.infer<typeof createTrainingSchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type TrainingFeedbackInput = z.infer<typeof trainingFeedbackSchema>;
export type EffectivenessCheckInput = z.infer<typeof effectivenessCheckSchema>;
export type TrainingRequestInput = z.infer<typeof trainingRequestSchema>;
