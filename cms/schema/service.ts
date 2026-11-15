import { defineField, defineType } from "sanity";
import { galleryRefField, photoField } from "./photo";

export const service = defineType({
  name: "service",
  title: "Service",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "slug",
      type: "slug",
      options: { source: "title" },
      validation: (r) => r.required(),
      description: "The page address, e.g. microblading → /services/microblading",
    }),
    defineField({
      name: "category",
      type: "string",
      options: { list: ["Eyebrows", "Eyes", "Lips", "Hair", "Maintenance", "Correction"] },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "order",
      title: "Order in the price list",
      type: "number",
      description: "Lower numbers appear first.",
    }),
    defineField({
      name: "price",
      title: "Price (USD)",
      type: "number",
      validation: (r) => r.required().min(0),
    }),
    defineField({
      name: "priceUnit",
      title: "Price unit",
      type: "string",
      description: "Leave empty for a flat price. Use “hr” for hourly, “session” for per-session.",
    }),
    defineField({
      name: "touchUpPrice",
      title: "Perfecting touch-up price (USD)",
      type: "number",
      description: "The 6-week touch-up. Leave empty when the service has none.",
    }),
    defineField({
      name: "priceNote",
      title: "Price note",
      type: "string",
      description: "Short note shown beside the price, e.g. “up to 4 sessions” or “existing clients”.",
    }),
    defineField({ name: "summary", title: "One-line summary", type: "text", rows: 2 }),
    defineField({ name: "description", type: "array", of: [{ type: "block" }] }),
    photoField("cover", "Cover photo", "The one photo for this service on the home price list and at the top of its page."),
    defineField({
      name: "gallery",
      title: "Healed results",
      type: "array",
      description: "The photos on the service page, in this order.",
      of: [
        {
          type: "image",
          options: { hotspot: true },
          fields: [
            galleryRefField,
            defineField({ name: "alt", title: "Alt text", type: "string", description: "What the photo shows. Leave empty for “<service> by Pomi B. Brow Studio, healed result”." }),
            defineField({ name: "caption", type: "string", description: "e.g. Healed six weeks" }),
            defineField({ name: "beforeAfter", title: "Before / after composite", type: "boolean" }),
          ],
        },
      ],
    }),
    defineField({
      name: "seoTitle",
      title: "Search title",
      type: "string",
      description: "The title Google shows. Leave empty for “<service> in Tustin, near Irvine | Pomi B. Brow Studio”.",
    }),
    defineField({
      name: "showOnHome",
      title: "Show in the home price list",
      type: "boolean",
      initialValue: true,
    }),
  ],
  orderings: [{ title: "Price list order", name: "order", by: [{ field: "order", direction: "asc" }] }],
  preview: {
    select: { title: "title", subtitle: "category", media: "cover" },
  },
});
