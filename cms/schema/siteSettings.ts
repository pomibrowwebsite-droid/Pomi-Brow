import { defineField, defineType } from "sanity";
import { galleryRefField, photoFields } from "./photo";
import { fits, noPlaceholder } from "./rules";

const g = (group: string) => ({ group });

export const siteSettings = defineType({
  name: "siteSettings",
  title: "Studio details",
  type: "document",
  groups: [
    { name: "contact", title: "Phone & address", default: true },
    { name: "hours", title: "Hours & booking" },
    { name: "about", title: "About Pomi" },
    { name: "instagram", title: "Instagram" },
    { name: "yelp", title: "Yelp" },
    { name: "google", title: "Google" },
  ],
  // The bio's starter paragraph says "placeholder" on purpose: the site hides it until Pomi
  // writes her own, so it does not block publishing.
  validation: noPlaceholder(["bio"]),
  fields: [
    defineField({ name: "businessName", title: "Studio name", type: "string", initialValue: "Pomi B. Brow Studio", ...g("contact"), validation: fits(40) }),
    defineField({ name: "phone", title: "Phone, as shown", type: "string", description: "e.g. (949) 427-7664", ...g("contact"), validation: fits(20) }),
    defineField({
      name: "phoneTel",
      title: "Phone, for tapping to call",
      type: "string",
      description: "The same number as +1 and ten digits, no spaces: +19494277664. Change both together.",
      ...g("contact"),
      validation: (r) =>
        r.custom((v: unknown) => (!v || /^\+1\d{10}$/.test(String(v)) ? true : "Write it as +1 followed by the ten digits, e.g. +19494277664.")),
    }),
    defineField({ name: "email", type: "string", ...g("contact") }),
    defineField({ name: "street", type: "string", ...g("contact") }),
    defineField({ name: "city", type: "string", ...g("contact") }),
    defineField({ name: "state", type: "string", ...g("contact") }),
    defineField({ name: "zip", title: "ZIP", type: "string", ...g("contact") }),
    defineField({
      name: "locationLine",
      title: "Where, in a few words",
      type: "string",
      description: "Used in headlines and captions, e.g. “Tustin, across from Irvine”.",
      ...g("contact"),
      validation: fits(70),
    }),
    defineField({ name: "mapLinkUrl", title: "Google Maps directions link", type: "url", ...g("contact") }),
    defineField({ name: "mapEmbedUrl", title: "Google Maps embed link", type: "url", description: "From Google Maps: Share → Embed a map → copy the address inside src=\"…\".", ...g("contact") }),
    defineField({
      name: "hours",
      title: "Opening hours",
      type: "array",
      ...g("hours"),
      of: [
        {
          type: "object",
          fields: [
            defineField({ name: "days", type: "string", description: "e.g. Tue–Sat" }),
            defineField({ name: "opens", type: "string", description: "24-hour time, e.g. 10:00" }),
            defineField({ name: "closes", type: "string", description: "24-hour time, e.g. 18:00" }),
          ],
          preview: { select: { days: "days", opens: "opens", closes: "closes" }, prepare: ({ days, opens, closes }) => ({ title: days, subtitle: `${opens ?? "?"}–${closes ?? "?"}` }) },
        },
      ],
    }),
    defineField({ name: "hoursNote", title: "Note under the hours", type: "string", description: "e.g. “By appointment”", ...g("hours"), validation: fits(40) }),
    defineField({
      name: "bookingUrl",
      title: "Online booking link",
      type: "url",
      description: "Leave empty and the Book buttons call the studio instead.",
      ...g("hours"),
    }),
    defineField({ name: "aboutHeading", title: "Heading", type: "string", ...g("about"), validation: fits(40) }),
    defineField({
      name: "bio",
      title: "About Pomi",
      type: "array",
      of: [{ type: "block" }],
      description: "A few short paragraphs in Pomi's own words. A paragraph that still says “placeholder” stays hidden on the site.",
      ...g("about"),
    }),
    defineField({ name: "headshot", title: "Photo of Pomi", type: "image", options: { hotspot: true }, fields: [galleryRefField], ...g("about") }),
    defineField({ name: "instagramHandle", title: "Instagram name", type: "string", description: "Without the @", ...g("instagram") }),
    defineField({ name: "instagramUrl", title: "Instagram link", type: "url", ...g("instagram") }),
    defineField({
      name: "instagramLiveFeed",
      title: "Show the newest Instagram posts automatically",
      type: "boolean",
      initialValue: true,
      description: "Needs the Instagram token in Cloudflare. When it's off, or Instagram can't be reached, the four photos below show instead.",
      ...g("instagram"),
    }),
    defineField({
      name: "instagramPicks",
      title: "Four photos for the Instagram section",
      type: "array",
      options: { layout: "grid" },
      of: [{ type: "image", options: { hotspot: true }, fields: photoFields }],
      validation: (r) => r.max(4).error("The section shows four photos."),
      ...g("instagram"),
    }),
    defineField({ name: "yelpUrl", title: "Yelp link", type: "url", ...g("yelp") }),
    defineField({
      name: "yelpRating",
      title: "Overall star rating",
      type: "number",
      description: "The rating at the top of the Yelp listing, e.g. 5.",
      validation: (r) => r.min(1).max(5),
      ...g("yelp"),
    }),
    defineField({ name: "yelpReviewCount", title: "Number of five-star reviews", type: "number", ...g("yelp"), validation: (r) => r.min(0) }),
    defineField({
      name: "yelpOtherReviewCount",
      title: "Number of reviews under five stars",
      type: "number",
      description: "Counted honestly: the site says this number out loud.",
      validation: (r) => r.min(0),
      ...g("yelp"),
    }),
    defineField({
      name: "metaDescription",
      title: "Description on Google",
      type: "text",
      rows: 3,
      description: "The sentence or two under the site's name in Google results.",
      ...g("google"),
      validation: fits(220),
    }),
  ],
  preview: { prepare: () => ({ title: "Studio details" }) },
});
