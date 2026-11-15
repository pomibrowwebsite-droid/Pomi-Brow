// The slide-page section types, mirroring src/lib/sections.ts so a Learn article edited in the
// Studio renders exactly like one from the seed. Keep the two in step.
import { defineArrayMember, defineField, defineType } from "sanity";
import { LAYOUTS as SITE_LAYOUTS, type BlockLayout } from "../../src/lib/sections";
import { photoFields } from "./photo";

const RATIOS = ["5 / 2", "4 / 5", "3 / 2", "1 / 1"];

// The compositions for a group of blocks (cards, steps, the two sides of a compare). How many
// blocks each holds, and whether it is built around the section photo, come straight from
// LAYOUTS in src/lib/sections.ts, so the Studio cannot drift from what the site renders. Only the
// titles live here. Rail and ledger use the photo when there is one; tiles puts photos on the cards.
const TITLES: Record<BlockLayout, string> = {
  tiles: "Tiles — equal cards in a row",
  split: "Split — one photo beside the list",
  rail: "Rail — heading and photo in a left rail, numbered rows",
  feature: "Feature — one large card plus smaller ones",
  bento: "Bento — a large photo with a 2×2 of cards",
  center: "Center — a photo between two cards",
  ledger: "Ledger — a photo strip over one card split into columns",
};
const LAYOUTS = Object.fromEntries(
  (Object.keys(SITE_LAYOUTS) as BlockLayout[]).map((k) => [
    k,
    { title: TITLES[k], min: SITE_LAYOUTS[k].min, max: SITE_LAYOUTS[k].max, needsPhoto: SITE_LAYOUTS[k].media === "required" },
  ]),
) as Record<BlockLayout, { title: string; min: number; max: number; needsPhoto: boolean }>;

/** What the layout rules read from the section a field sits in. */
type SectionValue = { items?: unknown[]; sides?: unknown[]; image?: unknown };

export const imageSlot = defineType({
  name: "imageSlot",
  title: "Photograph",
  type: "object",
  fields: [
    defineField({ name: "ratio", type: "string", options: { list: RATIOS }, initialValue: "3 / 2", validation: (r) => r.required() }),
    defineField({
      name: "shot",
      title: "What the photo should show",
      type: "string",
      description: "Written inside the empty frame until a photo is added.",
      validation: (r) => r.required(),
    }),
    defineField({ name: "photo", type: "image", options: { hotspot: true }, fields: photoFields }),
  ],
  preview: { select: { title: "shot", subtitle: "ratio" } },
});

const link = defineArrayMember({
  type: "object",
  name: "link",
  fields: [
    defineField({ name: "label", type: "string", validation: (r) => r.required() }),
    defineField({ name: "href", type: "string", validation: (r) => r.required() }),
  ],
});

export const callout = defineType({
  name: "callout",
  title: "Callout",
  type: "object",
  fields: [
    defineField({
      name: "tone",
      type: "string",
      options: { list: ["note", "voice", "caution", "links"] },
      initialValue: "note",
      description: "note: neutral. voice: in Pomi's words. caution: medical note. links: where to read next.",
      validation: (r) => r.required(),
    }),
    defineField({ name: "title", type: "string", validation: (r) => r.required() }),
    defineField({ name: "text", type: "text", rows: 3 }),
    defineField({ name: "bullets", type: "array", of: [{ type: "string" }] }),
    defineField({ name: "links", type: "array", of: [link] }),
  ],
  preview: { select: { title: "title", subtitle: "tone" } },
});

const heading = defineField({ name: "heading", type: "string", validation: (r) => r.required() });
const lede = defineField({ name: "lede", type: "text", rows: 2 });
const bullets = defineField({ name: "bullets", type: "array", of: [{ type: "string" }] });

/** One photo for the whole section, as opposed to a photo on each card. */
const sectionImage = (description?: string) => defineField({ name: "image", title: "Section photo", type: "imageSlot", description });
const blockImage = sectionImage("One photo for the whole section, placed by the layout. Tiles has no room for it.");

/** How a group of cards, steps or a compare is composed; checked against LAYOUTS. */
const blockLayout = defineField({
  name: "layout",
  type: "string",
  options: { list: Object.entries(LAYOUTS).map(([value, { title }]) => ({ title, value })) },
  description: "Leave empty to let the page choose. Split, feature, bento and center need a section photo.",
  validation: (r) =>
    r.custom((value, context) => {
      const spec = value && value in LAYOUTS ? LAYOUTS[value as BlockLayout] : undefined;
      if (!value || !spec) return true; // an unknown value is refused by the list itself
      const section = (context.parent ?? {}) as SectionValue;
      const n = (section.sides ?? section.items ?? []).length;
      const name = value[0].toUpperCase() + value.slice(1);
      const range = spec.min === spec.max ? `exactly ${spec.min}` : `${spec.min} to ${spec.max}`;
      if (n < spec.min || n > spec.max) return `${name} holds ${range} blocks, not ${n}. Pick another layout, or leave it empty.`;
      if (spec.needsPhoto && !section.image) return `${name} needs a section photo. Add one, or pick another layout.`;
      return true;
    }),
});

/** Which side a section's photo sits on. */
const side = defineField({
  name: "side",
  title: "Photo side",
  type: "string",
  options: {
    list: [
      { title: "Left", value: "left" },
      { title: "Right", value: "right" },
    ],
    layout: "radio",
    direction: "horizontal",
  },
  description: "Optional. Leave empty and photos alternate sides down the page automatically. Applies to the split, feature and bento layouts.",
});

/** A section's preview subtitle: what it is, then its layout when one is chosen. */
const subtitle = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(" · ");

export const sectionFacts = defineType({
  name: "sectionFacts",
  title: "Facts strip",
  type: "object",
  fields: [
    defineField({
      name: "items",
      type: "array",
      validation: (r) => r.min(2).max(4),
      of: [
        defineArrayMember({
          type: "object",
          fields: [defineField({ name: "title", type: "string" }), defineField({ name: "text", type: "string" })],
        }),
      ],
    }),
  ],
  preview: { prepare: () => ({ title: "Facts strip" }) },
});

export const sectionStatement = defineType({
  name: "sectionStatement",
  title: "Statement",
  type: "object",
  fields: [
    heading,
    lede,
    defineField({ name: "paragraphs", type: "array", of: [{ type: "text" }], validation: (r) => r.min(1).max(3) }),
    sectionImage(),
    defineField({
      name: "layout",
      type: "string",
      options: {
        list: [
          { title: "Split — copy beside a photo", value: "split" },
          { title: "Wide — a photo strip beside the heading, copy below", value: "wide" },
        ],
        layout: "radio",
      },
      description: "Used when there is a section photo. Leave empty for split.",
    }),
    side,
    defineField({ name: "callout", type: "callout" }),
  ],
  preview: { select: { title: "heading", layout: "layout" }, prepare: ({ title, layout }) => ({ title, subtitle: subtitle("Statement", layout) }) },
});

export const sectionGrid = defineType({
  name: "sectionGrid",
  title: "Cards",
  type: "object",
  fields: [
    heading,
    lede,
    defineField({
      name: "items",
      type: "array",
      validation: (r) => r.min(2).max(6),
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({ name: "title", type: "string", validation: (r) => r.required() }),
            defineField({ name: "text", type: "text", rows: 2 }),
            bullets,
            defineField({ name: "image", type: "imageSlot" }),
            defineField({ name: "href", type: "string", description: "Makes this a link card. Needs a link label too." }),
            defineField({ name: "linkLabel", type: "string", description: 'The visible link text, e.g. "Read".' }),
            defineField({
              name: "links",
              type: "array",
              of: [link],
              description: "For several links under the text, e.g. each service in a category. Leave Href empty when you use these.",
              validation: (r) =>
                r.custom((links, context) =>
                  links?.length && (context.parent as { href?: string } | undefined)?.href ? "Use Href or these links, not both." : true,
                ),
            }),
          ],
        }),
      ],
    }),
    blockImage,
    blockLayout,
    side,
    defineField({ name: "callout", type: "callout" }),
    defineField({
      name: "columns",
      type: "number",
      options: { list: [2, 3, 4] },
      description: "No longer used: the layout decides how many columns a group runs. Clear this.",
      hidden: ({ value }) => value === undefined,
    }),
  ],
  preview: { select: { title: "heading", layout: "layout" }, prepare: ({ title, layout }) => ({ title, subtitle: subtitle("Cards", layout) }) },
});

export const sectionSequence = defineType({
  name: "sectionSequence",
  title: "Steps or timeline",
  type: "object",
  fields: [
    heading,
    lede,
    defineField({ name: "kind", type: "string", options: { list: ["steps", "timeline"] }, initialValue: "steps", validation: (r) => r.required() }),
    defineField({
      name: "items",
      type: "array",
      validation: (r) => r.min(3).max(8),
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({ name: "label", type: "string", description: "Day 1, Week 6, or the step's short name.", validation: (r) => r.required() }),
            defineField({ name: "title", type: "string", validation: (r) => r.required() }),
            defineField({ name: "text", type: "text", rows: 2 }),
            bullets,
            defineField({ name: "image", type: "imageSlot", description: "Shown only when the steps run side by side as tiles or ledger columns." }),
          ],
        }),
      ],
    }),
    blockImage,
    blockLayout,
    side,
    defineField({ name: "callout", type: "callout" }),
  ],
  preview: {
    select: { title: "heading", kind: "kind", layout: "layout" },
    prepare: ({ title, kind, layout }) => ({ title, subtitle: subtitle(kind, layout) }),
  },
});

export const sectionCompare = defineType({
  name: "sectionCompare",
  title: "Compare",
  type: "object",
  fields: [
    heading,
    lede,
    defineField({
      name: "sides",
      type: "array",
      validation: (r) => r.length(2),
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({ name: "title", type: "string", validation: (r) => r.required() }),
            defineField({ name: "bullets", type: "array", of: [{ type: "string" }], validation: (r) => r.min(1) }),
            defineField({ name: "image", type: "imageSlot" }),
          ],
        }),
      ],
    }),
    blockImage,
    blockLayout,
    side,
    defineField({ name: "callout", type: "callout" }),
  ],
  preview: { select: { title: "heading", layout: "layout" }, prepare: ({ title, layout }) => ({ title, subtitle: subtitle("Compare", layout) }) },
});

export const sectionFaq = defineType({
  name: "sectionFaq",
  title: "Questions",
  type: "object",
  fields: [
    defineField({ name: "heading", type: "string" }),
    lede,
    defineField({
      name: "items",
      type: "array",
      validation: (r) => r.min(1),
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({ name: "q", title: "Question", type: "string", validation: (r) => r.required() }),
            defineField({ name: "a", title: "Answer", type: "text", rows: 2, validation: (r) => r.required() }),
          ],
        }),
      ],
    }),
    sectionImage("Shown beside the questions in the split layout."),
    defineField({
      name: "layout",
      type: "string",
      options: {
        list: [
          { title: "Grid — questions two across", value: "grid" },
          { title: "Split — the section photo beside one column of questions", value: "split" },
        ],
        layout: "radio",
      },
      description: "Leave empty for the grid. Split needs a section photo.",
      validation: (r) =>
        r.custom((value, context) => {
          const section = (context.parent ?? {}) as SectionValue;
          return value === "split" && !section.image ? "Split needs a section photo. Add one, or pick the grid." : true;
        }),
    }),
  ],
  preview: {
    select: { title: "heading", layout: "layout" },
    prepare: ({ title, layout }) => ({ title: title ?? "Questions", subtitle: subtitle("FAQ", layout) }),
  },
});

export const sectionCta = defineType({
  name: "sectionCta",
  title: "Close",
  type: "object",
  fields: [
    heading,
    defineField({ name: "text", type: "text", rows: 2, validation: (r) => r.required() }),
    defineField({ name: "links", type: "array", of: [link] }),
    sectionImage("A portrait of Pomi turns the close into a centred sign-off."),
  ],
  preview: { select: { title: "heading" }, prepare: ({ title }) => ({ title, subtitle: "Close" }) },
});

/** The array field a document uses to hold its sections. */
export const sectionsField = defineField({
  name: "sections",
  title: "Sections",
  type: "array",
  description: "The page, one idea per section. Leave empty to show the body text instead.",
  of: [
    { type: "sectionFacts" },
    { type: "sectionStatement" },
    { type: "sectionGrid" },
    { type: "sectionSequence" },
    { type: "sectionCompare" },
    { type: "sectionFaq" },
    { type: "sectionCta" },
  ],
});

export const sectionTypes = [
  imageSlot,
  callout,
  sectionFacts,
  sectionStatement,
  sectionGrid,
  sectionSequence,
  sectionCompare,
  sectionFaq,
  sectionCta,
];
