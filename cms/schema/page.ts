import { defineArrayMember, defineField, defineType } from "sanity";
import { sectionsField } from "./sections";

/**
 * A slide-style page that is not a Learn article: Safety and Aftercare. Each page's address is
 * fixed in the code (src/pages/safety.astro, aftercare.astro), so the slug is read-only here.
 */
export const page = defineType({
  name: "page",
  title: "Page",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string", validation: (r) => r.required() }),
    defineField({ name: "slug", type: "slug", readOnly: true, description: "Fixed: the page lives at /<slug>." }),
    defineField({ name: "lede", title: "Introduction", type: "text", rows: 3, validation: (r) => r.required() }),
    defineField({ name: "metaLabel", title: "Footnote label", type: "string", description: "The lead word of the note under the header, e.g. “Medical clearance”." }),
    defineField({ name: "meta", title: "Footnote", type: "text", rows: 2 }),
    defineField({ name: "lead", title: "Header photo", type: "imageSlot" }),
    defineField({
      name: "facts",
      title: "Header facts",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          fields: [defineField({ name: "title", type: "string" }), defineField({ name: "text", type: "string" })],
          preview: { select: { title: "title", subtitle: "text" } },
        }),
      ],
    }),
    sectionsField,
  ],
  preview: { select: { title: "title", subtitle: "slug.current" } },
});
