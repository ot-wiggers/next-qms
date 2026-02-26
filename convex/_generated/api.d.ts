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
import type * as dashboard from "../dashboard.js";
import type * as declarations from "../declarations.js";
import type * as documentLinks from "../documentLinks.js";
import type * as documentReviews from "../documentReviews.js";
import type * as documentVersions from "../documentVersions.js";
import type * as documents from "../documents.js";
import type * as effectiveness from "../effectiveness.js";
import type * as email from "../email.js";
import type * as featureFlags from "../featureFlags.js";
import type * as http from "../http.js";
import type * as lib_auditLog from "../lib/auditLog.js";
import type * as lib_notificationHelpers from "../lib/notificationHelpers.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_softDelete from "../lib/softDelete.js";
import type * as lib_stateMachine from "../lib/stateMachine.js";
import type * as lib_withAuth from "../lib/withAuth.js";
import type * as notifications from "../notifications.js";
import type * as organizations from "../organizations.js";
import type * as placeholders_audits from "../placeholders/audits.js";
import type * as placeholders_capa from "../placeholders/capa.js";
import type * as placeholders_complaints from "../placeholders/complaints.js";
import type * as placeholders_devices from "../placeholders/devices.js";
import type * as placeholders_incomingGoods from "../placeholders/incomingGoods.js";
import type * as placeholders_reports from "../placeholders/reports.js";
import type * as products from "../products.js";
import type * as search from "../search.js";
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
  dashboard: typeof dashboard;
  declarations: typeof declarations;
  documentLinks: typeof documentLinks;
  documentReviews: typeof documentReviews;
  documentVersions: typeof documentVersions;
  documents: typeof documents;
  effectiveness: typeof effectiveness;
  email: typeof email;
  featureFlags: typeof featureFlags;
  http: typeof http;
  "lib/auditLog": typeof lib_auditLog;
  "lib/notificationHelpers": typeof lib_notificationHelpers;
  "lib/permissions": typeof lib_permissions;
  "lib/softDelete": typeof lib_softDelete;
  "lib/stateMachine": typeof lib_stateMachine;
  "lib/withAuth": typeof lib_withAuth;
  notifications: typeof notifications;
  organizations: typeof organizations;
  "placeholders/audits": typeof placeholders_audits;
  "placeholders/capa": typeof placeholders_capa;
  "placeholders/complaints": typeof placeholders_complaints;
  "placeholders/devices": typeof placeholders_devices;
  "placeholders/incomingGoods": typeof placeholders_incomingGoods;
  "placeholders/reports": typeof placeholders_reports;
  products: typeof products;
  search: typeof search;
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
