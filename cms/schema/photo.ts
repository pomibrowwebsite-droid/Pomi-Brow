import { defineField } from "sanity";

/**
 * A photograph with what the site needs beside the pixels: alt text, the caption detail, and
 * the hotspot, which becomes the crop point (CSS object-position) wherever a frame crops it.
 * Used for service covers, article covers, Instagram picks and section photos.
 */
/**
 * Which repo photo the import made this image from (src/assets/gallery/<ref>.jpg). Hidden: the
 * site uses it to keep serving its own optimised copy while the pixels are unchanged, and
 * switches to Sanity's CDN by itself once the photo is replaced. See src/lib/content.ts.
 */
export const galleryRefField = defineField({ name: "galleryRef", type: "string", hidden: true, readOnly: true });

export const photoFields = [
  galleryRefField,
  defineField({
    name: "alt",
    title: "Alt text",
    type: "string",
    description: "What the photo shows, for people who can't see it, e.g. “Healed microblading, soft natural hair strokes”.",
  }),
  defineField({
    name: "detail",
    title: "Caption",
    type: "string",
    description: "The short word under the photo: “Healed”, “Before and after”, “Close-up”.",
  }),
];

export const photoField = (name: string, title: string, description?: string) =>
  defineField({ name, title, type: "image", options: { hotspot: true }, fields: photoFields, description });
