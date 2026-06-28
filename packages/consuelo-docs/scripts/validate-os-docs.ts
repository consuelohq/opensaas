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
  groups: Group[];
};

type LanguageEntry = {
  language: string;
  tabs: Tab[];
};

type DocsConfig = {
  navigation: {
    languages: LanguageEntry[];
  };
};

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

const osGroupsForLanguage = (language: LanguageEntry): Group[] => {
  const topLevelOsTab = language.tabs.find((tab) => tab.tab === 'OS');
  if (topLevelOsTab) return topLevelOsTab.groups;

  const osRootGroup = findGroup(
    language.tabs.flatMap((tab) => tab.groups),
    (group) => group.group === 'OS',
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

const skillsGroup = findGroup(osGroups, (group) => flattenPages(group.pages ?? []).some((slug) => slug.startsWith('os/skills/') || slug.includes('/os/skills/')));
if (!skillsGroup) {
  throw new Error('OS navigation is missing the Skills group.');
}

if (osGroups.some((group) => group.group === 'Runbooks')) {
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

const osMissing = docsConfig.navigation.languages.flatMap((language) =>
  osGroupsForLanguage(language)
    .flatMap((group) => flattenPages(group.pages ?? []))
    .filter((slug) => !fs.existsSync(path.join(docsRoot, `${slug}.mdx`)))
    .map((slug) => `${language.language}: ${slug}`),
);

if (osMissing.length) {
  throw new Error(`OS docs nav has missing pages:\n${osMissing.join('\n')}`);
}


const agentTddSlug = 'os/agent-context/test-driven-agent-work';
const agentContextGroup = findGroup(osGroups, (group) => flattenPages(group.pages ?? []).includes(agentTddSlug));
if (!agentContextGroup) {
  throw new Error('OS navigation is missing the Agent Context group.');
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

process.stdout.write(`validated ${skillPages.length} generated skill pages and localized OS routes\n`);
