import { defineType, defineField } from "sanity";

export const workInstruction = defineType({
  name: "workInstruction",
  title: "Arbeitsanweisung",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Titel", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "slug", title: "Slug", type: "slug", options: { source: "title" } }),
    defineField({ name: "documentCode", title: "Dokumenten-Code", type: "string", description: "z.B. AA-001" }),
    defineField({ name: "scope", title: "Geltungsbereich", type: "text" }),
    defineField({ name: "content", title: "Inhalt", type: "array", of: [{ type: "block" }, { type: "image" }] }),
    defineField({ name: "targetRoles", title: "Zielgruppe (Rollen)", type: "array", of: [{ type: "string" }], options: { list: [
      { title: "Mitarbeiter", value: "employee" },
      { title: "Abteilungsleitung", value: "department_lead" },
      { title: "QMB", value: "qmb" },
      { title: "Alle", value: "all" },
    ]} }),
    defineField({ name: "attachments", title: "Anhänge", type: "array", of: [{ type: "file" }] }),
    defineField({ name: "effectiveDate", title: "Gültigkeitsdatum", type: "date" }),
    defineField({ name: "lastReviewDate", title: "Letztes Prüfdatum", type: "date" }),
  ],
});
