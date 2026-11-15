import { service } from "./service";
import { learnArticle } from "./learnArticle";
import { page } from "./page";
import { homePage } from "./homePage";
import { review } from "./review";
import { siteSettings } from "./siteSettings";
import { sectionTypes } from "./sections";

export const schemaTypes = [homePage, service, learnArticle, page, review, siteSettings, ...sectionTypes];

/** One-of-a-kind documents: they can't be created, deleted or duplicated from the Studio. */
export const SINGLETONS = ["siteSettings", "homePage"];
