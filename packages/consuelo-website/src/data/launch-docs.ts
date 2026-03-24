
type DocsPage =
  | string
  | {
      group: string;
      pages: DocsPage[];
    };

type DocsGroup = {
  group: string;
  pages: DocsPage[];
};

type DocsTab = {
  tab: string;
  groups: DocsGroup[];
};

type DocsLanguage = {
  language: string;
  tabs: DocsTab[];
};

type DocsConfig = {
  navigation: {
    languages: DocsLanguage[];
  };
};

export type LaunchDocLink = {
  label: string;
  href: string;
};

export type LaunchDocMenuGroup = {
  label: string;
  links: LaunchDocLink[];
};

export type LaunchDocMenuTab = {
  label: string;
  groups: LaunchDocMenuGroup[];
};

const docsBaseUrl = 'https://docs.consuelohq.com';

// For Cloudflare deployment, we either need to import this statically or provide a fallback
// For now, we'll use a static fallback to avoid node:fs dependency issues in the Cloudflare edge runtime
export const launchDocsMenuTabs: LaunchDocMenuTab[] = [
  {
    label: "user guide",
    groups: [
      {
        label: "introduction",
        links: [
          { label: "introduction", href: "https://docs.consuelohq.com/user-guide/introduction" }
        ]
      }
    ]
  },
  {
    label: "developers",
    groups: [
      {
        label: "introduction",
        links: [
          { label: "introduction", href: "https://docs.consuelohq.com/developers/introduction" }
        ]
      }
    ]
  }
];
