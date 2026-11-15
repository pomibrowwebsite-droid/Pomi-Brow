import { defineField, defineType } from "sanity";
import { sectionsField } from "./sections";
import { photoField } from "./photo";

export const learnArticle = defineType({
  name: "learnArticle",
  title: "Learn article",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "slug",
      type: "slug",
      options: { source: "title" },
      validation: (r) => r.required(),
      description: "The page address under /learn/. Keep existing addresses unchanged so Google links keep working.",
    }),
    defineField({ name: "summary", title: "One-line answer", type: "text", rows: 2 }),
    photoField("cover", "Cover photo", "Shown on the article's card and at the top of the article."),
    sectionsField,
    defineField({ name: "lead", title: "Lead photograph", type: "imageSlot", description: "Used when there is no cover." }),
    defineField({
      name: "body",
      title: "Body (used only when there are no sections)",
      type: "array",
      of: [{ type: "block" }, { type: "image", options: { hotspot: true } }],
    }),
    defineField({
      name: "relatedService",
      type: "reference",
      to: [{ type: "service" }],
      description: "Optional. Links the article to a service page.",
    }),
    defineField({
      name: "serviceGuide",
      title: "This is the guide to its service",
      type: "boolean",
      description: "Lists it first on the related service page, ahead of the questions about it.",
      initialValue: false,
    }),
    defineField({
      name: "showAsFaq",
      title: "Show as a question on the home page",
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "order",
      title: "Order in lists",
      type: "number",
      description: "Lower numbers appear first on the Learn page and in the footer.",
    }),
    defineField({
      name: "seoTitle",
      title: "Search title",
      type: "string",
      description: "The title Google shows. Leave empty for “<title> | Pomi B. Brow Studio”.",
    }),
  ],
  preview: { select: { title: "title", subtitle: "summary" } },
});
