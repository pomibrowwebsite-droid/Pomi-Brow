// Proves the Sanity import changes nothing a visitor can see. Builds the site twice -- from the
// repo's seed content, then from exactly what scripts/sanity-import.mjs would write to Sanity
// (served locally by src/lib/sanity-fixture.ts) -- and compares every page's HTML.
//
//   node scripts/sanity-parity.mjs
//
// Exits 1 and shows where each differing page first diverges. /admin (the Studio itself, only
// built when a project is set) is left out of the comparison.
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const work = mkdtempSync(join(tmpdir(), "pomi-parity-"));
const fixture = join(work, "fixture.ndjson");

const run = (cmd, env = {}) =>
  execSync(cmd, { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"], env: { ...process.env, HOME_ONLY: "", ...env } });

console.log("1/3  Writing the import to a local fixture");
run(`node scripts/sanity-import.mjs --fixture "${fixture}"`);

console.log("2/3  Building from the seed");
run("npx astro build", { PUBLIC_SANITY_PROJECT_ID: "", SANITY_FIXTURE: "" });
cpSync(join(ROOT, "dist"), join(work, "seed"), { recursive: true });

console.log("3/3  Building from the Sanity import");
run("npx astro build", { PUBLIC_SANITY_PROJECT_ID: "fixture1", PUBLIC_SANITY_DATASET: "production", SANITY_FIXTURE: fixture });
cpSync(join(ROOT, "dist"), join(work, "sanity"), { recursive: true });

const pages = (dir) => {
  const out = [];
  (function walk(d) {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith(".html")) out.push(relative(dir, p).replace(/\\/g, "/"));
    }
  })(dir);
  return out.filter((p) => !p.startsWith("admin")).sort();
};

const a = pages(join(work, "seed"));
const b = pages(join(work, "sanity"));
const problems = [];
for (const p of a.filter((p) => !b.includes(p))) problems.push(`${p}: missing from the Sanity build`);
for (const p of b.filter((p) => !a.includes(p))) problems.push(`${p}: only in the Sanity build`);
let same = 0;
for (const p of a.filter((p) => b.includes(p))) {
  const x = readFileSync(join(work, "seed", p), "utf8");
  const y = readFileSync(join(work, "sanity", p), "utf8");
  if (x === y) {
    same++;
    continue;
  }
  let i = 0;
  while (i < x.length && x[i] === y[i]) i++;
  const at = (s) => s.slice(Math.max(0, i - 120), i + 160).replace(/\s+/g, " ");
  problems.push(`${p}: differs at character ${i}\n    seed:   …${at(x)}…\n    sanity: …${at(y)}…`);
}

rmSync(work, { recursive: true, force: true });
console.log(`\n${same} of ${a.length} pages identical.`);
if (problems.length) {
  console.log(problems.join("\n"));
  process.exit(1);
}
console.log("✓ The Sanity import renders the site exactly as the seed does.");
