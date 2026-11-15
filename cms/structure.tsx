import type { StructureResolver } from "sanity/structure";
import { Guide } from "./Guide";

// What Pomi sees on the left, in the order she is likely to need it. A UI guardrail, not a
// permission boundary.
export const structure: StructureResolver = (S) =>
  S.list()
    .title("Website")
    .items([
      S.listItem().title("Start here").id("guide").child(S.component(Guide).title("Start here")),
      S.divider(),
      S.listItem()
        .title("Home page")
        .id("homePage")
        .child(S.document().schemaType("homePage").documentId("homePage").title("Home page")),
      S.listItem()
        .title("Services & prices")
        .child(S.documentTypeList("service").title("Services & prices").defaultOrdering([{ field: "order", direction: "asc" }])),
      S.listItem()
        .title("Learn articles")
        .child(S.documentTypeList("learnArticle").title("Learn articles").defaultOrdering([{ field: "order", direction: "asc" }])),
      S.listItem().title("Pages").child(S.documentTypeList("page").title("Pages")),
      S.listItem()
        .title("Reviews")
        .child(S.documentTypeList("review").title("Reviews").defaultOrdering([{ field: "order", direction: "asc" }])),
      S.divider(),
      S.listItem()
        .title("Studio details")
        .id("siteSettings")
        .child(S.document().schemaType("siteSettings").documentId("siteSettings").title("Studio details")),
    ]);
