/* eslint-disable */
// Stub types — replaced by `npx convex dev`

import type { GenericId } from "convex/values";

export type TableNames =
  | "organizations"
  | "users"
  | "tasks"
  | "auditLog"
  | "featureFlags"
  | "documentRecords"
  | "readConfirmations"
  | "trainings"
  | "trainingSessions"
  | "trainingParticipants"
  | "trainingFeedback"
  | "effectivenessChecks"
  | "trainingRequests"
  | "manufacturers"
  | "products"
  | "declarationsOfConformity"
  | "audits"
  | "auditFindings"
  | "capaActions"
  | "complaints"
  | "incomingGoodsChecks"
  | "deviceRecords"
  | "deviceCalibrations"
  | "_storage";

export type Id<T extends TableNames> = GenericId<T>;

export type DataModel = Record<TableNames, any>;
