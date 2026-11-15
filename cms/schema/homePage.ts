import { defineArrayMember, defineField, defineType } from "sanity";
import { photoFields } from "./photo";
import { eachFits, fits, noPlaceholder } from "./rules";

/**
 * The home page's own words and photos. The services, reviews, Instagram photos, questions and
 * Pomi's bio on it are edited where they live; this holds what belongs to the page itself.
 * Limits are sized from the approved design, so nothing typed here can break the layout.
 */
export const HERO_PHOTO_COUNT = 9;

export const homePage = defineType({
  name: "homePage",
  title: "Home page",
  type: "document",
  groups: [
    { name: "top", title: "Top of page", default: true },
    { name: "about", title: "About" },
    { name: "work", title: "Recent work" },
    { name: "prices", title: "Prices" },
    { name: "questions", title: "Questions" },
    { name: "form", title: "Appointment form" },
  ],
  validation: noPlaceholder(),
  fields: [
    defineField({ name: "heroHeadline", title: "Headline", type: "string", group: "top", description: "Followed by the changing words below: “Perfect brows for every … meeting”.", validation: fits(30, { required: true }) }),
    defineField({
      name: "heroOccasions",
      title: "Changing words",
      type: "array",
      group: "top",
      of: [{ type: "string" }],
      description: "Shown one after another after the headline. The first one is what shows when the animation is paused.",
      validation: (r) => [r.min(1).max(8).error("Use between 1 and 8 words."), eachFits(14)(r)],
    }),
    defineField({ name: "heroIntro", title: "Intro sentence", type: "text", rows: 2, group: "top", validation: fits(140, { required: true }) }),
    defineField({
      name: "heroNote",
      title: "Small print under the buttons",
      type: "text",
      rows: 2,
      group: "top",
      description: "Follows the studio's location, e.g. “Tustin, across from Irvine. Every service is two visits…”.",
      validation: fits(130),
    }),
    defineField({
      name: "heroPhotos",
      title: "Photo wall",
      type: "array",
      group: "top",
      options: { layout: "grid" },
      description:
        "Nine photos in fixed spots. The first five also show on phones. To change one, click it and choose Replace; keep the order. Wide spots (2, 8, 9) suit eyes and lips; tall ones suit brows and before/afters.",
      of: [defineArrayMember({ type: "image", options: { hotspot: true }, fields: photoFields })],
      validation: (r) => r.length(HERO_PHOTO_COUNT).error(`The wall has exactly ${HERO_PHOTO_COUNT} spots. Replace photos rather than adding or removing them.`),
    }),
    defineField({ name: "heroCaption", title: "Line under the photo wall", type: "string", group: "top", validation: fits(80) }),
    defineField({
      name: "aboutFacts",
      title: "Four facts beside the bio",
      type: "array",
      group: "about",
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({ name: "value", title: "Big text", type: "string", description: "e.g. “10 years”", validation: fits(14, { required: true }) }),
            defineField({ name: "label", title: "Small text", type: "string", description: "e.g. “in business”", validation: fits(34, { required: true }) }),
          ],
          preview: { select: { title: "value", subtitle: "label" } },
        }),
      ],
      validation: (r) => r.length(4).error("Keep exactly four facts."),
    }),
    defineField({
      name: "aboutPhoto",
      title: "Photo beside the bio",
      type: "image",
      group: "about",
      options: { hotspot: true },
      fields: photoFields,
      description: "Shown until there's a photo of Pomi in Studio details → About Pomi.",
    }),
    defineField({ name: "workHeading", title: "Heading", type: "string", group: "work", validation: fits(40, { required: true }) }),
    defineField({ name: "workIntro", title: "Intro", type: "text", rows: 2, group: "work", validation: fits(130) }),
    defineField({ name: "pricesHeading", title: "Heading", type: "string", group: "prices", validation: fits(40, { required: true }) }),
    defineField({ name: "pricesIntro", title: "Intro", type: "text", rows: 2, group: "prices", validation: fits(160) }),
    defineField({ name: "extrasHeading", title: "Touch-ups card: heading", type: "string", group: "prices", validation: fits(32, { required: true }) }),
    defineField({ name: "extrasIntro", title: "Touch-ups card: intro", type: "string", group: "prices", validation: fits(70) }),
    defineField({ name: "faqHeading", title: "Heading", type: "string", group: "questions", description: "The questions themselves are Learn articles with “Show as a question on the home page” ticked.", validation: fits(50, { required: true }) }),
    defineField({ name: "faqIntro", title: "Intro", type: "string", group: "questions", validation: fits(90) }),
    defineField({ name: "formHeading", title: "Heading", type: "string", group: "form", description: "The form appears on most pages; this changes it everywhere.", validation: fits(40, { required: true }) }),
    defineField({ name: "formIntro", title: "Intro", type: "text", rows: 3, group: "form", validation: fits(200) }),
  ],
  preview: { prepare: () => ({ title: "Home page" }) },
});
