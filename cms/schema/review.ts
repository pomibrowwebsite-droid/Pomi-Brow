import { defineField, defineType } from "sanity";

export const review = defineType({
  name: "review",
  title: "Review",
  type: "document",
  description: "A real review copied from Yelp or Google. Never write one yourself.",
  fields: [
    defineField({ name: "quote", title: "The review, word for word", type: "text", rows: 4, validation: (r) => r.required() }),
    defineField({
      name: "reviewer",
      title: "Reviewer name as shown on Yelp",
      type: "string",
      description: "e.g. “Jessica M.”",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "source",
      type: "string",
      options: { list: ["Yelp", "Google", "Instagram"] },
      initialValue: "Yelp",
    }),
    defineField({
      name: "excerpt",
      title: "Shortened quote for the card",
      description: "Optional. The review's own words with \"…\" where anything is cut. The card links to the full review.",
      type: "text",
      rows: 3,
    }),
    defineField({ name: "sourceUrl", title: "Link to the original review", type: "url" }),
    defineField({
      name: "rating",
      title: "Stars, as the reviewer left them",
      type: "number",
      description: "1 to 5. Copied, never rounded up.",
      initialValue: 5,
      validation: (r) => r.min(1).max(5),
    }),
    defineField({
      name: "date",
      title: "Date shown on the review",
      type: "date",
      options: { dateFormat: "YYYY-MM-DD" },
    }),
    defineField({
      name: "service",
      type: "reference",
      to: [{ type: "service" }],
      description: "Optional. Shows the review on that service page too.",
    }),
    defineField({ name: "showOnHome", type: "boolean", initialValue: true }),
    defineField({ name: "order", type: "number" }),
  ],
  preview: { select: { title: "reviewer", subtitle: "quote" } },
});
