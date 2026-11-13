// Accessibility audit of every built page with axe-core (WCAG 2.0-2.2 A and AA rules), at a
// desktop and a phone width. Fails on any serious or critical violation; prints minor and
// moderate ones as warnings. Needs a server already answering for the built site, e.g.
//   npx wrangler dev --port 8788      (dist/ with the real headers and API)
//   node scripts/a11y-audit.mjs http://127.0.0.1:8788
import puppeteer from "puppeteer-core";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative } from "node:path";
import { BROWSER_CANDIDATES } from "./live-pages.mjs";

const base = (process.argv[2] ?? "http://127.0.0.1:8788").replace(/\/$/, "");
const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

function routes(dir = "dist") {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative("dist", full).split("\\").join("/");
    if (rel.startsWith("admin") || rel.startsWith("_astro")) continue;
    if (statSync(full).isDirectory()) out.push(...routes(full));
    else if (entry === "index.html") out.push("/" + rel.replace(/\/?index\.html$/, ""));
    else if (entry.endsWith(".html")) out.push("/" + rel.replace(/\.html$/, ""));
  }
  return out.sort();
}

const executablePath = BROWSER_CANDIDATES.find((p) => existsSync(p));
if (!executablePath) throw new Error("No Chrome or Edge found");
const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox"] });

let failures = 0;
let checked = 0;
const all = routes();
if (all.length === 0) throw new Error("No built pages found in dist/. Run npm run build first.");
console.log(`Auditing ${all.length} pages at desktop and phone widths...`);
try {
  for (const route of all) {
    for (const [tag, width, height, mobile] of [
      ["desktop", 1440, 900, false],
      ["phone", 390, 844, true],
    ]) {
      const page = await browser.newPage();
      await page.setViewport({ width, height, isMobile: mobile, hasTouch: mobile });
      // Reveal transitions would otherwise leave blocks mid-fade while axe measures contrast.
      await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
      await page.goto(base + route, { waitUntil: "load", timeout: 60000 });
      await page.evaluate(axeSource);
      const result = await page.evaluate(() =>
        // @ts-ignore -- axe is injected above
        window.axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
        })
      );
      checked += result.passes.length;
      for (const v of result.violations) {
        const serious = v.impact === "serious" || v.impact === "critical";
        if (serious) failures++;
        console.log(`${serious ? "✗" : "!"} ${route} [${tag}] ${v.impact}: ${v.id} -- ${v.help}`);
        for (const n of v.nodes.slice(0, 3)) console.log(`    ${n.target.join(" ")}  ${n.failureSummary?.split("\n")[1]?.trim() ?? ""}`);
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
}

if (failures) {
  console.error(`\n✗ ${failures} serious or critical accessibility violation(s).`);
  process.exit(1);
}
console.log(`✓ No serious or critical accessibility violations (${checked} rule passes across all pages).`);
