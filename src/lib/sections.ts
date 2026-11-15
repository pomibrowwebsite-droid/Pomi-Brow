/**
 * Section content model for the slide-style pages (Safety, Aftercare, the Learn guides).
 *
 * A page is a list of sections, each one idea: a strip of facts, a statement with a callout,
 * a group of blocks (cards, steps, two sides), questions, a close. Authored in
 * src/content/seed/*.json (and mirrored in the Sanity schema), rendered by
 * src/components/sections/Sections.astro, checked by the functions below in the tests.
 *
 * Layout is chosen per section from a small library instead of being implied by the data, so
 * a page can rotate compositions the way an editorial designer does: never the same layout
 * twice in a row, never the photo on the same side twice in a row. See DESIGN.md "Slide pages"
 * and docs/superpowers/specs/2026-09-28-info-page-layouts.md for the reasoning and sources.
 *
 * Image slots carry the intended shot as text until a photograph exists; a slot with a
 * `photo` renders the real thing. The word "placeholder" must never reach the page: the
 * build fails on it (scripts/check-no-placeholders.mjs).
 *
 * Plain type-annotated TypeScript only (no enums, no namespaces): `node --test` imports this
 * file directly and only strips types.
 */

export type Ratio = "5 / 2" | "4 / 5" | "3 / 2" | "1 / 1";

/** A seed photo pick, resolved by the content layer to a Photo. */
export interface SeedPhotoRef {
  ref: string;
  alt: string;
  focus?: string;
  detail?: string;
}

export interface ImageSlot {
  ratio: Ratio;
  /** The shot list entry: what the photograph should show. Written inside the empty frame. */
  shot: string;
  photo?: SeedPhotoRef;
  /** A photo uploaded in the Studio (not one of the repo's gallery files), served by Sanity. */
  uploaded?: import("./content").Photo;
}

export interface Link {
  label: string;
  href: string;
}

export interface Callout {
  tone: "note" | "voice" | "caution" | "links";
  title: string;
  text?: string;
  bullets?: string[];
  links?: Link[];
}

export interface FactItem {
  title: string;
  text: string;
}

export interface GridItem {
  title: string;
  text?: string;
  bullets?: string[];
  image?: ImageSlot;
  /** A link card: the whole tile points here, with `linkLabel` as its visible link text. */
  href?: string;
  linkLabel?: string;
  /** Several links under the text (e.g. each service in a category). Not with `href`. */
  links?: Link[];
}

export interface SequenceItem {
  label: string;
  title: string;
  text?: string;
  bullets?: string[];
  /** Shown only where steps stand side by side as boxes or columns (tiles, ledger). */
  image?: ImageSlot;
}

export interface CompareSide {
  title: string;
  bullets: string[];
  image?: ImageSlot;
}

export interface FaqItem {
  q: string;
  a: string;
}

/** Compositions for a group of blocks (cards, steps, two sides). */
export type BlockLayout = "tiles" | "split" | "rail" | "feature" | "bento" | "center" | "ledger";
export type StatementLayout = "split" | "wide";
export type FaqLayout = "grid" | "split";
export type Side = "left" | "right";

export type Section =
  | { type: "facts"; items: FactItem[] }
  | {
      type: "statement";
      heading: string;
      lede?: string;
      paragraphs: string[];
      image?: ImageSlot;
      callout?: Callout;
      layout?: StatementLayout;
      side?: Side;
    }
  | {
      type: "grid";
      heading: string;
      lede?: string;
      items: GridItem[];
      image?: ImageSlot;
      callout?: Callout;
      layout?: BlockLayout;
      side?: Side;
    }
  | {
      type: "sequence";
      heading: string;
      lede?: string;
      kind: "steps" | "timeline";
      items: SequenceItem[];
      image?: ImageSlot;
      callout?: Callout;
      layout?: BlockLayout;
      side?: Side;
    }
  | {
      type: "compare";
      heading: string;
      lede?: string;
      sides: [CompareSide, CompareSide];
      image?: ImageSlot;
      callout?: Callout;
      layout?: BlockLayout;
      side?: Side;
    }
  | { type: "faq"; heading?: string; lede?: string; items: FaqItem[]; image?: ImageSlot; layout?: FaqLayout }
  | { type: "cta"; heading: string; text: string; links?: Link[]; image?: ImageSlot };

export type SectionType = Section["type"];
export type BlockSection = Extract<Section, { type: "grid" | "sequence" | "compare" }>;

/** A page of sections with the header copy that sits above them. */
export interface SectionPage {
  slug: string;
  title: string;
  lede: string;
  meta?: string;
  /** The lead word of the header footnote ("Medical clearance"); `meta` is its detail. */
  metaLabel?: string;
  lead?: ImageSlot;
  /** Facts shown inside the header's copy column (Safety, Aftercare) instead of as a strip. */
  facts?: FactItem[];
  sections: Section[];
}

export interface Problem {
  index: number;
  message: string;
}

/* ------------------------------------------------------------------------------------------ */
/* Layout library                                                                              */
/* ------------------------------------------------------------------------------------------ */

/**
 * Block counts each layout holds, and whether it needs a section photo.
 * "required": the composition is built around the photo (split, feature, bento, center).
 * "optional": the photo is a strip or a rail thumbnail; the layout reads without it.
 * "none": the photos, if any, belong to the blocks (image cards).
 */
export const LAYOUTS: Record<BlockLayout, { min: number; max: number; media: "required" | "optional" | "none" }> = {
  tiles: { min: 2, max: 4, media: "none" },
  split: { min: 2, max: 8, media: "required" },
  rail: { min: 2, max: 8, media: "optional" },
  feature: { min: 2, max: 4, media: "required" },
  bento: { min: 3, max: 4, media: "required" },
  center: { min: 2, max: 2, media: "required" },
  ledger: { min: 2, max: 4, media: "optional" },
};

export const BLOCK_LAYOUTS = Object.keys(LAYOUTS) as BlockLayout[];

/** Where a slot sits, which decides the frame ratio it renders at. */
export type SlotRole = "split" | "rail" | "feature" | "bento" | "center" | "strip" | "item" | "faq" | "cta" | "lead";

/** Frame ratios per slot role; the first is the default. Renderers and tests both use this. */
export const SLOT_RATIOS: Record<SlotRole, Ratio[]> = {
  split: ["4 / 5", "1 / 1"],
  // Square by default: a 4:5 rail photo or centre photo stood taller than the rows or tiles
  // beside it, leaving a void under them.
  rail: ["1 / 1", "4 / 5"],
  feature: ["3 / 2", "1 / 1"],
  bento: ["1 / 1"],
  center: ["1 / 1", "4 / 5"],
  strip: ["5 / 2"],
  item: ["1 / 1", "3 / 2", "4 / 5"],
  faq: ["1 / 1"],
  cta: ["1 / 1"],
  lead: ["4 / 5"],
};

/** The ratio a slot renders at in a given role: the authored one if the role allows it. */
export function effectiveRatio(role: SlotRole, authored?: Ratio): Ratio {
  const allowed = SLOT_RATIOS[role];
  return authored && allowed.includes(authored) ? authored : allowed[0];
}

/** A frame ratio as width over height ("4 / 5" is 0.8), for the sticky photograph's viewport cap. */
export function ratioAspect(ratio: Ratio = "4 / 5"): number {
  const [w, h] = ratio.split("/").map((v) => Number(v.trim()));
  return Number((w / h).toFixed(4));
}

/**
 * Whether a slot is really there. The Studio pre-fills a new section's photo with only its
 * default ratio; until it has a shot brief or a photo it must not count, or an empty section
 * would switch to a photo layout.
 */
export const hasSlot = (slot?: Partial<ImageSlot> | null): slot is ImageSlot =>
  Boolean(slot && (slot.shot || slot.photo?.ref));

export const isBlockSection = (s: Section): s is BlockSection =>
  s.type === "grid" || s.type === "sequence" || s.type === "compare";

const blockCount = (s: BlockSection): number => (s.type === "compare" ? s.sides.length : s.items.length);

/**
 * The layout a section renders with. An authored layout wins when it fits; otherwise:
 * a group with a section photo becomes a split, a sequence without one a rail, anything else
 * tiles. A photo-built layout that has lost its photo falls back the same way, so a
 * half-filled section never shows an empty column.
 */
export function resolveLayout(s: Section): string {
  switch (s.type) {
    case "facts":
      return "facts";
    case "statement":
      if (!hasSlot(s.image)) return "solo";
      return s.layout === "wide" ? "wide" : "split";
    case "faq":
      return s.layout === "split" && hasSlot(s.image) ? "split" : "grid";
    case "cta":
      return hasSlot(s.image) ? "signoff" : "band";
    default: {
      // A section of a type this site does not know (a CMS document never mapped to `type`)
      // has no composition; Sections.astro renders nothing for it.
      if (!isBlockSection(s)) return "none";
      const n = blockCount(s);
      const fits = (l: BlockLayout) => n >= LAYOUTS[l].min && n <= LAYOUTS[l].max && (LAYOUTS[l].media !== "required" || hasSlot(s.image));
      if (s.layout && BLOCK_LAYOUTS.includes(s.layout) && fits(s.layout)) return s.layout;
      if (hasSlot(s.image) && fits("split")) return "split";
      if (s.type === "sequence" && fits("rail")) return "rail";
      if (fits("tiles")) return "tiles";
      return "rail";
    }
  }
}

/** Layouts whose photo sits on a side the author (or assignSides) chooses. The ledger's and the
 *  wide statement's strip sits beside the head, on a side too, whenever there is one. */
const SIDED = new Set(["split", "feature", "bento", "ledger", "wide"]);

/**
 * The media side of each section: "left", "right", "center" or null (no side photo).
 * Explicit `side` wins. Otherwise a sided layout takes the opposite of the last section that
 * had a left or right photo, starting from the page header (whose photo sits on the right),
 * so compositions alternate down the page. A rail and a split FAQ always hang left.
 */
export function assignSides(sections: Section[], headerSide: Side = "right"): (Side | "center" | null)[] {
  let last: Side = headerSide;
  return sections.map((s) => {
    const layout = resolveLayout(s);
    let side: Side | "center" | null = null;
    if (s.type === "faq") side = layout === "split" ? "left" : null;
    else if (s.type === "cta") side = layout === "signoff" ? "center" : null;
    else if (layout === "rail") side = "left";
    else if (layout === "center") side = "center";
    else if (SIDED.has(layout) && (layout !== "ledger" || hasSlot((s as BlockSection).image))) {
      const authored = "side" in s ? s.side : undefined;
      side = authored ?? (last === "left" ? "right" : "left");
    }
    if (side === "left" || side === "right") last = side;
    return side;
  });
}

/** One card, step or side, whatever section it came from. */
export interface Block {
  title: string;
  /** A serif numeral (steps, numbered rows) or a label tag (timeline moments). */
  marker?: { kind: "number"; n: number } | { kind: "tag"; label: string };
  text?: string;
  bullets?: string[];
  image?: ImageSlot;
  /** One link makes the whole block the target; two or more render as a list. */
  links?: Link[];
}

/** The blocks of a grid, sequence or compare section. Only steps are numbered: a list whose
 *  items have no order (what to avoid, what to ask) carries no numerals. */
export function toBlocks(s: BlockSection, layout: string = resolveLayout(s)): Block[] {
  if (s.type === "compare") return s.sides.map((side) => ({ title: side.title, bullets: side.bullets, image: side.image }));
  if (s.type === "sequence")
    return s.items.map((item, i) => ({
      title: item.title,
      text: item.text,
      bullets: item.bullets,
      image: item.image,
      marker: s.kind === "timeline" ? { kind: "tag", label: item.label } : { kind: "number", n: i + 1 },
    }));
  return s.items.map((item) => ({
    title: item.title,
    text: item.text,
    bullets: item.bullets,
    image: item.image,
    links: item.links?.length ? item.links : item.href ? [{ label: item.linkLabel ?? "Read", href: item.href }] : undefined,
  }));
}

/** The role, and so the frame ratio, of a section's own photo under its resolved layout. */
export function sectionImageRole(s: Section, layout: string = resolveLayout(s)): SlotRole {
  if (s.type === "faq") return "faq";
  if (s.type === "cta") return "cta";
  if (layout === "wide" || layout === "ledger") return "strip";
  if (layout === "rail" || layout === "feature" || layout === "bento" || layout === "center") return layout;
  return "split";
}

/** Layouts that draw a block's own photograph: blocks side by side as boxes or columns. */
const ITEM_PHOTOS = new Set(["tiles", "ledger"]);

/** Whether a section's own photograph is drawn under its resolved layout. */
function drawsSectionImage(s: Section, layout: string): boolean {
  if (s.type === "faq") return layout === "split";
  if (s.type === "statement" || s.type === "cta") return layout !== "solo" && layout !== "band";
  if (isBlockSection(s)) return LAYOUTS[layout as BlockLayout]?.media !== "none";
  return false;
}

/** The image slots a section draws, with the role each renders in. Photos a layout has no place
 *  for (a section photo under tiles, a card's photo in rows) are left out: they never render. */
export function sectionSlots(s: Section, layout: string = resolveLayout(s)): { role: SlotRole; slot: ImageSlot }[] {
  const out: { role: SlotRole; slot: ImageSlot }[] = [];
  if ("image" in s && hasSlot(s.image) && drawsSectionImage(s, layout)) out.push({ role: sectionImageRole(s, layout), slot: s.image });
  if (ITEM_PHOTOS.has(layout)) {
    if (s.type === "grid" || s.type === "sequence")
      (s.items as { image?: ImageSlot }[]).forEach((item) => hasSlot(item.image) && out.push({ role: "item", slot: item.image }));
    if (s.type === "compare") s.sides.forEach((side) => hasSlot(side.image) && out.push({ role: "item", slot: side.image }));
  }
  return out;
}

/** Every image slot a page draws with the role it renders in, in page order. */
export function pageSlots(page: Pick<SectionPage, "lead" | "sections">): { role: SlotRole; slot: ImageSlot; index: number }[] {
  const out: { role: SlotRole; slot: ImageSlot; index: number }[] = [];
  if (hasSlot(page.lead)) out.push({ role: "lead", slot: page.lead, index: -1 });
  page.sections.forEach((s, index) => sectionSlots(s).forEach((x) => out.push({ ...x, index })));
  return out;
}

/**
 * A section as the renderers should see it: image slots that are not really there (a ratio the
 * Studio pre-filled, with no brief and no photo) removed, at section and block level, so every
 * component can test for a photo by presence and agree with resolveLayout().
 */
export function withSlots<T extends Section>(s: T): T {
  const clean = (slot?: ImageSlot) => (hasSlot(slot) ? slot : undefined);
  const out: any = { ...s };
  if ("image" in out) out.image = clean(out.image);
  if (Array.isArray(out.items)) out.items = out.items.map((i: any) => ("image" in (i ?? {}) ? { ...i, image: clean(i.image) } : i));
  if (Array.isArray(out.sides)) out.sides = out.sides.map((i: any) => ("image" in (i ?? {}) ? { ...i, image: clean(i.image) } : i));
  return out;
}

/* ------------------------------------------------------------------------------------------ */
/* Structural validation (every page, CMS included)                                           */
/* ------------------------------------------------------------------------------------------ */

const TYPES = new Set<SectionType>(["facts", "statement", "grid", "sequence", "compare", "faq", "cta"]);
const BANNED = /placeholder/i;
const SIDES = new Set(["left", "right"]);

/** Every string a section can put on the page. */
function visibleStrings(s: any): string[] {
  const out: string[] = [];
  const walk = (v: any) => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") for (const [k, val] of Object.entries(v)) if (k !== "href" && k !== "ref") walk(val);
  };
  walk(s);
  return out;
}

/** Problems with a page's sections; an empty list means the page is well-formed. */
export function validateSections(sections: Section[]): Problem[] {
  const problems: Problem[] = [];
  sections.forEach((s: any, index) => {
    const add = (message: string) => problems.push({ index, message });
    if (!TYPES.has(s?.type)) {
      add(`unknown type "${s?.type}"`);
      return;
    }
    const needsHeading = s.type !== "facts" && s.type !== "faq";
    if (needsHeading && !s.heading) add(`${s.type} needs a heading`);
    if (s.side !== undefined && !SIDES.has(s.side)) add('side must be "left" or "right"');

    switch (s.type as SectionType) {
      case "facts":
        if (!Array.isArray(s.items) || s.items.length < 2 || s.items.length > 4) add("facts needs 2 to 4 items");
        break;
      case "statement":
        if (!Array.isArray(s.paragraphs) || s.paragraphs.length === 0) add("statement needs paragraphs");
        if (s.layout !== undefined && s.layout !== "split" && s.layout !== "wide") add('statement layout must be "split" or "wide"');
        break;
      case "grid":
        if (!Array.isArray(s.items) || s.items.length < 2 || s.items.length > 6) add("grid needs 2 to 6 items");
        if (Array.isArray(s.items) && s.items.some((i: any) => (i?.href && !i?.linkLabel) || (!i?.href && i?.linkLabel)))
          add("a link card needs both href and linkLabel");
        if (Array.isArray(s.items) && s.items.some((i: any) => i?.href && i?.links)) add("a card takes href or links, not both");
        break;
      case "sequence":
        if (s.kind !== "steps" && s.kind !== "timeline") add('sequence kind must be "steps" or "timeline"');
        if (!Array.isArray(s.items) || s.items.length < 3 || s.items.length > 8) add("sequence needs 3 to 8 items");
        break;
      case "compare":
        if (!Array.isArray(s.sides) || s.sides.length !== 2) add("compare needs exactly 2 sides");
        break;
      case "faq":
        if (!Array.isArray(s.items) || s.items.length === 0) add("faq needs items");
        else if (s.items.some((i: any) => !i?.q || !i?.a)) add("every faq item needs q and a");
        if (s.layout !== undefined && s.layout !== "grid" && s.layout !== "split") add('faq layout must be "grid" or "split"');
        if (s.layout === "split" && !hasSlot(s.image)) add("a split faq needs an image");
        break;
      case "cta":
        if (!s.text) add("cta needs text");
        break;
    }

    if (isBlockSection(s) && s.layout !== undefined) {
      const spec = LAYOUTS[s.layout as BlockLayout];
      const n = s.type === "compare" ? s.sides?.length ?? 0 : s.items?.length ?? 0;
      if (!spec) add(`unknown layout "${s.layout}"`);
      else {
        if (n < spec.min || n > spec.max) add(`${s.layout} holds ${spec.min} to ${spec.max} blocks, not ${n}`);
        if (spec.media === "required" && !hasSlot(s.image)) add(`${s.layout} needs a section image`);
      }
    }

    // A photograph the layout has no place for would be dropped without a word.
    if (isBlockSection(s) && (s.type === "compare" ? Array.isArray(s.sides) : Array.isArray(s.items))) {
      const layout = resolveLayout(s);
      const blocks: any[] = s.type === "compare" ? s.sides : s.items;
      if (hasSlot(s.image) && LAYOUTS[layout as BlockLayout]?.media === "none")
        add(`${layout} has no place for a section image; give each block its own, or pick a layout with one`);
      if (!ITEM_PHOTOS.has(layout) && blocks.some((b) => hasSlot(b?.image)))
        add(`${layout} does not show a block's own image; only tiles and ledger do`);
    }
    if (s.type === "faq" && hasSlot(s.image) && s.layout !== "split") add('a faq image shows only with layout "split"');

    const banned = visibleStrings(s).find((t) => BANNED.test(t));
    if (banned) add(`visible text contains "placeholder": ${JSON.stringify(banned)}`);
  });
  return problems;
}

/** Site-relative hrefs (starting with "/") across callouts, link cards and cta links, in page order. */
export function internalHrefs(sections: Section[]): string[] {
  const out: string[] = [];
  const walk = (v: any) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      if (typeof v.href === "string" && v.href.startsWith("/")) out.push(v.href);
      for (const val of Object.values(v)) if (val && typeof val === "object") walk(val);
    }
  };
  walk(sections);
  return out;
}

/* ------------------------------------------------------------------------------------------ */
/* Rhythm: the editorial rules for the authored seed pages                                    */
/* ------------------------------------------------------------------------------------------ */

export const words = (t?: string): number => (t ? t.trim().split(/\s+/).filter(Boolean).length : 0);

/**
 * The key two neighbouring sections must not share. Statements and block groups share layout
 * names (a statement split next to a grid split reads as the same composition); questions and
 * the close are their own components and are keyed apart.
 */
export function rhythmKey(s: Section): string {
  const layout = resolveLayout(s);
  if (s.type === "faq" || s.type === "cta") return `${s.type}:${layout}`;
  // A wide statement is a ledger's head row over paragraphs: the same composition.
  return layout === "wide" ? "ledger" : layout;
}

const isSplitStyle = (key: string) => key === "split" || key === "faq:split";

const hasImage = (s: Section): boolean => sectionSlots(s).length > 0;

/** Word counts are close enough when the longest is within 1.5× the shortest or 3 words of it. */
export function balanced(counts: number[]): boolean {
  if (counts.length < 2) return true;
  const lo = Math.min(...counts);
  const hi = Math.max(...counts);
  return hi <= lo * 1.5 || hi - lo <= 3;
}

const blockWords = (b: Block) => words(b.text) + (b.bullets ?? []).reduce((n, t) => n + words(t), 0);

export interface RhythmOptions {
  /** Where the header's photo sits; the first sided section alternates away from it. */
  headerSide?: Side;
  /** Learn guides hold at most 8 sections after the facts strip. */
  learn?: boolean;
}

/**
 * The editorial rules from DESIGN.md "Slide pages", as problems. Run by the tests on every
 * authored seed page; not run on CMS content, which only has to be well-formed.
 */
export function pageRhythmProblems(sections: Section[], opts: RhythmOptions = {}): Problem[] {
  const problems: Problem[] = [];
  const add = (index: number, message: string) => problems.push({ index, message });
  const sides = assignSides(sections, opts.headerSide ?? "right");
  const keys = sections.map(rhythmKey);
  const content = sections.map((s, i) => ({ s, i })).filter(({ s }) => s.type !== "facts");

  // 1. Neighbours never share a layout. 2. Neighbouring side photos sit on opposite sides.
  for (let k = 1; k < content.length; k++) {
    const a = content[k - 1];
    const b = content[k];
    if (keys[a.i] === keys[b.i]) add(b.i, `same layout as the section before it ("${keys[b.i]}")`);
    const sa = sides[a.i];
    const sb = sides[b.i];
    if ((sa === "left" || sa === "right") && sa === sb) add(b.i, `photo on the ${sb} again, right after a ${sa}-side photo`);
  }
  // …and the first sided section does not repeat the header's side.
  const first = content[0];
  if (first && sides[first.i] === (opts.headerSide ?? "right")) add(first.i, `photo on the ${sides[first.i]}, the same side as the header photo`);

  // 3. Each layout at most twice; tiles twice only with different counts.
  const seen = new Map<string, number[]>();
  content.forEach(({ i }) => seen.set(keys[i], [...(seen.get(keys[i]) ?? []), i]));
  for (const [key, at] of seen) {
    if (at.length > 2) add(at[2], `"${key}" is used ${at.length} times; at most twice per page`);
    if (key === "tiles" && at.length === 2) {
      const [x, y] = at.map((i) => blockCount(sections[i] as BlockSection));
      if (x === y) add(at[1], `tiles used twice with the same count (${x}); vary the composition`);
    }
  }

  // 4. No three split-style sections in a row.
  for (let k = 2; k < content.length; k++) {
    if ([k - 2, k - 1, k].every((j) => isSplitStyle(keys[content[j].i]))) add(content[k].i, "third split-style section in a row");
  }

  // 5. Every section except the facts strip carries a photo or a "Photo to come" frame.
  content.forEach(({ s, i }) => {
    if (!hasImage(s)) add(i, `${s.type} has no image`);
  });

  // 6. Balance and length.
  sections.forEach((s, i) => {
    if (s.type === "facts") {
      if (!balanced(s.items.map((f) => words(f.text)))) add(i, "facts are uneven in length; give each box the same amount");
      return;
    }
    if (!isBlockSection(s)) return;
    const layout = resolveLayout(s);
    const blocks = toBlocks(s, layout);
    const counts = blocks.map(blockWords);
    const cap = layout === "tiles" ? 25 : 45;
    blocks.forEach((b, j) => {
      if (counts[j] > cap) add(i, `"${b.title}" runs ${counts[j]} words; ${layout} blocks hold ${cap} at most`);
      if ((b.bullets?.length ?? 0) > 4) add(i, `"${b.title}" has ${b.bullets!.length} bullets; 4 at most`);
    });
    if (layout === "tiles" && !balanced(counts)) add(i, "tiles are uneven in length; give each tile the same amount");
  });

  // 7. Notes: at most 3 per page and never on neighbouring sections (medical cautions exempt).
  const noted = content.filter(({ s }) => "callout" in s && s.callout && s.callout.tone !== "caution").map(({ i }) => i);
  if (noted.length > 3) add(noted[3], `${noted.length} notes on the page; 3 at most (medical cautions aside)`);
  const order = content.map(({ i }) => i);
  for (let k = 1; k < noted.length; k++) {
    if (order.indexOf(noted[k]) - order.indexOf(noted[k - 1]) === 1) add(noted[k], "a note right after another note");
  }
  sections.forEach((s, i) => {
    if (s.type === "statement" && s.paragraphs.length > 2) add(i, `statement has ${s.paragraphs.length} paragraphs; 2 at most`);
  });

  // 8. Learn guides stay short.
  if (opts.learn && content.length > 8) add(content[8].i, `${content.length} sections after the facts strip; 8 at most`);

  return problems;
}

/* ------------------------------------------------------------------------------------------ */
/* Photos: real gallery picks against the catalogue                                           */
/* ------------------------------------------------------------------------------------------ */

/** One entry of src/assets/gallery/catalogue.json. */
export interface CatalogueEntry {
  kind: "single" | "pair-v" | "pair-h" | "collage";
  service?: string;
  subject?: string;
  ratios: Ratio[];
  focus?: Partial<Record<Ratio, string>>;
  caption?: string;
  duplicateOf?: string;
}

export type Catalogue = Record<string, CatalogueEntry | string>;

/**
 * Problems with the real photographs on one page: unknown refs, a photo shown twice (byte-
 * identical duplicates count as one), a frame ratio the photo cannot survive, and pairs not
 * captioned as pairs. `used` lists refs already on the page outside the sections (the cover).
 */
export function photoProblems(page: Pick<SectionPage, "lead" | "sections">, catalogue: Catalogue, used: string[] = []): Problem[] {
  const problems: Problem[] = [];
  const entry = (ref: string) => {
    const e = catalogue[ref];
    return e && typeof e === "object" ? e : undefined;
  };
  const identity = (ref: string) => entry(ref)?.duplicateOf ?? ref;
  const seen = new Set(used.map(identity));
  for (const { role, slot, index } of pageSlots(page)) {
    const ref = slot.photo?.ref;
    if (!ref) continue;
    const e = entry(ref);
    if (!e) {
      problems.push({ index, message: `photo "${ref}" is not in the catalogue` });
      continue;
    }
    const id = identity(ref);
    if (seen.has(id)) problems.push({ index, message: `photo "${ref}" is already on this page` });
    seen.add(id);
    const ratio = effectiveRatio(role, slot.ratio);
    if (!e.ratios.includes(ratio)) problems.push({ index, message: `photo "${ref}" (${e.kind}) cannot be framed at ${ratio} in a ${role} slot` });
    if (role === "strip" && e.kind !== "single") problems.push({ index, message: `photo "${ref}" is a ${e.kind}; strips take single shots only` });
    if (e.kind !== "single" && e.kind !== "collage" && slot.photo?.detail !== "Before and after")
      problems.push({ index, message: `photo "${ref}" is a before/after pair; caption it "Before and after"` });
  }
  return problems;
}
