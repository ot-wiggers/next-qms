import { defineType, defineField } from "sanity";

export const processDescription = defineType({
  name: "processDescription",
  title: "Prozessbeschreibung",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Titel", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "slug", title: "Slug", type: "slug", options: { source: "title" } }),
    defineField({ name: "processCode", title: "Prozess-Code", type: "string", description: "z.B. PB-003" }),
    defineField({ name: "processOwner", title: "Prozessverantwortlicher", type: "string" }),
    defineField({ name: "inputs", title: "Inputs", type: "text" }),
    defineField({ name: "outputs", title: "Outputs", type: "text" }),
    defineField({ name: "content", title: "Ablaufbeschreibung", type: "array", of: [{ type: "block" }, { type: "image" }] }),
    defineField({
      name: "kpis",
      title: "Kennzahlen",
      type: "array",
      of: [{
        type: "object",
        fields: [
          { name: "name", title: "KPI Name", type: "string" },
          { name: "target", title: "Zielwert", type: "string" },
          { name: "unit", title: "Einheit", type: "string" },
        ],
      }],
    }),
    defineField({
      name: "relatedWorkInstructions",
      title: "Verknüpfte Arbeitsanweisungen",
      type: "array",
      of: [{ type: "reference", to: [{ type: "workInstruction" }] }],
    }),
  ],
});
