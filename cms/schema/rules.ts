// Guard rails for an editor with no web experience. Each rule stops, before Publish, a mistake
// that would otherwise break the design or quietly stop the site from updating:
//
// - Length limits sized from the longest text the approved design already holds, with room
//   to spare. Longer text wraps into layouts that were never drawn for it.
// - The word "placeholder": the build refuses to publish a page containing it (a guard against
//   shipping unfinished copy), so one stray word would freeze every later update.
// - Links: the build also refuses a link to a page that does not exist.
// - Photos uploaded in the Studio need a description, for people who cannot see them.
import type { CustomValidatorResult, ValidationContext } from "sanity";

type AnyRule = any;

/** At most `max` characters; `required` adds "can't be empty". */
export const fits =
  (max: number, { required = false } = {}) =>
  (r: AnyRule) =>
    r.custom((value: unknown): CustomValidatorResult => {
      const s = typeof value === "string" ? value.trim() : "";
      if (!s) return required ? "This can't be empty." : true;
      return s.length <= max ? true : `Too long for the design: ${s.length} characters, and the space fits ${max}. Shorten it a little.`;
    });

/** Every list item at most `max` characters. */
export const eachFits = (max: number) => (r: AnyRule) =>
  r.custom((list: unknown): CustomValidatorResult => {
    if (!Array.isArray(list)) return true;
    const long = list.findIndex((s) => typeof s === "string" && s.trim().length > max);
    return long < 0 ? true : `Item ${long + 1} is too long for the design: keep each one to ${max} characters.`;
  });

/** Document-level: no string anywhere in the document may contain "placeholder". */
export const noPlaceholder = (exempt: string[] = []) => (r: AnyRule) =>
  r.custom((doc: unknown): CustomValidatorResult => {
    const hits = new Set<string>();
    const walk = (v: unknown, field: string) => {
      if (typeof v === "string") {
        if (/placeholder/i.test(v)) hits.add(field);
      } else if (Array.isArray(v)) {
        v.forEach((x) => walk(x, field));
      } else if (v && typeof v === "object") {
        for (const [k, x] of Object.entries(v)) {
          if (k.startsWith("_") || exempt.includes(k)) continue;
          walk(x, field || k);
        }
      }
    };
    walk(doc, "");
    return hits.size
      ? `Take out the word “placeholder” (in: ${[...hits].join(", ")}). The website won't update while it's there.`
      : true;
  });

/** The pages that exist at a fixed address. Services and articles are checked by slug. */
const PAGES = ["/", "/about", "/aftercare", "/contact", "/faqs", "/learn", "/safety", "/privacy", "/terms", "/accessibility"];

/** A link: a page on this site that exists, or https, tel:, sms:, mailto:. */
export const siteLink = (r: AnyRule) =>
  r.custom(async (href: unknown, context: ValidationContext): Promise<CustomValidatorResult> => {
    if (typeof href !== "string" || !href.trim()) return true;
    const h = href.trim();
    if (/^(https:\/\/|tel:|sms:|mailto:)/.test(h)) return true;
    if (h.startsWith("http://")) return "Use https:// for links to other websites.";
    if (h.startsWith("#")) return true;
    if (!h.startsWith("/")) return "Start with / for a page on this site (like /aftercare), or https:// for another website.";
    const path = h.split("#")[0].split("?")[0].replace(/\/$/, "") || "/";
    if (PAGES.includes(path)) return true;
    const m = /^\/(services|learn)\/([a-z0-9-]+)$/.exec(path);
    if (m) {
      const type = m[1] === "services" ? "service" : "learnArticle";
      const found = await context
        .getClient({ apiVersion: "2025-06-01" })
        .fetch(`count(*[_type == $type && slug.current == $slug && !(_id in path("drafts.**"))])`, { type, slug: m[2] });
      return found > 0 ? true : `There's no published ${m[1] === "services" ? "service" : "article"} at ${path}. Check the address.`;
    }
    return `${path} isn't a page on this website. Pages look like /aftercare, /services/microblading or /learn/how-long-it-lasts.`;
  });

/** Alt text: required for a photo uploaded in the Studio (imported photos already have one). */
export const altForUploads = (r: AnyRule) =>
  r.custom((alt: unknown, context: ValidationContext): CustomValidatorResult => {
    const img = context.parent as { asset?: unknown; galleryRef?: string } | undefined;
    if (!img?.asset || img.galleryRef || (typeof alt === "string" && alt.trim())) return true;
    return "Describe the photo in a few words, for people who can't see it (e.g. “Healed lip tint, soft rose”).";
  });
