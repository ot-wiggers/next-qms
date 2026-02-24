import { defineType, defineField } from "sanity";

export const qmDocument = defineType({
  name: "qmDocument",
  title: "QM-Handbuch Kapitel",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Titel",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title" },
    }),
    defineField({
      name: "chapterNumber",
      title: "Kapitelnummer",
      type: "string",
      description: "z.B. 4.2.3",
    }),
    defineField({
      name: "category",
      title: "Kategorie",
      type: "string",
      options: {
        list: [
          { title: "Qualitätspolitik", value: "quality_policy" },
          { title: "Prozess", value: "process" },
          { title: "Verantwortung", value: "responsibility" },
          { title: "Ressource", value: "resource" },
        ],
      },
    }),
    defineField({
      name: "content",
      title: "Inhalt",
      type: "array",
      of: [
        { type: "block" },
        { type: "image" },
      ],
    }),
    defineField({
      name: "relatedDocuments",
      title: "Verwandte Dokumente",
      type: "array",
      of: [{ type: "reference", to: [{ type: "qmDocument" }] }],
    }),
    defineField({
      name: "effectiveDate",
      title: "Gültigkeitsdatum",
      type: "date",
    }),
    defineField({
      name: "lastReviewDate",
      title: "Letztes Prüfdatum",
      type: "date",
    }),
  ],
});
