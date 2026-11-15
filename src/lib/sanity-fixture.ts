// A stand-in for the Sanity client that answers GROQ from a local NDJSON export, using the same
// query engine Sanity runs (groq-js). Only the parity check uses it (scripts/sanity-parity.mjs):
// it builds the site from exactly what the import would write, with no project or network.
import { readFileSync } from "node:fs";
import { parse, evaluate } from "groq-js";

export function fixtureClient(path: string) {
  const dataset = readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
  return {
    async fetch(query: string, params: Record<string, unknown> = {}) {
      const result = await evaluate(parse(query, { params }), { dataset, params });
      return result.get();
    },
  };
}
