/**
 * Content layer. Reads from Sanity when PUBLIC_SANITY_PROJECT_ID is set,
 * otherwise from src/content/seed/*.json so the site builds before a project exists.
 * Every getter returns the same normalized shape either way.
 */
import type { ImageMetadata } from "astro";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import imageUrlBuilder from "@sanity/image-url";
import seedSettings from "../content/seed/siteSettings.json";
import seedServices from "../content/seed/services.json";
import seedReviews from "../content/seed/reviews.json";
import seedLearn from "../content/seed/learn.json";
import seedPages from "../content/seed/pages.json";
import catalogue from "../assets/gallery/catalogue.json";
import type { ImageSlot, Section, SectionPage, SeedPhotoRef } from "./sections";

/** What the ruled caption under a photo says beyond its alt text. */
interface PhotoCaption {
  /** Slug of the service shown, when known; captions look up the price from it. */
  serviceSlug?: string;
  /** What the photo shows: "Healed", "Mapped and healed", "Before and after". */
  detail?: string;
  /** object-position for the crop, e.g. "50% 85%". Every source is square, so a
      cropped placement travels with the photo rather than living in a stylesheet. */
  focus?: string;
}

export type Photo = PhotoCaption &
  (
    | { kind: "local"; image: ImageMetadata; alt: string; source: string }
    | { kind: "remote"; src: string; srcset: string; width: number; height: number; alt: string }
  );

/** A seed Instagram pick: a gallery ref, optionally with its own detail and alt. From Sanity, a
    photo uploaded in the Studio arrives as a ready Photo instead. */
type SeedPick = string | { ref: string; detail?: string; alt?: string; focus?: string } | Photo;
const isPhoto = (p: unknown): p is Photo => Boolean(p && typeof p === "object" && "kind" in p);

/** A Sanity portable-text block array. Rendered by PortableText.astro. */
export type PortableBlock = Record<string, any>;

export interface Service {
  title: string;
  slug: string;
  category: string;
  order: number;
  price: number;
  priceUnit?: string;
  touchUpPrice?: number;
  priceNote?: string;
  summary?: string;
  /** Long-form body. Present in the CMS schema as `description`; may be absent. */
  description?: PortableBlock[];
  /** SEO title carried over from the previous site, e.g. "MICROBLADING IN TUSTIN, CA | ...". */
  seoTitle?: string;
  /** The one photograph that represents this service in a card or a page header. */
  cover?: Photo;
  gallery: Photo[];
  showOnHome: boolean;
}

export interface Review {
  quote: string;
  /** A shortened quote for the card, cut with "…" where words were left out. The card then
      links to the full review. The full quote still feeds the JSON-LD. */
  excerpt?: string;
  reviewer: string;
  source: string;
  sourceUrl?: string;
  serviceSlug?: string;
  /** Stars as the reviewer left them, 1-5. Drives the per-card rating row and the JSON-LD. */
  rating?: number;
  /** Date as shown on the listing, ISO (2026-01-14). Shown as month and year. */
  date?: string;
  isPlaceholder: boolean;
}

export interface LearnArticle {
  title: string;
  slug: string;
  summary: string;
  /** Long-form body. Defined in the CMS schema and, until now, never requested. */
  body?: PortableBlock[];
  /** The slide-style page: when present it renders instead of `body`. See lib/sections.ts. */
  sections?: Section[];
  /** The lead image slot when the article has no real cover yet. */
  lead?: ImageSlot;
  /** SEO title carried over from the previous site. */
  seoTitle?: string;
  /** Chosen per article, not per service: three articles share one service and
      would otherwise show the same picture side by side on the index. */
  cover?: Photo;
  relatedService?: string | null;
  /** The guide to its related service itself, as opposed to a question about it. It leads
      that service page's reading list. */
  serviceGuide?: boolean;
  showAsFaq: boolean;
}

export interface Hours {
  days: string;
  opens: string;
  closes: string;
}

export interface SiteSettings {
  businessName: string;
  phone: string;
  phoneTel: string;
  email: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  locationLine: string;
  mapEmbedUrl: string;
  mapLinkUrl: string;
  hours: Hours[];
  hoursNote: string;
  bookingUrl: string;
  bookingHref: string;
  yelpUrl: string;
  /** The listing's overall star rating, e.g. 5. Distinct from the five-star count below. */
  yelpRating: number;
  /** How many of the reviews are five stars. Kept under its original name so existing CMS data survives. */
  yelpReviewCount: number;
  /** Reviews that are not five stars. The site names this out loud rather than rounding it away. */
  yelpOtherReviewCount: number;
  instagramHandle: string;
  instagramUrl: string;
  instagramLiveFeed: boolean;
  instagramPicks: Photo[];
  aboutHeading: string;
  bio: string[];
  bioIsPlaceholder: boolean;
  headshot: Photo | null;
  metaDescription: string;
}

const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID;
const dataset = import.meta.env.PUBLIC_SANITY_DATASET || "production";
export const usingSanity = Boolean(projectId && projectId !== "placeholder");

// Local gallery imported from the client's MEDIA folder (see scripts/import-media.mjs).
const gallery = import.meta.glob<{ default: ImageMetadata }>("/src/assets/gallery/**/*.jpg", {
  eager: true,
});

/** A service's display title from its slug (also a gallery folder name), for photo captions. */
export function serviceTitle(slug?: string): string | undefined {
  return slug ? serviceTitles[slug] : undefined;
}

const serviceTitles: Record<string, string> = Object.fromEntries(
  (seedServices as any[]).map((s) => [s.slug, s.title])
);

export function localPhoto(ref: string, alt?: string): Photo | null {
  const key = `/src/assets/gallery/${ref}.jpg`;
  const mod = gallery[key];
  if (!mod) return null;
  const folder = ref.split("/")[0];
  const title = serviceTitles[folder] ?? folder;
  return {
    kind: "local",
    image: mod.default,
    alt: alt ?? `${title} by Pomi B. Brow Studio, healed result`,
    source: key,
    serviceSlug: folder in serviceTitles ? folder : undefined,
  };
}

export function localGallery(folder: string): Photo[] {
  return Object.keys(gallery)
    .filter((k) => k.startsWith(`/src/assets/gallery/${folder}/`))
    .sort()
    .map((k) => localPhoto(k.replace("/src/assets/gallery/", "").replace(/\.jpg$/, ""))!)
    .filter(Boolean);
}

function portableToParagraphs(blocks: unknown): string[] {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .filter((b: any) => b?._type === "block")
    .map((b: any) => (b.children ?? []).map((c: any) => c.text ?? "").join(""))
    .filter((t: string) => t.trim().length > 0);
}

/**
 * Sanity picks carry only an `alt` string, so the caption reads it as "Service, what the photo shows":
 * "Lip Tint, before and after" captions as LIP TINT / BEFORE AND AFTER. No comma means no detail.
 */
function captionFromAlt(alt?: string): PhotoCaption {
  if (!alt) return {};
  const comma = alt.indexOf(",");
  if (comma < 0) return {};
  const service = (seedServices as any[]).find((s) => s.title.toLowerCase() === alt.slice(0, comma).trim().toLowerCase());
  return { serviceSlug: service?.slug, detail: alt.slice(comma + 1).trim() || undefined };
}

function remotePhoto(img: any, alt: string): Photo | null {
  if (!img?.asset) return null;
  const builder = imageUrlBuilder({ projectId: projectId!, dataset });
  const base = builder.image(img).auto("format").quality(80);
  const widths = [480, 800, 1200, 1600];
  const dims = img.asset?.metadata?.dimensions ?? { width: 1320, height: 1320 };
  return {
    kind: "remote",
    src: base.width(1200).url(),
    srcset: widths.map((w) => `${base.width(w).url()} ${w}w`).join(", "),
    width: dims.width,
    height: dims.height,
    alt,
  };
}

// ---------------------------------------------------------------------------------------------
// Sanity. Every document is turned back into the seed's own shape and then goes through the same
// normalisers as the seed, so a page cannot tell which source it was built from.
//
// The import (scripts/sanity-import.mjs) uploads the repo's gallery photos and marks each image
// with the file it came from (`galleryRef`, hidden in the Studio). While an image's pixels are
// still that file's, it renders from the repo's own optimised copy, exactly as before. A photo
// Pomi uploads or replaces, or one she crops in the Studio, is served from Sanity's image CDN.
// The hotspot is the crop point (object-position) either way.

const ASSET = `asset->{url, originalFilename, sha1hash, metadata{dimensions}}`;
const IMAGE = `{..., ${ASSET}}`;
const SLOT = `{..., photo${IMAGE}}`;
const SECTIONS = `sections[]{..., image${SLOT}, items[]{..., image${SLOT}}, sides[]{..., image${SLOT}}}`;

const fileHashes = new Map<string, string | null>();
/** sha1 of a repo gallery file, to tell whether a Sanity image is still that photograph. */
function gallerySha1(ref: string): string | null {
  if (!fileHashes.has(ref)) {
    let hash: string | null = null;
    try {
      hash = createHash("sha1").update(readFileSync(`${process.cwd()}/src/assets/gallery/${ref}.jpg`)).digest("hex");
    } catch {
      /* not a repo photo */
    }
    fileHashes.set(ref, hash);
  }
  return fileHashes.get(ref)!;
}

/** The repo file a Sanity image still is, or undefined when it must come from Sanity. */
function galleryRefOf(img: any): string | undefined {
  const ref = typeof img?.galleryRef === "string" ? img.galleryRef : undefined;
  if (!ref || !img.asset?.sha1hash) return undefined;
  const c = img.crop;
  if (c && [c.top, c.bottom, c.left, c.right].some((v: number | undefined) => (v ?? 0) > 0.001)) return undefined;
  return gallerySha1(ref) === img.asset.sha1hash ? ref : undefined;
}

const percent = (n: number) => `${Math.round(n * 1000) / 10}%`;
/** The Studio hotspot as a CSS object-position, "50% 85%". */
export const hotspotFocus = (img: any): string | undefined =>
  img?.hotspot && typeof img.hotspot.x === "number" ? `${percent(img.hotspot.x)} ${percent(img.hotspot.y)}` : undefined;

/** Copy only the keys that hold a value, so a converted object has the seed's exact shape. */
function defined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null)) as Partial<T>;
}

/** A Sanity image as a seed pick { ref, alt, detail, focus }, or a ready remote Photo. */
function pickFromSanity(img: any, fallbackAlt: string, detail = img?.detail): SeedPick | undefined {
  if (!img?.asset) return undefined;
  const focus = hotspotFocus(img);
  const ref = galleryRefOf(img);
  if (ref) return defined({ ref, alt: img.alt, detail, focus }) as SeedPick;
  const photo = remotePhoto(img, img.alt || fallbackAlt);
  return photo ? { ...photo, ...defined({ detail, focus }) } : undefined;
}

/** A Sanity imageSlot as the seed's { ratio, shot, photo: { ref, ... } } or with an uploaded photo. */
function slotFromSanity(slot: any): ImageSlot | undefined {
  if (!slot) return undefined;
  const { photo, _type, _key, ...rest } = slot;
  const pick = pickFromSanity(photo, slot.shot ?? "");
  if (!pick) return stripSanity(rest);
  if (isPhoto(pick)) return { ...stripSanity(rest), uploaded: pick };
  return { ...stripSanity(rest), photo: pick as ImageSlot["photo"] };
}

/** Drop Sanity's bookkeeping (_key, _type, nulls from projections) all the way down. */
function stripSanity(value: any): any {
  if (Array.isArray(value)) return value.map(stripSanity);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (k.startsWith("_") || v === null || v === undefined) continue;
    out[k] = stripSanity(v);
  }
  return out;
}

const SECTION_TYPE: Record<string, string> = {
  sectionFacts: "facts",
  sectionStatement: "statement",
  sectionGrid: "grid",
  sectionSequence: "sequence",
  sectionCompare: "compare",
  sectionFaq: "faq",
  sectionCta: "cta",
};

/** Studio sections ({ _type: "sectionGrid", ... }) as the seed's ({ type: "grid", ... }). */
function sectionsFromSanity(sections: any[] | null | undefined): Section[] | undefined {
  if (!Array.isArray(sections)) return undefined;
  return sections.map((s) => {
    const { _type, _key, image, items, sides, ...rest } = s;
    const out: Record<string, unknown> = { type: SECTION_TYPE[_type] ?? _type, ...stripSanity(rest) };
    if (image) out.image = slotFromSanity(image);
    const block = (b: any) => {
      const { image: slot, ...fields } = b;
      return { ...stripSanity(fields), ...(slot ? { image: slotFromSanity(slot) } : {}) };
    };
    if (items) out.items = items.map(block);
    if (sides) out.sides = sides.map(block);
    return out as unknown as Section;
  });
}

/** Portable-text paragraphs as plain strings (the bio). */
function paragraphsFromSanity(blocks: unknown): string[] {
  return portableToParagraphs(blocks);
}

function normalizeSeedSettings(raw: any = seedSettings): SiteSettings {
  const s = raw;
  return {
    ...s,
    hours: s.hours ?? [],
    bookingHref: s.bookingUrl || `tel:${s.phoneTel}`,
    instagramLiveFeed: s.instagramLiveFeed !== false,
    instagramPicks: ((s.instagramPicks ?? []) as SeedPick[])
      .map((pick) => {
        if (isPhoto(pick)) return pick;
        const { ref, detail, alt, focus } = typeof pick === "string" ? { ref: pick } as { ref: string; detail?: string; alt?: string; focus?: string } : pick;
        const photo = localPhoto(ref, alt);
        return photo && { ...photo, detail, ...(focus ? { focus } : {}) };
      })
      .filter((p): p is Photo => Boolean(p)),
    bio: s.bio ?? [],
    bioIsPlaceholder: Boolean(s.bioIsPlaceholder),
    yelpRating: s.yelpRating ?? 5,
    yelpOtherReviewCount: s.yelpOtherReviewCount ?? 0,
    // A gallery ref, e.g. "pomi/portrait" -- her Instagram profile photo until she supplies one.
    headshot: isPhoto(s.headshot)
      ? s.headshot
      : s.headshot
        ? localPhoto(typeof s.headshot === "string" ? s.headshot : s.headshot.ref, "Pomi, permanent makeup artist")
        : null,
  };
}

/** A section's image slot photo, by gallery ref. */
export function resolveSeedPhoto(pick: SeedPhotoRef): Photo | undefined {
  return seedCover(pick);
}

/** Resolve a seed { ref, focus, alt, detail } pick to a Photo carrying its crop point. */
/** The catalogue's caption for a gallery photo: "Before and after", "Two views", "Close-up",
 *  "Fresh". A cover with no authored detail says what the photograph is, not the page title. */
function catalogueCaption(ref: string): string | undefined {
  const entry = (catalogue as Record<string, unknown>)[ref];
  return entry && typeof entry === "object" ? (entry as { caption?: string }).caption : undefined;
}

function seedCover(pick: SeedPick | undefined): Photo | undefined {
  if (!pick) return undefined;
  if (isPhoto(pick)) return pick;
  const { ref, detail, alt, focus } = typeof pick === "string" ? { ref: pick } : (pick as any);
  const photo = localPhoto(ref, alt);
  return photo ? { ...photo, detail: detail ?? catalogueCaption(ref), focus } : undefined;
}

/** A service's gallery: an explicit list (from Sanity) or every photo in its repo folder. */
function serviceGallery(s: any): Photo[] {
  if (Array.isArray(s.gallery)) {
    return (s.gallery as SeedPick[])
      .map((pick) => {
        if (isPhoto(pick)) return pick;
        const { ref, alt, detail, focus } = typeof pick === "string" ? ({ ref: pick } as any) : (pick as any);
        const photo = localPhoto(ref, alt);
        return photo && { ...photo, ...defined({ detail, focus }) };
      })
      .filter((p): p is Photo => Boolean(p));
  }
  return s.galleryFolder ? localGallery(s.galleryFolder) : [];
}

function normalizeSeedServices(rows: any[] = seedServices as any[]): Service[] {
  return rows
    .map((s) => ({
      ...s,
      cover: seedCover(s.cover),
      gallery: serviceGallery(s),
      showOnHome: s.showOnHome !== false,
    }))
    .sort((a, b) => a.order - b.order);
}

function normalizeSeedLearn(rows: any[] = seedLearn as any[]): LearnArticle[] {
  return rows.map((a) => ({ ...a, cover: seedCover(a.cover) }));
}

function normalizeSeedReviews(rows: any[] = seedReviews as any[]): Review[] {
  return rows.map((r) => ({ ...r, isPlaceholder: Boolean(r.isPlaceholder) }));
}

async function client(): Promise<{ fetch: (query: string, params?: Record<string, unknown>) => Promise<any> }> {
  // The parity check (scripts/sanity-parity.mjs) builds from the import's own output instead
  // of a live project, so the two sources can be compared page by page.
  if (process.env.SANITY_FIXTURE) return (await import("./sanity-fixture")).fixtureClient(process.env.SANITY_FIXTURE);
  const mod = await import("sanity:client");
  return mod.sanityClient;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  if (!usingSanity) return normalizeSeedSettings();
  const c = await client();
  const s = await c.fetch(`*[_id == "siteSettings"][0]{..., instagramPicks[]${IMAGE}, headshot${IMAGE}}`);
  if (!s) return normalizeSeedSettings();
  const { instagramPicks, headshot, bio, ...rest } = s;
  const handle = rest.instagramHandle ?? (seedSettings as any).instagramHandle;
  const paragraphs = paragraphsFromSanity(bio);
  return normalizeSeedSettings({
    // A field left empty in the Studio falls back to the seed rather than breaking the page.
    ...(seedSettings as any),
    ...stripSanity(rest),
    instagramPicks: ((instagramPicks ?? []) as any[])
      .map((img) => {
        const pick = pickFromSanity(img, `@${handle} on Instagram`);
        // An uploaded pick has no folder to name its service; its alt says it ("Lip Tint, healed").
        return pick && isPhoto(pick) ? { ...defined(captionFromAlt(img.alt)), ...pick } : pick;
      })
      .filter(Boolean),
    headshot: pickFromSanity(headshot, "Pomi, permanent makeup artist") ?? null,
    bio: paragraphs,
    bioIsPlaceholder: paragraphs.some((p) => /placeholder/i.test(p)),
  });
}

export async function getServices(): Promise<Service[]> {
  if (!usingSanity) return normalizeSeedServices();
  const c = await client();
  const rows: any[] = await c.fetch(`*[_type == "service"] | order(order asc){
    ..., "slug": slug.current, cover${IMAGE}, gallery[]${IMAGE}
  }`);
  if (!rows?.length) return normalizeSeedServices();
  return normalizeSeedServices(
    rows.map(({ cover, gallery, description, ...rest }) => ({
      ...stripSanity(rest),
      // Portable text keeps its _type and _key: PortableText.astro reads them.
      ...(description ? { description } : {}),
      cover: pickFromSanity(cover, `${rest.title} by Pomi B. Brow Studio`),
      gallery: ((gallery ?? []) as any[])
        .map((img) =>
          pickFromSanity(img, img.caption ? `${rest.title}: ${img.caption}` : `${rest.title} by Pomi B. Brow Studio`, img.caption),
        )
        .filter(Boolean),
    })),
  );
}

/**
 * The reviews that may ship. A placeholder review is not a review, and the home page
 * promises words copied from Yelp, so scaffolding never reaches the page. Exported because
 * index.astro has to know which reviews render in order to pair photographs with them
 * without the two disagreeing.
 */
export function visibleReviews(reviews: Review[], limit = 3): Review[] {
  const isPlaceholder = (v: string | undefined | null) => /placeholder/i.test(v ?? "");
  return reviews.filter((r) => !isPlaceholder(r.quote) && !isPlaceholder(r.reviewer)).slice(0, limit);
}

export async function getReviews(): Promise<Review[]> {
  if (!usingSanity) return normalizeSeedReviews();
  const c = await client();
  const rows: any[] = await c.fetch(`*[_type == "review" && showOnHome == true] | order(order asc){
    ..., "serviceSlug": service->slug.current
  }`);
  if (!rows?.length) return [];
  return normalizeSeedReviews(rows.map(({ service, ...rest }) => stripSanity(rest)));
}

/** A slide-style page that is not a Learn article (Safety, Aftercare). */
export async function getPage(slug: string): Promise<SectionPage | null> {
  const seed = (seedPages as SectionPage[]).find((p) => p.slug === slug) ?? null;
  if (!usingSanity) return seed;
  const c = await client();
  const p = await c.fetch(`*[_type == "page" && slug.current == $slug][0]{..., "slug": slug.current, lead${SLOT}, ${SECTIONS}}`, { slug });
  if (!p) return seed;
  const { lead, sections, ...rest } = p;
  return {
    ...stripSanity(rest),
    ...(lead ? { lead: slotFromSanity(lead) } : {}),
    sections: sectionsFromSanity(sections) ?? [],
  } as SectionPage;
}

export async function getLearnArticles(): Promise<LearnArticle[]> {
  if (!usingSanity) return normalizeSeedLearn();
  const c = await client();
  const rows: any[] = await c.fetch(`*[_type == "learnArticle"] | order(order asc, title asc){
    ..., "slug": slug.current, "relatedService": relatedService->slug.current,
    cover${IMAGE}, lead${SLOT}, ${SECTIONS}
  }`);
  if (!rows?.length) return normalizeSeedLearn();
  return normalizeSeedLearn(
    rows.map(({ cover, lead, sections, body, relatedService, order, ...rest }) => ({
      ...stripSanity(rest),
      relatedService: relatedService ?? null,
      ...(body ? { body } : {}),
      ...(sections ? { sections: sectionsFromSanity(sections) } : {}),
      ...(lead ? { lead: slotFromSanity(lead) } : {}),
      cover: pickFromSanity(cover, rest.title),
    })),
  );
}

export function formatPrice(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

/** "$600 + $100" (or "$500 / hr"); the word "touch-up" is added where the caption has room for it. */
export function servicePrice(s: Service, opts: { touchUpWord?: boolean } = {}): string {
  const base = formatPrice(s.price) + (s.priceUnit ? ` / ${s.priceUnit}` : "");
  if (s.touchUpPrice == null) return base;
  return `${base} + ${formatPrice(s.touchUpPrice)}${opts.touchUpWord ? " touch-up" : ""}`;
}

/** The three parts of a photo's ruled caption: service, what it shows, price. */
export function photoCaption(p: Photo, services: Service[]): { service: string; detail?: string; price?: string } {
  const service = p.serviceSlug ? services.find((s) => s.slug === p.serviceSlug) : undefined;
  return {
    service: service?.title ?? p.alt.replace(/ by Pomi B\. Brow Studio.*$/i, "").split(",")[0].trim(),
    detail: p.detail,
    price: service ? servicePrice(service) : undefined,
  };
}
