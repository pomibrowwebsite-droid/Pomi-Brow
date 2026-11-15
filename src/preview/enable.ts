// GET /api/preview/enable: the door into the editor's preview. Only exists in the preview build
// (injected by astro.config.mjs when PUBLIC_PREVIEW=true). The Studio's Presentation tool opens
// it with a one-time secret; a valid secret earns a session cookie and a redirect to the page.
import type { APIRoute } from "astro";
import { validatePreviewUrl } from "@sanity/preview-url-secret";
import { LOCKED_PAGE, newSession, previewClient, previewHeaders, sessionCookie } from "../lib/preview";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const client = previewClient().withConfig({ stega: false });
  const { isValid, redirectTo = "/" } = await validatePreviewUrl(client, request.url);
  if (!isValid) {
    return previewHeaders(new Response(LOCKED_PAGE, { status: 401, headers: { "Content-Type": "text/html; charset=utf-8" } }));
  }
  // Only ever a path on this site.
  const to = redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/";
  return previewHeaders(
    new Response(null, { status: 307, headers: { Location: to, "Set-Cookie": sessionCookie(await newSession()) } }),
  );
};
