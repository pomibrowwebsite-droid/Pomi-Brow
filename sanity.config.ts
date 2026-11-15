import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { schemaTypes } from "./cms/schema";
import { structure } from "./cms/structure";

const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID || "placeholder";
const dataset = import.meta.env.PUBLIC_SANITY_DATASET || "production";

export default defineConfig({
  name: "pomi-b-brow-studio",
  title: "Pomi B. Brow Studio",
  projectId,
  dataset,
  plugins: [structureTool({ structure })],
  schema: {
    types: schemaTypes,
    // Site settings is a singleton, and each page's address is fixed in the code (/safety,
    // /aftercare), so neither can be created from the "create new" menu.
    templates: (prev) => prev.filter((t) => t.schemaType !== "siteSettings" && t.schemaType !== "page"),
  },
  document: {
    actions: (prev, { schemaType }) =>
      schemaType === "siteSettings"
        ? prev.filter((a) => !["unpublish", "delete", "duplicate"].includes(a.action ?? ""))
        : prev,
  },
});
