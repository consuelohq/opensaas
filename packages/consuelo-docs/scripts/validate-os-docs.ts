import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertRawSourceDocsFresh,
  rawSourceDocs,
} from './generate-os-source-docs';

type NavPage = string | { pages?: NavPage[] };

type BaseGroup = {
  key: string;
  label: string;
  pages?: NavPage[];
};

type BaseStructure = {
  tabs: Array<{
    key: string;
    label: string;
    groups: BaseGroup[];
  }>;
};

type DocsConfig = {
  navigation?: {
    languages?: Array<{
      language: string;
      tabs?: Array<{
        tab: string;
        groups?: Array<{ pages?: NavPage[] }>;
      }>;
    }>;
  };
};

const thisFile = fileURLToPath(import.meta.url);
const docsRoot = path.resolve(path.dirname(thisFile), '..');
const baseStructurePath = path.join(docsRoot, 'navigation', 'base-structure.json');
const docsConfigPath = path.join(docsRoot, 'docs.json');

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;

const flattenPages = (pages: NavPage[]): string[] =>
  pages.flatMap((page) => (typeof page === 'string' ? [page] : flattenPages(page.pages ?? [])));

assertRawSourceDocsFresh();

const expectedToolPages = rawSourceDocs.map((doc) => doc.slug);
const baseStructure = readJson<BaseStructure>(baseStructurePath);
const osTab = baseStructure.tabs.find((tab) => tab.key === 'os');
if (!osTab) {
  throw new Error('navigation/base-structure.json is missing the OS tab.');
}

const toolsGroup = osTab.groups.find((group) => group.key === 'osTools');
if (!toolsGroup) {
  throw new Error('OS tab is missing the Tools group.');
}

const actualToolPages = toolsGroup.pages?.filter((page): page is string => typeof page === 'string') ?? [];
if (actualToolPages.join('\n') !== expectedToolPages.join('\n')) {
  throw new Error(`OS Tools nav entries are stale. Expected:\n${expectedToolPages.join('\n')}\nActual:\n${actualToolPages.join('\n')}`);
}

const docsConfig = readJson<DocsConfig>(docsConfigPath);
const languages = docsConfig.navigation?.languages ?? [];
if (languages.length === 0) {
  throw new Error('docs.json is missing localized navigation languages.');
}

const missing: string[] = [];
for (const language of languages) {
  const docsOsTab = language.tabs?.find((tab) => tab.tab === 'OS');
  if (!docsOsTab) {
    missing.push(`${language.language}: OS tab`);
    continue;
  }

  const docsPages = new Set(docsOsTab.groups?.flatMap((group) => flattenPages(group.pages ?? [])) ?? []);
  for (const slug of expectedToolPages) {
    const localizedSlug = language.language === 'en' ? slug : `l/${language.language}/${slug}`;
    if (!docsPages.has(localizedSlug)) {
      missing.push(`${language.language}: ${localizedSlug}`);
    }
  }
}

if (missing.length > 0) {
  throw new Error(`docs.json OS navigation is missing generated raw-source pages:\n${missing.join('\n')}`);
}

process.stdout.write(`validated ${expectedToolPages.length} generated raw-source pages and OS Tools navigation\n`);
