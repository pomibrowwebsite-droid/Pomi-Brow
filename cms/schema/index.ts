import { service } from "./service";
import { learnArticle } from "./learnArticle";
import { page } from "./page";
import { review } from "./review";
import { siteSettings } from "./siteSettings";
import { sectionTypes } from "./sections";

export const schemaTypes = [service, learnArticle, page, review, siteSettings, ...sectionTypes];
