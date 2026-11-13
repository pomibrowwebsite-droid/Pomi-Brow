// The contact / appointment-request endpoint, POST /api/contact. One core shared by the Worker
// (src/worker.ts, the live deploy) and the Pages Function (functions/api/contact.ts), tested in
// tests/contact.test.ts. Each request is emailed to the studio through Resend (RESEND_API_KEY,
// APPOINTMENT_TO, APPOINTMENT_FROM) and never stored here.
//
// Defences, cheapest first: same-origin only, a body-size cap enforced while reading, an
// optional per-network rate limit (the CONTACT_LIMITER binding in wrangler.jsonc), a honeypot
// field and a fill-time trap (both answer bots with a fake success so they learn nothing, and
// both are logged so a dropped lead can be found in Workers observability), then strict field
// cleaning. These stop casual spam; a determined bot needs Cloudflare Turnstile on top.
//
// The page's script posts JSON and reads a JSON answer. Without JavaScript the browser posts a
// urlencoded form and gets a 303 to a plain page (/thanks or /not-sent) instead of raw JSON.

export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface ContactEnv {
  /** Resend API key (a secret). Without it the form tells visitors to call instead. */
  RESEND_API_KEY?: string;
  /** Where requests are emailed. Several addresses may be separated by commas. */
  APPOINTMENT_TO?: string;
  /** The sender. Must be on a domain verified in Resend; defaults to DEFAULT_FROM. */
  APPOINTMENT_FROM?: string;
  CONTACT_LIMITER?: RateLimiter;
}

export interface ContactDeps {
  fetch?: typeof fetch;
  log?: (message: string) => void;
}

export const MAX_BODY_BYTES = 16 * 1024;
/** Faster than this from page load to send is a script, not a person (even with autofill). */
export const MIN_FILL_MS = 1500;
/** The hidden field. Named so no browser or password manager will autofill it. */
export const HONEYPOT_FIELD = "pomi_hp_note";

export const RESEND_ENDPOINT = "https://api.resend.com/emails";
export const DEFAULT_FROM = "Pomi B. Brow Studio website <website@pomibbrowstudio.com>";

export const SENT_PATH = "/thanks";
export const NOT_SENT_PATH = "/not-sent";

const SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

interface Outcome {
  status: number;
  body: { ok: boolean; error?: string };
  headers?: Record<string, string>;
}
const ok = (): Outcome => ({ status: 200, body: { ok: true } });
const fail = (status: number, error: string, headers?: Record<string, string>): Outcome => ({
  status,
  body: { ok: false, error },
  headers,
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
/** Everything a visitor typed goes into the email's HTML through this. */
export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** "lip-blush" → "Lip blush". The slug is already restricted to [a-z0-9-]. */
const serviceLabel = (slug: string) => (slug ? slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " ") : "");

export interface Appointment {
  name: string;
  phone: string;
  email: string;
  service: string;
  message: string;
  page: string;
}

/** The email Pomi receives: a short table, the message, and reply-to set to the visitor. */
export function composeEmail(a: Appointment, from: string, to: string[]) {
  const rows: [string, string][] = [
    ["Name", a.name],
    ["Phone", a.phone],
    ["Email", a.email || "not given"],
    ["Service", serviceLabel(a.service) || "not chosen"],
  ];
  const sentFrom = `Sent from the pomibbrowstudio.com appointment form${a.page ? ` (${a.page})` : ""}.`;
  const html = `<div style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:15px;line-height:1.6;color:#2b2326">
  <h2 style="font-size:18px;margin:0 0 16px">New appointment request</h2>
  <table cellpadding="0" cellspacing="0" style="margin:0 0 20px">
    ${rows
      .map(([k, v]) => `<tr><td style="padding:4px 20px 4px 0;color:#6b6266">${k}</td><td style="padding:4px 0"><strong>${escapeHtml(v)}</strong></td></tr>`)
      .join("")}
  </table>
  <div style="color:#6b6266;margin:0 0 6px">Message</div>
  <div style="white-space:pre-wrap;border-left:3px solid #cf7396;padding-left:14px">${escapeHtml(a.message)}</div>
  <p style="color:#6b6266;font-size:13px;margin-top:24px">${escapeHtml(sentFrom)}</p>
</div>`;
  const text = ["New appointment request", "", ...rows.map(([k, v]) => `${k}: ${v}`), "", "Message:", a.message, "", sentFrom].join("\n");
  return {
    from,
    to,
    subject: `Appointment request from ${a.name}`,
    html,
    text,
    // Replying in the mail app goes straight back to the visitor, when they left an address.
    ...(a.email ? { reply_to: a.email } : {}),
  };
}

/** At least seven digits, the shortest local number a person could call back. */
export const isPhone = (s: string) => (s.match(/\d/g) ?? []).length >= 7 && /^[\d\s()+.\-x]+$/i.test(s);

/**
 * The rate-limit key for a client address. One IPv6 customer usually holds a whole /64, so
 * keying on the full address would let a single bot rotate freely; key on the /64 instead.
 */
export function clientKey(ip: string | null): string {
  if (!ip) return "unknown";
  if (!ip.includes(":")) return ip;
  // IPv4-mapped IPv6 (::ffff:1.2.3.4) is really that IPv4 address.
  const mapped = ip.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return mapped[1];
  const [head] = ip.split("::");
  const groups = ip.includes("::") ? head.split(":").filter(Boolean) : ip.split(":");
  return `${[...groups, "0", "0", "0", "0"].slice(0, 4).join(":")}::/64`;
}

/** Is the request from a page on this site? Browsers send Origin on every POST. */
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

/** Read the body as text, giving up as soon as it passes the cap (null) rather than buffering it all. */
async function readCapped(request: Request, cap: number): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > cap) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

let warnedNoLimiter = false;

async function evaluate(request: Request, env: ContactEnv, deps: ContactDeps): Promise<Outcome> {
  const log = deps.log ?? ((m: string) => console.log(m));
  if (request.method !== "POST") return fail(405, "method-not-allowed", { Allow: "POST" });
  if (!sameOrigin(request)) return fail(403, "forbidden");

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return fail(413, "too-large");

  if (env.CONTACT_LIMITER) {
    const key = clientKey(request.headers.get("cf-connecting-ip"));
    const { success } = await env.CONTACT_LIMITER.limit({ key: `contact:${key}` });
    if (!success) {
      log(`[contact] rate-limited ${key}`);
      return fail(429, "rate-limited", { "Retry-After": "60" });
    }
  } else if (!warnedNoLimiter) {
    warnedNoLimiter = true;
    log("[contact] CONTACT_LIMITER binding missing: the form is not rate limited");
  }

  let raw: string | null;
  try {
    raw = await readCapped(request, MAX_BODY_BYTES);
  } catch {
    return fail(400, "bad-request");
  }
  if (raw === null) return fail(413, "too-large");

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
      return fail(415, "unsupported-type");
    }
  } catch {
    return fail(400, "bad-request");
  }

  // Bots fill the hidden field; people never see it. Answer as if it worked.
  if (clean(data[HONEYPOT_FIELD], 200)) {
    log("[contact] dropped: honeypot filled");
    return ok();
  }
  // The page records how long the form was open before sending. Missing means no script ran
  // (a person on a no-JS browser), which is allowed; implausibly fast is a bot.
  const elapsed = Number(data.elapsed);
  if (data.elapsed !== undefined && data.elapsed !== "" && (!Number.isFinite(elapsed) || elapsed < MIN_FILL_MS)) {
    log(`[contact] dropped: sent ${JSON.stringify(clean(data.elapsed, 20))}ms after load`);
    return ok();
  }

  const name = clean(data.name, 120);
  const phone = clean(data.phone, 40);
  const email = clean(data.email, 200);
  const serviceRaw = clean(data.service, 80);
  const service = /^[a-z0-9-]*$/.test(serviceRaw) ? serviceRaw : "";
  const message = clean(data.message, 4000, true);

  if (!name || !phone || !message) return fail(422, "missing-fields");
  if (!isPhone(phone)) return fail(422, "invalid-phone");
  if (email && !isEmail(email)) return fail(422, "invalid-email");

  const apiKey = env.RESEND_API_KEY?.trim();
  const to = (env.APPOINTMENT_TO ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!apiKey || !to.length) {
    // Not configured yet. Tell the visitor plainly; the page offers the phone number.
    log("[contact] RESEND_API_KEY and APPOINTMENT_TO must both be set: a request could not be delivered");
    return fail(503, "not-configured");
  }
  const from = env.APPOINTMENT_FROM?.trim() || DEFAULT_FROM;

  const doFetch = deps.fetch ?? fetch;
  const upstream = await doFetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(composeEmail({ name, phone, email, service, message, page: sourcePath(request) }, from, to)),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);

  if (!upstream || !upstream.ok) {
    const detail = upstream ? `${upstream.status} ${(await upstream.text().catch(() => "")).slice(0, 300)}` : "network error";
    log(`[contact] Resend failed: ${detail}`);
    return fail(502, "upstream");
  }
  return ok();
}

export async function handleContact(request: Request, env: ContactEnv, deps: ContactDeps = {}): Promise<Response> {
  const outcome = await evaluate(request, env, deps);

  // A plain HTML form post (no script ran) wants a page, not JSON.
  const type = request.headers.get("content-type") ?? "";
  const accept = request.headers.get("accept") ?? "";
  if (request.method === "POST" && type.includes("application/x-www-form-urlencoded") && !accept.includes("application/json")) {
    const to = new URL(outcome.body.ok ? SENT_PATH : NOT_SENT_PATH, request.url);
    return new Response(null, { status: 303, headers: { Location: to.pathname, ...SECURITY_HEADERS } });
  }

  return new Response(JSON.stringify(outcome.body), {
    status: outcome.status,
    headers: { "Content-Type": "application/json", ...SECURITY_HEADERS, ...(outcome.headers ?? {}) },
  });
}
