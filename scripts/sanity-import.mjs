// Load the site's current content into Sanity: site settings, services and prices, reviews,
// Learn articles, the Safety and Aftercare pages, and every photo they use.
//
//   node scripts/sanity-import.mjs --fixture <file.ndjson>
//       No network. Writes the documents (and stand-in image assets) to a file. The parity check
//       (scripts/sanity-parity.mjs) builds the site from it and compares every page.
//
//   SANITY_PROJECT_ID=xxxxxxxx SANITY_WRITE_TOKEN=sk... node scripts/sanity-import.mjs [--dataset production] [--only homePage,service] [--force]
//       Uploads the photos and writes the documents. Refuses to touch a dataset that already holds
//       any of them unless --force is given, so it cannot overwrite Pomi's edits by accident.
//       --only limits it to those document types (e.g. to add a type introduced later).
//
// Each image keeps the gallery file it came from in a hidden `galleryRef`, so the site serves its
// own optimised copy until the photo is replaced in the Studio (see src/lib/content.ts).
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { createClient } from "@sanity/client";

try {
  process.loadEnvFile(); // .env, when present (it is gitignored)
} catch {
  /* no .env */
}

const ROOT = process.cwd();
const GALLERY = join(ROOT, "src/assets/gallery");
const seed = (name) => JSON.parse(readFileSync(join(ROOT, "src/content/seed", `${name}.json`), "utf8"));

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const fixturePath = option("fixture");
const dataset = option("dataset") ?? process.env.SANITY_DATASET ?? "production";
const only = option("only")?.split(",").map((s) => s.trim()).filter(Boolean);
/** Whether this run writes documents of a type. */
const want = (type) => !only || only.includes(type);

// ----------------------------------------------------------------------------------- photos

/** Width and height from a JPEG's start-of-frame marker. */
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  throw new Error("not a JPEG");
}

const fixtureAssets = new Map();
const uploaded = new Map();
let client;

/** The asset for a gallery ref, uploaded once (or made up, in fixture mode). */
async function assetFor(ref) {
  if (uploaded.has(ref)) return uploaded.get(ref);
  const file = join(GALLERY, `${ref}.jpg`);
  const buf = readFileSync(file);
  const filename = `${ref.replace("/", "-")}.jpg`;
  let id;
  if (fixturePath) {
    const sha1 = createHash("sha1").update(buf).digest("hex");
    const { width, height } = jpegSize(buf);
    id = `image-${sha1}-${width}x${height}-jpg`;
    fixtureAssets.set(id, {
      _id: id,
      _type: "sanity.imageAsset",
      url: `https://cdn.sanity.io/images/fixture/${dataset}/${sha1}-${width}x${height}.jpg`,
      originalFilename: filename,
      sha1hash: sha1,
      metadata: { dimensions: { width, height, aspectRatio: width / height } },
    });
  } else {
    const doc = await client.assets.upload("image", buf, { filename });
    id = doc._id;
    process.stdout.write(".");
  }
  uploaded.set(ref, id);
  return id;
}

/** "50% 85%" as a Sanity hotspot. */
function hotspot(focus) {
  const m = /^(\d+(?:\.\d+)?)% (\d+(?:\.\d+)?)%$/.exec(focus ?? "");
  if (!m) return {};
  return { hotspot: { _type: "sanity.imageHotspot", x: +m[1] / 100, y: +m[2] / 100, width: 0.2, height: 0.2 } };
}

const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ""));

/** A Sanity image of a gallery photo, with its alt, caption detail and crop point. */
async function image(ref, { alt, detail, focus, key, caption } = {}) {
  return clean({
    ...(key ? { _key: key } : {}),
    _type: "image",
    asset: { _type: "reference", _ref: await assetFor(ref) },
    galleryRef: ref,
    ...hotspot(focus),
    alt,
    detail,
    caption,
  });
}

/** The seed's { ratio, shot, photo: { ref, alt, focus, detail } } as an imageSlot. */
async function slot(s) {
  if (!s) return undefined;
  const { photo, ...rest } = s;
  return clean({ _type: "imageSlot", ...rest, photo: photo?.ref ? await image(photo.ref, photo) : undefined });
}

// --------------------------------------------------------------------------------- sections

const keyed = (arr, map = (x) => x) => (arr ?? []).map((x, i) => ({ _key: `k${i}`, ...map(x) }));
const links = (arr) => keyed(arr, (l) => ({ _type: "link", ...l }));
const SECTION = { facts: "sectionFacts", statement: "sectionStatement", grid: "sectionGrid", sequence: "sectionSequence", compare: "sectionCompare", faq: "sectionFaq", cta: "sectionCta" };

async function block(b) {
  const { image: img, links: l, ...rest } = b;
  return clean({ ...rest, links: l ? links(l) : undefined, image: await slot(img) });
}

async function sections(list) {
  if (!list) return undefined;
  const out = [];
  for (const [i, s] of list.entries()) {
    const { type, image: img, items, sides, callout, links: l, ...rest } = s;
    if (!SECTION[type]) throw new Error(`unknown section type ${type}`);
    const blocks = async (arr) => {
      const r = [];
      for (const [j, b] of arr.entries()) r.push({ _key: `k${j}`, ...(await block(b)) });
      return r;
    };
    out.push(
      clean({
        _key: `s${i}`,
        _type: SECTION[type],
        ...rest,
        image: await slot(img),
        items: items ? await blocks(items) : undefined,
        sides: sides ? await blocks(sides) : undefined,
        callout: callout ? clean({ _type: "callout", ...callout, links: callout.links ? links(callout.links) : undefined }) : undefined,
        links: l ? links(l) : undefined,
      }),
    );
  }
  return out;
}

const paragraphsToBlocks = (paragraphs) =>
  (paragraphs ?? []).map((text, i) => ({
    _type: "block",
    _key: `p${i}`,
    style: "normal",
    markDefs: [],
    children: [{ _type: "span", _key: `p${i}s`, text, marks: [] }],
  }));

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const ref = (id) => ({ _type: "reference", _ref: id });

// -------------------------------------------------------------------------------- documents

async function documents() {
  const docs = [];

  if (want("homePage")) {
    const h = seed("home");
    const { heroPhotos, aboutPhoto, aboutFacts, pricesAsOf, ...words } = h;
    const wall = [];
    for (const [i, pick] of heroPhotos.entries()) wall.push(await image(pick.ref, { ...pick, key: `k${i}` }));
    docs.push(
      clean({
        _id: "homePage",
        _type: "homePage",
        ...words,
        heroPhotos: wall,
        aboutFacts: keyed(aboutFacts),
        aboutPhoto: aboutPhoto ? await image(aboutPhoto.ref, aboutPhoto) : undefined,
      }),
    );
  }

  if (want("siteSettings")) {
  const s = seed("siteSettings");
  const { instagramPicks, headshot, bio, bioIsPlaceholder, hours, ...settings } = s;
  const picks = [];
  for (const [i, p] of instagramPicks.entries()) {
    const pick = typeof p === "string" ? { ref: p } : p;
    picks.push(await image(pick.ref, { ...pick, key: `k${i}` }));
  }
  docs.push(
    clean({
      _id: "siteSettings",
      _type: "siteSettings",
      ...settings,
      hours: keyed(hours),
      instagramPicks: picks,
      headshot: headshot ? await image(headshot) : undefined,
      bio: paragraphsToBlocks(bio),
    }),
  );
  }

  for (const svc of want("service") ? seed("services") : []) {
    const { slug, cover, galleryFolder, ...rest } = svc;
    const files = galleryFolder
      ? readdirSync(join(GALLERY, galleryFolder))
          .filter((f) => f.endsWith(".jpg"))
          .sort()
      : [];
    const gallery = [];
    for (const [i, f] of files.entries()) gallery.push(await image(`${galleryFolder}/${f.replace(/\.jpg$/, "")}`, { key: `k${i}` }));
    docs.push(
      clean({
        _id: `service-${slug}`,
        _type: "service",
        ...rest,
        slug: { _type: "slug", current: slug },
        cover: cover ? await image(cover.ref, cover) : undefined,
        gallery,
      }),
    );
  }

  for (const r of want("review") ? seed("reviews") : []) {
    if (r.isPlaceholder) continue;
    const { serviceSlug, isPlaceholder, ...rest } = r;
    docs.push(clean({ _id: `review-${slugify(r.reviewer)}`, _type: "review", ...rest, service: serviceSlug ? ref(`service-${serviceSlug}`) : undefined }));
  }

  for (const [i, a] of (want("learnArticle") ? seed("learn") : []).entries()) {
    const { slug, cover, relatedService, sections: secs, lead, ...rest } = a;
    docs.push(
      clean({
        _id: `learn-${slug}`,
        _type: "learnArticle",
        ...rest,
        order: (i + 1) * 10,
        slug: { _type: "slug", current: slug },
        relatedService: relatedService ? ref(`service-${relatedService}`) : undefined,
        cover: cover ? await image(cover.ref, cover) : undefined,
        lead: await slot(lead),
        sections: await sections(secs),
      }),
    );
  }

  for (const p of want("page") ? seed("pages") : []) {
    const { slug, lead, facts, sections: secs, ...rest } = p;
    docs.push(
      clean({
        _id: `page-${slug}`,
        _type: "page",
        ...rest,
        slug: { _type: "slug", current: slug },
        lead: await slot(lead),
        facts: facts ? keyed(facts) : undefined,
        sections: await sections(secs),
      }),
    );
  }
  return docs;
}

// ------------------------------------------------------------------------------------- run

if (fixturePath) {
  const docs = await documents();
  const lines = [...fixtureAssets.values(), ...docs].map((d) => JSON.stringify(d));
  writeFileSync(fixturePath, lines.join("\n") + "\n");
  console.log(`Wrote ${docs.length} documents and ${fixtureAssets.size} image assets to ${fixturePath}`);
} else {
  const projectId = process.env.SANITY_PROJECT_ID ?? process.env.PUBLIC_SANITY_PROJECT_ID;
  const token = process.env.SANITY_WRITE_TOKEN;
  if (!projectId || !token) {
    console.error("Set SANITY_PROJECT_ID and SANITY_WRITE_TOKEN (an Editor token from sanity.io/manage → API → Tokens).");
    process.exit(1);
  }
  client = createClient({ projectId, dataset, token, apiVersion: "2025-06-01", useCdn: false });

  const ids = [
    ...(want("homePage") ? ["homePage"] : []),
    ...(want("siteSettings") ? ["siteSettings"] : []),
    ...(want("service") ? seed("services").map((s) => `service-${s.slug}`) : []),
    ...(want("review") ? seed("reviews").map((r) => `review-${slugify(r.reviewer)}`) : []),
    ...(want("learnArticle") ? seed("learn").map((a) => `learn-${a.slug}`) : []),
    ...(want("page") ? seed("pages").map((p) => `page-${p.slug}`) : []),
  ];
  const existing = await client.fetch(`count(*[_id in $ids || _id in $drafts])`, { ids, drafts: ids.map((id) => `drafts.${id}`) });
  if (existing > 0 && !flag("force")) {
    console.error(`The ${dataset} dataset already has ${existing} of these documents. Re-run with --force to overwrite them (this replaces any edits made in the Studio).`);
    process.exit(1);
  }

  process.stdout.write("Uploading photos ");
  const docs = await documents();
  console.log(` ${uploaded.size} photos.`);
  const tx = client.transaction();
  for (const d of docs) tx.createOrReplace(d);
  await tx.commit();
  console.log(`Wrote ${docs.length} documents to ${projectId}/${dataset}.`);
}
