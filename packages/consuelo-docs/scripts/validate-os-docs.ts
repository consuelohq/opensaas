import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Page = string | Group;

type Group = {
  group?: string;
  pages?: Page[];
};

type Tab = {
  tab: string;
  groups?: Group[];
  pages?: Page[];
};

type LanguageEntry = {
  language: string;
  tabs: Tab[];
};

type DocsConfig = {
  navigation: {
    languages: LanguageEntry[];
  };
  redirects?: Array<{
    source: string;
    destination: string;
  }>;
};

const removedRawSourceSlugs = [
  'os/agent-context/steering',
  'os/agent-context/decision',
  'os/agent-context/tools',
  'os/agent-context/scripts',
  'os/tools/default-steering',
  'os/tools/decision-engine',
  'os/tools/tool-manifest',
  'os/tools/scripts',
] as const;

const removedRawSourceSlugPattern = /(?:^|\/)os\/(?:agent-context\/(?:steering|decision|tools|scripts)|tools\/(?:default-steering|decision-engine|tool-manifest|scripts))$/;

const thisFile = fileURLToPath(import.meta.url);
const docsRoot = path.resolve(path.dirname(thisFile), '..');
const docsJsonPath = path.join(docsRoot, 'docs.json');
const docsConfig = JSON.parse(fs.readFileSync(docsJsonPath, 'utf8')) as DocsConfig;

const isGroup = (page: Page): page is Group => typeof page !== 'string';

const flattenPages = (pages: Page[] = []): string[] =>
  pages.flatMap((page) => (typeof page === 'string' ? [page] : flattenPages(page.pages)));

const findGroup = (groups: Group[], predicate: (group: Group) => boolean): Group | null => {
  for (const group of groups) {
    if (predicate(group)) return group;
    const nestedMatch = findGroup((group.pages ?? []).filter(isGroup), predicate);
    if (nestedMatch) return nestedMatch;
  }
  return null;
};

const tabGroups = (tab: Tab): Group[] => [
  ...(tab.groups ?? []),
  ...((tab.pages ?? []).filter(isGroup)),
];

const languageGroups = (language: LanguageEntry): Group[] =>
  language.tabs.flatMap((tab) => tabGroups(tab));


const osGroupsForLanguage = (language: LanguageEntry): Group[] => {
  const topLevelOsTab = language.tabs.find((tab) => tab.tab === 'OS');
  if (topLevelOsTab?.groups) return topLevelOsTab.groups;

  const osRootGroup = findGroup(
    languageGroups(language),
    (group) =>
      group.group === 'OS' ||
      flattenPages(group.pages ?? []).some(
        (slug) => slug === 'os/overview' || slug.endsWith('/os/overview'),
      ),
  );
  if (osRootGroup) return (osRootGroup.pages ?? []).filter(isGroup);

  throw new Error(`${language.language}: missing OS navigation group`);
};

const readPageTitle = (content: string, slug: string): string => {
  const match = content.match(/^title: (.+)$/m);
  if (!match) {
    return slug;
  }

  try {
    return JSON.parse(match[1]) as string;
  } catch {
    return match[1];
  }
};

const english = docsConfig.navigation.languages.find((entry) => entry.language === 'en');
if (!english) {
  throw new Error('docs.json is missing the English navigation entry.');
}

const osGroups = osGroupsForLanguage(english);
const allEnglishGroups = languageGroups(english);

const placeholderHits: string[] = [];
const scanForPlaceholders = (dir: string): void => {
  if (!fs.existsSync(dir)) {
    return;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanForPlaceholders(filePath);
      continue;
    }
    if (!entry.name.endsWith('.mdx')) {
      continue;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('documentation page is being rebuilt')) {
      placeholderHits.push(path.relative(docsRoot, filePath));
    }
  }
};
scanForPlaceholders(path.join(docsRoot, 'os'));
if (placeholderHits.length) {
  throw new Error(`OS docs still contain generated placeholder pages:
${placeholderHits.join('\n')}`);
}

const skillsGroup = findGroup(allEnglishGroups, (group) =>
  (group.pages ?? []).some((page) => typeof page === 'string' && page.startsWith('os/skills/')),
);
if (!skillsGroup) {
  throw new Error('OS navigation is missing the Skills group.');
}

if (findGroup(allEnglishGroups, (group) => group.group === 'Runbooks')) {
  throw new Error('OS navigation still contains a Runbooks group.');
}

const skillPages = skillsGroup.pages?.filter((page): page is string => typeof page === 'string') ?? [];
const titles = skillPages.map((slug) => {
  const pagePath = path.join(docsRoot, `${slug}.mdx`);
  const content = fs.readFileSync(pagePath, 'utf8');
  return readPageTitle(content, slug);
});

const sortedTitles = [...titles].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
if (titles.join('\n') !== sortedTitles.join('\n')) {
  throw new Error('Skill docs are not sorted alphabetically.');
}

const allNavigationSlugs = docsConfig.navigation.languages.flatMap((language) => {
  return language.tabs
    .flatMap((tab) => [...(tab.groups ?? []), ...(tab.pages ?? [])])
    .flatMap((page) => (typeof page === 'string' ? [page] : flattenPages(page.pages ?? [])));
});

const rawSourceNavigationHits = allNavigationSlugs.filter((slug) =>
  removedRawSourceSlugPattern.test(slug),
);
if (rawSourceNavigationHits.length) {
  throw new Error(
    `OS docs navigation still references removed raw-source pages:\n${rawSourceNavigationHits.join('\n')}`,
  );
}

const rawSourceFileHits = removedRawSourceSlugs.filter((slug) =>
  fs.existsSync(path.join(docsRoot, `${slug}.mdx`)),
);
if (rawSourceFileHits.length) {
  throw new Error(
    `OS docs still contain removed raw-source pages:\n${rawSourceFileHits.join('\n')}`,
  );
}

const rawSourceRedirectHits = (docsConfig.redirects ?? []).filter((redirect) =>
  removedRawSourceSlugPattern.test(redirect.source) ||
  removedRawSourceSlugPattern.test(redirect.destination),
);
if (rawSourceRedirectHits.length) {
  throw new Error(
    `docs.json still redirects removed raw-source pages:\n${rawSourceRedirectHits
      .map((redirect) => `${redirect.source} -> ${redirect.destination}`)
      .join('\n')}`,
  );
}

const osMissing = docsConfig.navigation.languages.flatMap((language) =>
  language.tabs
    .flatMap((tab) => [...(tab.groups ?? []), ...(tab.pages ?? [])])
    .flatMap((page) => (typeof page === 'string' ? [page] : flattenPages(page.pages ?? [])))
    .filter((slug) => slug.startsWith('os/') || slug.includes('/os/'))
    .filter((slug) => !fs.existsSync(path.join(docsRoot, `${slug}.mdx`)))
    .map((slug) => `${language.language}: ${slug}`),
);

if (osMissing.length) {
  throw new Error(`OS docs nav has missing pages:\n${osMissing.join('\n')}`);
}


const agentTddSlug = 'os/agent-context/test-driven-agent-work';
const agentContextGroup = findGroup(allEnglishGroups, (group) =>
  (group.pages ?? []).some((page) => page === agentTddSlug),
);
if (!agentContextGroup) {
  throw new Error('OS navigation is missing the Agent Work group.');
}

const agentContextPages = flattenPages(agentContextGroup.pages ?? []);
if (!agentContextPages.includes(agentTddSlug)) {
  throw new Error('Agent Context navigation is missing test-driven agent work.');
}

const agentTddPath = path.join(docsRoot, `${agentTddSlug}.mdx`);
const agentTddContent = fs.readFileSync(agentTddPath, 'utf8');
for (const phrase of [
  'title: "Test Driven Development"',
  'Intent assertion',
  'Red',
  'Green',
  'Yellow / Amber',
  'Workpad contract',
  'context compaction',
  'Mintlify docs validation',
  'TDD is how agents preserve intent',
]) {
  if (!agentTddContent.includes(phrase)) {
    throw new Error(`test-driven agent work doc is missing required phrase: ${phrase}`);
  }
}

process.stdout.write(`validated ${skillPages.length} generated skill pages and raw-source doc removal\n`);
