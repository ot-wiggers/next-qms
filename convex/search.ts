import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthenticatedUser } from "./lib/withAuth";
import { hasPermission } from "./lib/permissions";
import type { UserRole } from "../lib/types/enums";

/** Global search across documents, trainings, tasks, and users */
export const globalSearch = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const q = args.query.trim();
    if (!q) return { documents: [], trainings: [], tasks: [], users: [] };

    // Search documents by title (search index)
    const docsByTitle = await ctx.db
      .query("documentRecords")
      .withSearchIndex("search_title", (s) =>
        s.search("title", q).eq("isArchived", false)
      )
      .take(5);

    // Search documents by content (search index)
    const docsByContent = await ctx.db
      .query("documentRecords")
      .withSearchIndex("search_content", (s) =>
        s.search("contentPlaintext", q).eq("isArchived", false)
      )
      .take(5);

    // Deduplicate documents
    const seenDocIds = new Set<string>();
    const documents = [];
    for (const doc of [...docsByTitle, ...docsByContent]) {
      if (!seenDocIds.has(doc._id)) {
        seenDocIds.add(doc._id);
        documents.push({
          _id: doc._id,
          documentCode: doc.documentCode,
          title: doc.title,
          documentType: doc.documentType,
          status: doc.status,
        });
      }
      if (documents.length >= 5) break;
    }

    // Search trainings
    const trainings = (
      await ctx.db
        .query("trainings")
        .withSearchIndex("search_title", (s) =>
          s.search("title", q).eq("isArchived", false)
        )
        .take(5)
    ).map((t) => ({
      _id: t._id,
      title: t.title,
      status: t.status,
      category: t.category,
    }));

    // Search tasks
    const tasks = (
      await ctx.db
        .query("tasks")
        .withSearchIndex("search_title", (s) =>
          s.search("title", q).eq("isArchived", false)
        )
        .take(5)
    ).map((t) => ({
      _id: t._id,
      title: t.title,
      status: t.status,
      type: t.type,
    }));

    // Search users (only if user has permission)
    let users: Array<{
      _id: string;
      firstName: string;
      lastName: string;
      email: string;
      role: string;
    }> = [];

    if (hasPermission(user.role as UserRole, "users:list")) {
      const allUsers = await ctx.db
        .query("users")
        .filter((s) => s.eq(s.field("isArchived"), false))
        .collect();

      const lowerQ = q.toLowerCase();
      users = allUsers
        .filter(
          (u) =>
            u.firstName.toLowerCase().includes(lowerQ) ||
            u.lastName.toLowerCase().includes(lowerQ) ||
            u.email.toLowerCase().includes(lowerQ)
        )
        .slice(0, 5)
        .map((u) => ({
          _id: u._id,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          role: u.role,
        }));
    }

    return { documents, trainings, tasks, users };
  },
});
