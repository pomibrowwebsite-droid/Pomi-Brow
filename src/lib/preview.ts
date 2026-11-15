// The editor's live preview. The public site is static; a second Worker (preview.pomibrow.com,
// wrangler.preview.jsonc) builds this same code with PUBLIC_PREVIEW=true, renders every page on
// request from Pomi's unpublished drafts, and is shown beside her fields in the Studio's
// Presentation tool. See docs/sanity-setup.md, "Live preview".
//
// It is not public: the Studio opens it through a one-time signed link (@sanity/preview-url-secret),
// which sets a session cookie; without that cookie every page answers with a locked notice.
import { createClient, type ClientConfig } from "@sanity/client";

export const PREVIEW = import.meta.env.PUBLIC_PREVIEW === "true";

/** Where the Studio lives, for the click-to-edit links. */
export const STUDIO_URL = "https://pomibrow.com/admin";
export const SESSION_COOKIE = "pomi_preview";
const SESSION_HOURS = 12;

function viewerToken(): string {
  const token = process.env.SANITY_VIEWER_TOKEN;
  if (!token) throw new Error("[preview] SANITY_VIEWER_TOKEN is not set on the preview Worker");
  return token;
}

/**
 * Only words a visitor reads carry the invisible click-to-edit marks. Layout values, slugs, links,
 * alt text and anything compared in code stay clean, so the marks can never change what renders.
 */
const EDITABLE_TEXT = new Set([
  "title", "heading", "lede", "summary", "text", "quote", "excerpt", "paragraphs", "bullets",
  "q", "a", "label", "linkLabel", "shot", "detail", "caption", "reviewer", "value", "meta", "metaLabel",
  "priceNote", "hoursNote", "aboutHeading", "heroHeadline", "heroOccasions", "heroIntro", "heroNote",
  "heroCaption", "workHeading", "workIntro", "pricesHeading", "pricesIntro", "extrasHeading",
  "extrasIntro", "faqHeading", "faqIntro", "formHeading", "formIntro", "children", "lede",
]);

type StegaFilter = NonNullable<Extract<ClientConfig["stega"], object>["filter"]>;
const stegaFilter: StegaFilter = (props) => {
  const names = props.sourcePath.filter((s): s is string => typeof s === "string");
  // Portable text: the editable part is the span's `text` under `children`.
  const field = names.includes("children") ? "children" : names[names.length - 1];
  return EDITABLE_TEXT.has(field ?? "") && props.filterDefault(props);
};

/** Reads drafts over published, with click-to-edit marks, using the preview Worker's token. */
export function previewClient() {
  return createClient({
    projectId: import.meta.env.PUBLIC_SANITY_PROJECT_ID,
    dataset: import.meta.env.PUBLIC_SANITY_DATASET || "production",
    apiVersion: "2025-06-01",
    useCdn: false,
    token: viewerToken(),
    perspective: "drafts",
    stega: { enabled: true, studioUrl: STUDIO_URL, filter: stegaFilter },
  });
}

// ------------------------------------------------------------------------------- session

const encoder = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(viewerToken()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

/** A cookie value good for SESSION_HOURS: "<expiry>.<signature>". */
export async function newSession(): Promise<{ value: string; maxAge: number }> {
  const expires = Date.now() + SESSION_HOURS * 3600_000;
  return { value: `${expires}.${await hmac(`preview:${expires}`)}`, maxAge: SESSION_HOURS * 3600 };
}

export async function validSession(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const [expires, signature] = value.split(".");
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  const expected = await hmac(`preview:${expires}`);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

/**
 * The session cookie. SameSite=None + Partitioned: the preview sits in an iframe inside the
 * Studio, and a partitioned cookie only exists inside that Studio tab, so opening the preview
 * address directly finds no session.
 */
export const sessionCookie = ({ value, maxAge }: { value: string; maxAge: number }) =>
  `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=None; Partitioned`;

/** Every preview response: never indexed, never cached, framable only by the Studio. */
export function previewHeaders(res: Response): Response {
  const out = new Response(res.body, res);
  out.headers.set("X-Robots-Tag", "noindex, nofollow");
  out.headers.set("Cache-Control", "no-store");
  out.headers.set("Content-Security-Policy", "frame-ancestors https://pomibrow.com");
  out.headers.set("X-Content-Type-Options", "nosniff");
  return out;
}

export const LOCKED_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Editor preview</title></head><body style="font:16px/1.6 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;color:#2b2326"><h1 style="font-size:1.25rem">This is the editor's preview</h1><p>It opens from inside the editor: go to <a href="https://pomibrow.com/admin">pomibrow.com/admin</a> and choose <strong>Preview</strong>.</p><p>The public website is at <a href="https://pomibrow.com">pomibrow.com</a>.</p></body></html>`;
