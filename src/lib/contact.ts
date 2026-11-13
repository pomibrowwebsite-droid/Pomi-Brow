// The contact / appointment-request endpoint, POST /api/contact. One core shared by the Worker
// (src/worker.ts, the live deploy) and the Pages Function (functions/api/contact.ts), tested in
// tests/contact.test.ts. Submissions are forwarded to FORM_WEBHOOK_URL and never stored here.
//
// Defences, cheapest first: same-origin only, a body-size cap, an optional per-IP rate limit
// (the CONTACT_LIMITER binding in wrangler.jsonc), a honeypot field and a fill-time trap (both
// answer bots with a fake success so they learn nothing), then strict field cleaning.

export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface ContactEnv {
  FORM_WEBHOOK_URL?: string;
  CONTACT_LIMITER?: RateLimiter;
}

export interface ContactDeps {
  fetch?: typeof fetch;
}

export const MAX_BODY_BYTES = 16 * 1024;
/** A person cannot read the form and type a question in under this long. */
export const MIN_FILL_MS = 3000;

const SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...SECURITY_HEADERS, ...extra },
  });

// Control characters other than tab and newline never belong in a form field.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Trim, strip control characters and cap the length. Single-line fields also lose newlines. */
export function clean(value: unknown, max: number, multiline = false): string {
  let s = typeof value === "string" ? value : value == null ? "" : String(value);
  s = s.replace(CONTROL, "");
  if (!multiline) s = s.replace(/[\r\n\t]+/g, " ");
  return s.trim().slice(0, max);
}

export const isEmail = (s: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s);
/** At least seven digits, the shortest local number a person could call back. */
export const isPhone = (s: string) => (s.match(/\d/g) ?? []).length >= 7 && /^[\d\s()+.\-x]+$/i.test(s);

/** Is the request from a page on this site? Browsers always send Origin on a cross-origin-capable POST. */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

/** The page the form was sent from, path only, and only when it was this site. */
function sourcePath(request: Request): string {
  const ref = request.headers.get("referer");
  if (!ref) return "";
  try {
    const url = new URL(ref);
    return url.host === new URL(request.url).host ? url.pathname : "";
  } catch {
    return "";
  }
}

export async function handleContact(request: Request, env: ContactEnv, deps: ContactDeps = {}): Promise<Response> {
  if (request.method !== "POST") return json({ ok: false, error: "method-not-allowed" }, 405, { Allow: "POST" });
  if (!sameOrigin(request)) return json({ ok: false, error: "forbidden" }, 403);

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return json({ ok: false, error: "too-large" }, 413);

  if (env.CONTACT_LIMITER) {
    const key = request.headers.get("cf-connecting-ip") ?? "unknown";
    const { success } = await env.CONTACT_LIMITER.limit({ key: `contact:${key}` });
    if (!success) return json({ ok: false, error: "rate-limited" }, 429, { "Retry-After": "60" });
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return json({ ok: false, error: "bad-request" }, 400);
  }
  // Content-Length can be absent (chunked), so check what actually arrived too.
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return json({ ok: false, error: "too-large" }, 413);

  let data: Record<string, unknown>;
  try {
    const type = request.headers.get("content-type") ?? "";
    if (type.includes("application/json")) {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
      data = parsed as Record<string, unknown>;
    } else if (type.includes("application/x-www-form-urlencoded")) {
      data = Object.fromEntries(new URLSearchParams(raw).entries());
    } else {
      return json({ ok: false, error: "unsupported-type" }, 415);
    }
  } catch {
    return json({ ok: false, error: "bad-request" }, 400);
  }

  // Bots fill the hidden field; people never see it. Answer as if it worked.
  if (clean(data.website, 200)) return json({ ok: true });
  // The page records how long the form was open before sending. Missing means no script ran
  // (a person on a no-JS browser), which is allowed; implausibly fast is a bot.
  const elapsed = Number(data.elapsed);
  if (data.elapsed !== undefined && data.elapsed !== "" && (!Number.isFinite(elapsed) || elapsed < MIN_FILL_MS)) {
    return json({ ok: true });
  }

  const name = clean(data.name, 120);
  const phone = clean(data.phone, 40);
  const email = clean(data.email, 200);
  const serviceRaw = clean(data.service, 80);
  const service = /^[a-z0-9-]*$/.test(serviceRaw) ? serviceRaw : "";
  const message = clean(data.message, 4000, true);

  if (!name || !phone || !message) return json({ ok: false, error: "missing-fields" }, 422);
  if (!isPhone(phone)) return json({ ok: false, error: "invalid-phone" }, 422);
  if (email && !isEmail(email)) return json({ ok: false, error: "invalid-email" }, 422);

  if (!env.FORM_WEBHOOK_URL) {
    // Not configured yet. Tell the visitor plainly; the page offers the phone number.
    return json({ ok: false, error: "not-configured" }, 503);
  }

  const payload = {
    name,
    phone,
    email,
    service,
    message,
    submittedAt: new Date().toISOString(),
    page: sourcePath(request),
  };

  const doFetch = deps.fetch ?? fetch;
  const upstream = await doFetch(env.FORM_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);

  if (!upstream || !upstream.ok) return json({ ok: false, error: "upstream" }, 502);
  return json({ ok: true });
}
