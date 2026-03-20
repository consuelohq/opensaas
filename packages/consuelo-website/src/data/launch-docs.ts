import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
const docsConfigPath = resolve(process.cwd(), '../twenty-docs/docs.json');
const docsConfig = JSON.parse(readFileSync(docsConfigPath, 'utf-8')) as DocsConfig;

const englishNavigation = docsConfig.navigation.languages.find(
  (language) => language.language === 'en',
);

const docLabelOverrides: Record<string, string> = {
  'developers/introduction': 'introduction',
  'user-guide/introduction': 'introduction',
};

const flattenPages = (pages: DocsPage[]): string[] => {
  return pages.flatMap((page) => {
    if (typeof page === 'string') {
      return [page];
    }

    return flattenPages(page.pages);
  });
};

const formatDocLabel = (slug: string) => {
  const override = docLabelOverrides[slug];

  if (override) {
    return override;
  }

  const segments = slug.split('/');
  const lastSegment = segments.at(-1) ?? slug;
  const labelSource =
    lastSegment === 'overview' ? segments.at(-2) ?? lastSegment : lastSegment;

  return labelSource.replace(/-/g, ' ');
};

export const launchDocsMenuTabs: LaunchDocMenuTab[] =
  englishNavigation?.tabs.map((tab) => ({
    label: tab.tab.toLowerCase(),
    groups: tab.groups.map((group) => {
      const slugs = [...new Set(flattenPages(group.pages))];

      return {
        label: group.group.toLowerCase(),
        links: slugs.map((slug) => ({
          label: formatDocLabel(slug),
          href: docsBaseUrl + '/' + slug,
        })),
      };
    }),
  })) ?? [];
