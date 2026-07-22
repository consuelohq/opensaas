import docsConfigJson from './docs-navigation-source.json';

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

export type DocLink = {
  label: string;
  href: string;
};

export type DocMenuGroup = {
  label: string;
  links: DocLink[];
};

export type DocMenuTab = {
  label: string;
  groups: DocMenuGroup[];
};

const docsBaseUrl = 'https://docs.consuelohq.com';
const docsConfig = docsConfigJson as DocsConfig;

const englishNavigation = docsConfig.navigation.languages.find(
  (language) => language.language === 'en',
);

const groupLabelOverrides: Record<string, string> = {
  'Discover Twenty': 'Discover Consuelo',
};

const docLabelOverrides: Record<string, string> = {
  'developers/introduction': 'Introduction',
  'user-guide/introduction': 'Introduction',
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

  const acronyms: Record<string, string> = {
    ai: 'AI', api: 'API', apis: 'APIs', sso: 'SSO', faq: 'FAQ',
    csv: 'CSV', cli: 'CLI', crm: 'CRM', sdk: 'SDK', pdf: 'PDF',
    http: 'HTTP', smtp: 'SMTP', imap: 'IMAP',
  };

  return labelSource
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b\w+\b/g, (word) => acronyms[word.toLowerCase()] ?? word);
};

const expandGroups = (groups: DocsGroup[]): DocsGroup[] => {
  return groups.flatMap((group) => {
    const subGroups = group.pages.filter(
      (p): p is { group: string; pages: DocsPage[] } => typeof p !== 'string',
    );

    if (subGroups.length > 0 && group.pages.every((p) => typeof p !== 'string')) {
      return subGroups;
    }

    return [group];
  });
};

export const docsMenuTabs: DocMenuTab[] =
  englishNavigation?.tabs.map((tab) => ({
    label: tab.tab,
    groups: expandGroups(tab.groups).map((group) => {
      const slugs = [...new Set(flattenPages(group.pages))];

      return {
        label: groupLabelOverrides[group.group] ?? group.group,
        links: slugs.map((slug) => ({
          label: formatDocLabel(slug),
          href: docsBaseUrl + '/' + slug,
        })),
      };
    }),
  })) ?? [];
