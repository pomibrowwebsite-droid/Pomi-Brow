import type { StructureResolver } from "sanity/structure";

// The client sees only these four things. It is a UI guardrail, not a permission boundary.
export const structure: StructureResolver = (S) =>
  S.list()
    .title("Pomi B. Brow Studio")
    .items([
      S.listItem()
        .title("Services & prices")
        .child(S.documentTypeList("service").title("Services & prices").defaultOrdering([{ field: "order", direction: "asc" }])),
      S.listItem()
        .title("Learn articles")
        .child(S.documentTypeList("learnArticle").title("Learn articles")),
      S.listItem()
        .title("Pages")
        .child(S.documentTypeList("page").title("Pages")),
      S.listItem()
        .title("Reviews")
        .child(S.documentTypeList("review").title("Reviews").defaultOrdering([{ field: "order", direction: "asc" }])),
      S.divider(),
      S.listItem()
        .title("Site settings")
        .child(S.document().schemaType("siteSettings").documentId("siteSettings")),
    ]);
