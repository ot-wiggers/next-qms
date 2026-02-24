/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auditLog from "../auditLog.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as declarations from "../declarations.js";
import type * as documents from "../documents.js";
import type * as effectiveness from "../effectiveness.js";
import type * as featureFlags from "../featureFlags.js";
import type * as lib_auditLog from "../lib/auditLog.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_softDelete from "../lib/softDelete.js";
import type * as lib_stateMachine from "../lib/stateMachine.js";
import type * as lib_withAuth from "../lib/withAuth.js";
import type * as organizations from "../organizations.js";
import type * as placeholders_audits from "../placeholders/audits.js";
import type * as placeholders_capa from "../placeholders/capa.js";
import type * as placeholders_complaints from "../placeholders/complaints.js";
import type * as placeholders_devices from "../placeholders/devices.js";
import type * as placeholders_incomingGoods from "../placeholders/incomingGoods.js";
import type * as placeholders_reports from "../placeholders/reports.js";
import type * as products from "../products.js";
import type * as seed from "../seed.js";
import type * as tasks from "../tasks.js";
import type * as trainingRequests from "../trainingRequests.js";
import type * as trainings from "../trainings.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auditLog: typeof auditLog;
  auth: typeof auth;
  crons: typeof crons;
  declarations: typeof declarations;
  documents: typeof documents;
  effectiveness: typeof effectiveness;
  featureFlags: typeof featureFlags;
  "lib/auditLog": typeof lib_auditLog;
  "lib/permissions": typeof lib_permissions;
  "lib/softDelete": typeof lib_softDelete;
  "lib/stateMachine": typeof lib_stateMachine;
  "lib/withAuth": typeof lib_withAuth;
  organizations: typeof organizations;
  "placeholders/audits": typeof placeholders_audits;
  "placeholders/capa": typeof placeholders_capa;
  "placeholders/complaints": typeof placeholders_complaints;
  "placeholders/devices": typeof placeholders_devices;
  "placeholders/incomingGoods": typeof placeholders_incomingGoods;
  "placeholders/reports": typeof placeholders_reports;
  products: typeof products;
  seed: typeof seed;
  tasks: typeof tasks;
  trainingRequests: typeof trainingRequests;
  trainings: typeof trainings;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
