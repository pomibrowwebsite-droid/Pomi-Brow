import { defineArrayMember, defineField, defineType } from "sanity";
import { sectionsField } from "./sections";
import { fits, noPlaceholder } from "./rules";

/**
 * A slide-style page that is not a Learn article: Safety and Aftercare. Each page's address is
 * fixed in the code (src/pages/safety.astro, aftercare.astro), so the slug is read-only here.
 */
export const page = defineType({
  name: "page",
  title: "Page",
  type: "document",
  groups: [
    { name: "top", title: "Top of page", default: true },
    { name: "sections", title: "Page sections" },
  ],
  validation: noPlaceholder(),
  fields: [
    defineField({ name: "title", type: "string", group: "top", validation: fits(60, { required: true }) }),
    defineField({ name: "lede", title: "Introduction", type: "text", rows: 3, group: "top", validation: fits(200, { required: true }) }),
    defineField({ name: "lead", title: "Top photo", type: "imageSlot", group: "top" }),
    defineField({
      name: "facts",
      title: "Key facts at the top",
      type: "array",
      group: "top",
      validation: (r) => r.max(4),
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({ name: "title", type: "string", validation: fits(24, { required: true }) }),
            defineField({ name: "text", type: "string", validation: fits(80) }),
          ],
          preview: { select: { title: "title", subtitle: "text" } },
        }),
      ],
    }),
    defineField({ name: "metaLabel", title: "Small note: label", type: "string", group: "top", description: "The bold first words of the note under the top, e.g. “Medical clearance”.", validation: fits(30) }),
    defineField({ name: "meta", title: "Small note: text", type: "text", rows: 2, group: "top", validation: fits(100) }),
    { ...sectionsField, group: "sections" },
    defineField({ name: "slug", title: "Page address", type: "slug", readOnly: true, group: "top", description: "Fixed: the page lives at /<this>." }),
  ],
  preview: { select: { title: "title", subtitle: "slug.current" }, prepare: ({ title, subtitle }) => ({ title, subtitle: subtitle ? `/${subtitle}` : undefined }) },
});
