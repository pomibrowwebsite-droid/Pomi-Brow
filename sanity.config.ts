import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { presentationTool } from "sanity/presentation";
import { PREVIEW_ORIGIN, resolve } from "./cms/presentation";
import { schemaTypes, SINGLETONS } from "./cms/schema";
import { structure } from "./cms/structure";

// The site build sets PUBLIC_*; the Sanity CLI (schema/document validation) only passes SANITY_STUDIO_*.
const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID || import.meta.env.SANITY_STUDIO_PROJECT_ID || "placeholder";
const dataset = import.meta.env.PUBLIC_SANITY_DATASET || "production";

export default defineConfig({
  name: "pomi-b-brow-studio",
  title: "Pomi B. Brow Studio",
  projectId,
  dataset,
  plugins: [
    structureTool({ structure, title: "Edit" }),
    // The real site beside the fields, updating as you type (preview.pomibrow.com).
    presentationTool({
      title: "Preview",
      previewUrl: { origin: PREVIEW_ORIGIN, previewMode: { enable: "/api/preview/enable" } },
      resolve,
    }),
  ],
  schema: {
    types: schemaTypes,
    // Studio details and the Home page are one of a kind, and each page's address is fixed in
    // the code (/safety, /aftercare), so none of them can be created from the "create new" menu.
    templates: (prev) => prev.filter((t) => !SINGLETONS.includes(t.schemaType) && t.schemaType !== "page"),
  },
  document: {
    // Nothing the site depends on can be deleted or unpublished by accident.
    actions: (prev, { schemaType }) =>
      SINGLETONS.includes(schemaType) || schemaType === "page"
        ? prev.filter((a) => !["unpublish", "delete", "duplicate"].includes(a.action ?? ""))
        : prev,
  },
});
