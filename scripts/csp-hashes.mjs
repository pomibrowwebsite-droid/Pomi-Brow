// Build step: give the Content-Security-Policy in dist/_headers the hash of every inline script.
//
// Astro inlines small component scripts, and the layout has one tiny is:inline script. Rather
// than allow all inline script ('unsafe-inline'), the policy lists the sha256 of each one. They
// change whenever a script changes, so they are computed from the built HTML every build and
// written over the {{SCRIPT_HASHES}} token that public/_headers ships with.
//
// Also fails the build if any page uses an inline event handler (onclick= and friends), which a
// hash-based policy blocks.

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";

const DIST = "dist";
const HEADERS = join(DIST, "_headers");
const TOKEN = "{{SCRIPT_HASHES}}";
// Data blocks are not executed, so CSP does not apply to them.
const DATA_TYPES = /^(application\/(ld\+)?json|importmap|text\/template)$/i;

function htmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...htmlFiles(full));
    else if (entry.endsWith(".html")) out.push(full);
  }
  return out;
}

const hashes = new Set();
const handlers = [];
for (const file of htmlFiles(DIST)) {
  // Sanity Studio runs under its own policy (see public/_headers).
  if (relative(DIST, file).replace(/\\/g, "/").startsWith("admin")) continue;
  const html = readFileSync(file, "utf8");
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const [, attrs, body] = m;
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const type = attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i)?.[1] ?? "";
    if (DATA_TYPES.test(type)) continue;
    hashes.add(`'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`);
  }
  for (const m of html.matchAll(/<[a-z][^>]*\s(on[a-z]+)\s*=/gi)) handlers.push(`${relative(".", file)}: ${m[1]}`);
}

if (handlers.length) {
  console.error(`\n✗ Inline event handlers would be blocked by the CSP:\n  ${handlers.join("\n  ")}\n`);
  process.exit(1);
}

let headers;
try {
  headers = readFileSync(HEADERS, "utf8");
} catch {
  console.error(`✗ ${HEADERS} not found. public/_headers should be copied into the build.`);
  process.exit(1);
}
if (!headers.includes(TOKEN)) {
  console.error(`✗ ${HEADERS} has no ${TOKEN} token to fill.`);
  process.exit(1);
}
writeFileSync(HEADERS, headers.replaceAll(TOKEN, [...hashes].sort().join(" ")));
console.log(`✓ CSP lists ${hashes.size} inline script hash(es).`);
