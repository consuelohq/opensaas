import { siteMetadata } from './lib/site-seo';

export const SITE = {
  website: siteMetadata.siteUrl,
  author: "Consuelo Team",
  profile: "",
  desc: siteMetadata.blogDescription,
  title: siteMetadata.blogTitle,
  ogImage: siteMetadata.defaultOgImage,
  lightAndDarkMode: false,
  postPerIndex: 4,
  postPerPage: 4,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
  showBackButton: true, // show back button in post detail
  editPost: {
    enabled: false,
    text: "Edit page",
    url: "https://github.com/consuelohq/opensaas/edit/main/packages/consuelo-website/",
  },
  dynamicOgImage: true,
  dir: "ltr", // "rtl" | "auto"
  lang: "en", // html lang code. Set this empty and default will be "en"
  timezone: "UTC", // Default global timezone (IANA format) https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
} as const;
