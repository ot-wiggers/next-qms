import { defineType, defineField } from "sanity";

export const formTemplate = defineType({
  name: "formTemplate",
  title: "Formblatt-Vorlage",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Titel", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "slug", title: "Slug", type: "slug", options: { source: "title" } }),
    defineField({ name: "formCode", title: "Formblatt-Code", type: "string", description: "z.B. FB-012" }),
    defineField({ name: "purpose", title: "Zweck", type: "text" }),
    defineField({ name: "content", title: "Beschreibung/Anleitung", type: "array", of: [{ type: "block" }] }),
    defineField({ name: "templateFile", title: "Vorlage (PDF/DOCX)", type: "file" }),
    defineField({ name: "effectiveDate", title: "Gültigkeitsdatum", type: "date" }),
  ],
});
