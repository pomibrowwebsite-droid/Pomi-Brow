import { defineField } from "sanity";
import { altForUploads, fits } from "./rules";

/**
 * Which repo photo the import made this image from (src/assets/gallery/<ref>.jpg). Hidden: the
 * site uses it to keep serving its own optimised copy while the pixels are unchanged, and
 * switches to Sanity's CDN by itself once the photo is replaced. See src/lib/content.ts.
 */
export const galleryRefField = defineField({ name: "galleryRef", type: "string", hidden: true, readOnly: true });

/**
 * A photograph with what the site needs beside the pixels: a description, the caption word,
 * and the hotspot (click "Edit" on the photo, then drag the circle onto what matters), which
 * becomes the crop point wherever a frame trims the photo.
 */
export const photoFields = [
  galleryRefField,
  defineField({
    name: "alt",
    title: "Describe the photo",
    type: "string",
    description: "For people who can't see it, and for Google. e.g. “Healed microblading, soft natural hair strokes”.",
    validation: (r) => [altForUploads(r), fits(140)(r)],
  }),
  defineField({
    name: "detail",
    title: "Caption",
    type: "string",
    description: "The short word under the photo: “Healed”, “Before and after”, “Close-up”.",
    validation: fits(30),
  }),
];

export const photoField = (name: string, title: string, description?: string, group?: string) =>
  defineField({ name, title, type: "image", options: { hotspot: true }, fields: photoFields, description, ...(group ? { group } : {}) });
