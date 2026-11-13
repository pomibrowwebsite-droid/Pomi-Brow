// Contact endpoint core. Runs under `node --test`; Node 24 strips the types itself.
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleContact, clean, isPhone, isEmail, MAX_BODY_BYTES, type ContactEnv } from "../src/lib/contact.ts";

const SITE = "https://pomibbrowstudio.com";
const GOOD = { name: "Ana", phone: "(949) 555-0100", message: "Do you do brow touch-ups?", elapsed: 9000 };

function post(body: unknown, headers: Record<string, string> = {}, type = "application/json") {
  return new Request(`${SITE}/api/contact`, {
    method: "POST",
    headers: { "content-type": type, origin: SITE, referer: `${SITE}/services/microblading?x=1`, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function recorder(status = 200) {
  const calls: { url: string; body: any }[] = [];
  const fetchLike = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    return new Response("{}", { status });
  }) as unknown as typeof fetch;
  return { fetchLike, calls };
}

const env: ContactEnv = { FORM_WEBHOOK_URL: "https://hooks.example/abc" };

test("forwards a good submission and reports success", async () => {
  const { fetchLike, calls } = recorder();
  const res = await handleContact(post({ ...GOOD, service: "microblading" }), env, { fetch: fetchLike });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.name, "Ana");
  assert.equal(calls[0].body.service, "microblading");
  assert.equal(calls[0].body.page, "/services/microblading", "only the same-site path, no query");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
});

test("accepts a no-JS urlencoded form post", async () => {
  const { fetchLike, calls } = recorder();
  const body = new URLSearchParams({ name: "Ana", phone: "949 555 0100", message: "Hi" }).toString();
  const res = await handleContact(post(body, {}, "application/x-www-form-urlencoded"), env, { fetch: fetchLike });
  assert.equal(res.status, 200);
  assert.equal(calls.length, 1);
});

test("rejects other origins and requests with no Origin", async () => {
  const { fetchLike, calls } = recorder();
  assert.equal((await handleContact(post(GOOD, { origin: "https://evil.example" }), env, { fetch: fetchLike })).status, 403);
  const noOrigin = new Request(`${SITE}/api/contact`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(GOOD),
  });
  assert.equal((await handleContact(noOrigin, env, { fetch: fetchLike })).status, 403);
  assert.equal(calls.length, 0);
});

test("only POST is allowed", async () => {
  const res = await handleContact(new Request(`${SITE}/api/contact`), env);
  assert.equal(res.status, 405);
  assert.equal(res.headers.get("allow"), "POST");
});

test("honeypot and too-fast fills get a fake success and are not forwarded", async () => {
  const { fetchLike, calls } = recorder();
  const trap = await handleContact(post({ ...GOOD, website: "http://spam" }), env, { fetch: fetchLike });
  assert.deepEqual(await trap.json(), { ok: true });
  const fast = await handleContact(post({ ...GOOD, elapsed: 400 }), env, { fetch: fetchLike });
  assert.deepEqual(await fast.json(), { ok: true });
  const junk = await handleContact(post({ ...GOOD, elapsed: "soon" }), env, { fetch: fetchLike });
  assert.deepEqual(await junk.json(), { ok: true });
  assert.equal(calls.length, 0);
});

test("missing or malformed fields are refused with a reason", async () => {
  const cases: [Record<string, unknown>, string][] = [
    [{ ...GOOD, name: "  " }, "missing-fields"],
    [{ ...GOOD, phone: "12" }, "invalid-phone"],
    [{ ...GOOD, phone: "<script>" }, "invalid-phone"],
    [{ ...GOOD, email: "not-an-email" }, "invalid-email"],
  ];
  for (const [body, error] of cases) {
    const res = await handleContact(post(body), env);
    assert.equal(res.status, 422);
    assert.equal((await res.json()).error, error);
  }
});

test("bad JSON, non-object JSON and unknown content types are refused", async () => {
  assert.equal((await handleContact(post("{nope"), env)).status, 400);
  assert.equal((await handleContact(post("[1,2]"), env)).status, 400);
  assert.equal((await handleContact(post("x", {}, "text/plain"), env)).status, 415);
});

test("oversized bodies are refused", async () => {
  const big = { ...GOOD, message: "x".repeat(MAX_BODY_BYTES + 10) };
  assert.equal((await handleContact(post(big), env)).status, 413);
});

test("unknown service values are dropped rather than forwarded", async () => {
  const { fetchLike, calls } = recorder();
  await handleContact(post({ ...GOOD, service: "<b>x</b>" }), env, { fetch: fetchLike });
  assert.equal(calls[0].body.service, "");
});

test("says not-configured when there is no webhook", async () => {
  const res = await handleContact(post(GOOD), {});
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, "not-configured");
});

test("reports an upstream failure", async () => {
  const { fetchLike } = recorder(500);
  assert.equal((await handleContact(post(GOOD), env, { fetch: fetchLike })).status, 502);
});

test("rate limiter blocks by client IP", async () => {
  const keys: string[] = [];
  const limited: ContactEnv = {
    ...env,
    CONTACT_LIMITER: { limit: async ({ key }) => (keys.push(key), { success: false }) },
  };
  const res = await handleContact(post(GOOD, { "cf-connecting-ip": "203.0.113.9" }), limited);
  assert.equal(res.status, 429);
  assert.deepEqual(keys, ["contact:203.0.113.9"]);
});

test("clean strips control characters, newlines in single-line fields, and caps length", () => {
  assert.equal(clean("a\u0000b\r\nc", 10), "ab c");
  assert.equal(clean("line1\nline2", 20, true), "line1\nline2");
  assert.equal(clean("x".repeat(50), 5), "xxxxx");
  assert.equal(clean(undefined, 5), "");
});

test("phone and email checks", () => {
  assert.ok(isPhone("+1 (949) 427-7664"));
  assert.ok(!isPhone("call me"));
  assert.ok(isEmail("a@b.co"));
  assert.ok(!isEmail("a@b"));
});
