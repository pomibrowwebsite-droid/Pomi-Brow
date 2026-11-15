// The Studio's Preview tab (Sanity's Presentation tool): the real site, rendered from drafts by
// the preview Worker (src/lib/preview.ts), beside the fields. `mainDocuments` opens the right
// document for the page on screen; `locations` lists, on each document, the pages that show it.
import { defineDocuments, defineLocations, type PresentationPluginOptions } from "sanity/presentation";

export const PREVIEW_ORIGIN = "https://preview.pomibrow.com";

const home = { title: "Home page", href: "/" };

export const resolve: PresentationPluginOptions["resolve"] = {
  mainDocuments: defineDocuments([
    { route: "/", filter: `_id == "homePage"` },
    { route: "/services/:slug", filter: `_type == "service" && slug.current == $slug` },
    { route: "/learn/:slug", filter: `_type == "learnArticle" && slug.current == $slug` },
    { route: "/safety", filter: `_type == "page" && slug.current == "safety"` },
    { route: "/aftercare", filter: `_type == "page" && slug.current == "aftercare"` },
    { route: "/about", filter: `_id == "siteSettings"` },
    { route: "/contact", filter: `_id == "siteSettings"` },
  ]),
  locations: {
    homePage: defineLocations({ locations: [home], message: "The appointment form's heading also shows on most other pages." }),
    service: defineLocations({
      select: { title: "title", slug: "slug.current" },
      resolve: (doc) => ({
        locations: [
          ...(doc?.slug ? [{ title: doc.title ?? "Service page", href: `/services/${doc.slug}` }] : []),
          { title: "Home page price list", href: "/" },
        ],
      }),
    }),
    learnArticle: defineLocations({
      select: { title: "title", slug: "slug.current" },
      resolve: (doc) => ({
        locations: [
          ...(doc?.slug ? [{ title: doc.title ?? "Article", href: `/learn/${doc.slug}` }] : []),
          { title: "Learn", href: "/learn" },
        ],
      }),
    }),
    page: defineLocations({
      select: { title: "title", slug: "slug.current" },
      resolve: (doc) => ({ locations: doc?.slug ? [{ title: doc.title ?? doc.slug, href: `/${doc.slug}` }] : [] }),
    }),
    review: defineLocations({ locations: [home] }),
    siteSettings: defineLocations({
      locations: [home, { title: "About", href: "/about" }, { title: "Contact", href: "/contact" }],
      message: "Phone, address and hours show on every page.",
    }),
  },
};
