// Cloudflare Pages Function: GET /api/instagram
// The newest posts for the home page grid. The token is a Pages secret (INSTAGRAM_ACCESS_TOKEN);
// with a KV binding (INSTAGRAM_KV) the function refreshes it weekly so it never hits Meta's
// 60-day expiry. Successful answers sit in the edge cache for an hour, which is also what keeps
// Instagram's short-lived CDN image URLs fresh. Only onRequestGet is exported: a catch-all
// onRequest beside a method handler is ambiguous in Pages routing.
import { loadPosts, resolveToken, type KvLike, type FeedResponse } from "../../src/lib/instagram";

interface Env {
  INSTAGRAM_ACCESS_TOKEN?: string;
  INSTAGRAM_HANDLE?: string;
  INSTAGRAM_KV?: KVNamespace;
}

const COUNT = 4;
const OK_CACHE = "public, max-age=300, s-maxage=3600";

const json = (body: unknown, status = 200, cacheControl = "no-store") =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": cacheControl },
  });

/** KVNamespace.get has an overloaded return type resolveToken's KvLike doesn't need; adapt it. */
function asKvLike(kv: KVNamespace): KvLike {
  return { get: (key) => kv.get(key), put: (key, value) => kv.put(key, value) };
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const cache = await caches.open("instagram");
  const url = new URL(request.url);
  url.search = "";
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const envToken = env.INSTAGRAM_ACCESS_TOKEN?.trim();
  // No token yet means the live feed is switched off, not that something broke: answer 200 so
  // visitors' consoles stay clean, and the grid keeps the curated photos (it only swaps on ok).
  if (!envToken) return json({ ok: false, error: "not-configured" });

  const { token, refresh } = await resolveToken({
    envToken,
    kv: env.INSTAGRAM_KV ? asKvLike(env.INSTAGRAM_KV) : undefined,
    fetch,
    log: (m) => console.error("instagram token refresh:", m),
  });
  const handle = env.INSTAGRAM_HANDLE?.trim() || "pomib.browstudio";
  try {
    const posts = await loadPosts({ token, limit: COUNT, handle, fetch });
    const body: FeedResponse = { ok: true, posts, handle, refresh };
    const res = json(body, 200, OK_CACHE);
    waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  } catch (err) {
    console.error("instagram feed:", err instanceof Error ? err.message : err);
    return json({ ok: false, error: "upstream" }, 502);
  }
};
