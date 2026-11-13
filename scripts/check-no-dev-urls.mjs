// Build gate: nothing that only exists on a developer's machine may ship.
//
// A live-editing tool once left <script src="http://localhost:8400/live.js?token=..."> in the
// layout, and it went out on every page. This refuses any built page that loads a script,
// stylesheet, frame or image from localhost / 127.0.0.1, or from plain http:// at all.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const DIST = "dist";

function files(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...files(full));
    else if (/\.(html|js|css)$/.test(entry)) out.push(full);
  }
  return out;
}

const LOCAL = /(?:https?:)?\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?/gi;
const INSECURE_LOAD = /<(?:script|link|iframe|img|source)\b[^>]*\s(?:src|href)\s*=\s*["']http:\/\//gi;

const hits = [];
for (const file of files(DIST)) {
  const rel = relative(".", file).replace(/\\/g, "/");
  // Sanity Studio's bundle mentions localhost for its own dev tooling; it is not page markup.
  if (rel.startsWith("dist/admin") || (rel.startsWith("dist/_astro") && !rel.endsWith(".css"))) continue;
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(LOCAL)) hits.push(`${rel}: ${text.slice(Math.max(0, m.index - 40), m.index + 60)}`);
  if (rel.endsWith(".html")) for (const m of text.matchAll(INSECURE_LOAD)) hits.push(`${rel}: ${m[0]}`);
}

if (hits.length) {
  console.error(`\n✗ Development or insecure URLs reached the build (${hits.length}):\n`);
  for (const h of hits) console.error(`  ${h}\n`);
  process.exit(1);
}
console.log("✓ No localhost or http:// loads in the build.");
