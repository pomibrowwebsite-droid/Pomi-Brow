// Two gates, both off on the public site unless switched on:
//
// - The editor's preview (PUBLIC_PREVIEW=true, src/lib/preview.ts): every page needs the session
//   the Studio's signed link grants, and every answer is noindex, no-store, framable only by
//   the Studio.
// - The home-only launch gate (see src/lib/launch.ts). Runs at build time in static output:
//   inner routes become redirect pages to "/", and the home page's outbound links lose their href.
import { defineMiddleware, sequence } from "astro:middleware";
import { HOME_ONLY, disableInternalLinks } from "./lib/launch";
import { LOCKED_PAGE, PREVIEW, SESSION_COOKIE, previewHeaders, validSession } from "./lib/preview";

let announced = false;

const previewGate = defineMiddleware(async (context, next) => {
  if (!PREVIEW) return next();
  if (context.url.pathname.startsWith("/api/preview/")) return next();
  if (!(await validSession(context.cookies.get(SESSION_COOKIE)?.value))) {
    return previewHeaders(new Response(LOCKED_PAGE, { status: 401, headers: { "Content-Type": "text/html; charset=utf-8" } }));
  }
  return previewHeaders(await next());
});

const launchGate = defineMiddleware(async (context, next) => {
  if (!HOME_ONLY) return next();
  if (!announced) {
    announced = true;
    console.log("[launch] home-only gate is on: inner routes redirect to /, home links disabled");
  }
  const path = context.url.pathname;
  if (path !== "/" && !path.startsWith("/admin")) return context.redirect("/", 301);

  const res = await next();
  if (!res.headers.get("content-type")?.includes("text/html")) return res;
  const html = await res.text();
  return new Response(disableInternalLinks(html), { status: res.status, headers: res.headers });
});

export const onRequest = sequence(previewGate, launchGate);
