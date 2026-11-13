// The Worker in front of the static site on Cloudflare Workers (see wrangler.jsonc). Only /api/*
// reaches it. GET /api/instagram runs the same handler the Pages Function uses
// (functions/api/instagram.ts); POST /api/contact runs the shared core in src/lib/contact.ts.
// Static pages never pass through here: their headers come from public/_headers.
import { onRequestGet } from "../functions/api/instagram";
import { handleContact, type RateLimiter } from "./lib/contact";

interface Env {
  ASSETS: Fetcher;
  INSTAGRAM_ACCESS_TOKEN?: string;
  INSTAGRAM_HANDLE?: string;
  INSTAGRAM_KV?: KVNamespace;
  FORM_WEBHOOK_URL?: string;
  CONTACT_LIMITER?: RateLimiter;
}

/** API answers carry the same baseline headers as the static pages. */
function harden(response: Response): Response {
  const out = new Response(response.body, response);
  out.headers.set("X-Content-Type-Options", "nosniff");
  out.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  out.headers.set("Strict-Transport-Security", "max-age=31536000");
  out.headers.set("X-Robots-Tag", "noindex");
  return out;
}

const notFound = () =>
  new Response(JSON.stringify({ ok: false, error: "not-found" }), {
    status: 404,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/instagram") {
      if (request.method !== "GET") {
        return harden(new Response("Method not allowed", { status: 405, headers: { Allow: "GET" } }));
      }
      return harden(
        await onRequestGet({
          request,
          env,
          waitUntil: ctx.waitUntil.bind(ctx),
          passThroughOnException: ctx.passThroughOnException.bind(ctx),
          params: {},
          data: {},
          functionPath: pathname,
          next: () => env.ASSETS.fetch(request),
        } as unknown as Parameters<typeof onRequestGet>[0])
      );
    }

    if (pathname === "/api/contact") return harden(await handleContact(request, env));

    if (pathname.startsWith("/api/")) return harden(notFound());
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
