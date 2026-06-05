import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type RawSourceDoc = {
  sourcePath: string;
  slug: string;
  title: string;
  description: string;
};

type BasePage = string | BaseGroup;

type BaseGroup = {
  key: string;
  label: string;
  icon?: string;
  pages: BasePage[];
};

type BaseStructure = {
  tabs: Array<{
    key: string;
    label: string;
    groups: BaseGroup[];
  }>;
};

type TemplateGroup = {
  label: string;
  groups?: Record<string, TemplateGroup>;
};

type NavigationTemplate = {
  tabs?: {
    os?: {
      groups?: Record<string, TemplateGroup>;
    };
  };
};

const checkOnly = process.argv.includes('--check');
const thisFile = fileURLToPath(import.meta.url);
const docsRoot = path.resolve(path.dirname(thisFile), '..');
const repoRoot = path.resolve(docsRoot, '..', '..');
const baseStructurePath = path.join(docsRoot, 'navigation', 'base-structure.json');
const templatePath = path.join(docsRoot, 'navigation', 'navigation.template.json');

const localizedFallbackLanguages = ['fr', 'ar', 'cs', 'de', 'es', 'it', 'ja', 'ko', 'pt', 'ro', 'ru', 'tr', 'zh'] as const;

export const rawSourceDocs: RawSourceDoc[] = [
  {
    sourcePath: 'packages/os/STEERING.md',
    slug: 'os/tools/default-steering',
    title: 'Default Steering',
    description: 'Generated documentation for the default Consuelo OS steering source.',
  },
  {
    sourcePath: 'packages/os/TOOLS.md',
    slug: 'os/tools/tool-manifest',
    title: 'Tool Manifest',
    description: 'Generated documentation for the human-readable Consuelo OS tool catalog.',
  },
  {
    sourcePath: 'packages/os/SCRIPTS.md',
    slug: 'os/tools/scripts',
    title: 'Scripts',
    description: 'Generated documentation for the Consuelo OS scripts source.',
  },
  {
    sourcePath: 'packages/os/decision.md',
    slug: 'os/tools/decision-engine',
    title: 'Decision Engine',
    description: 'Generated documentation for the Consuelo OS decision process source.',
  },
];

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;

const yaml = (value: string): string => JSON.stringify(value);

const generatedNotice = (sourcePath: string): string =>
  `{/* Generated from ${sourcePath}. Do not edit this page directly. */}`;

const stripFrontmatter = (body: string): string => {
  if (!body.startsWith('---\n')) {
    return body;
  }

  const end = body.indexOf('\n---\n', 4);
  if (end === -1) {
    return body;
  }

  return body.slice(end + '\n---\n'.length);
};

const isFenceBoundary = (line: string): boolean => {
  const trimmed = line.trim();
  return trimmed.startsWith('```') || trimmed.startsWith('~~~');
};

const escapeMdxTextLine = (line: string): string =>
  line.replace(/\{/g, '\\{').replace(/\}/g, '\\}').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const mdxSafeMarkdown = (body: string): string => {
  const output: string[] = [];
  let inFence = false;

  for (const line of stripFrontmatter(body).trimEnd().split('\n')) {
    if (isFenceBoundary(line)) {
      inFence = !inFence;
      output.push(line);
      continue;
    }

    output.push(inFence ? line : escapeMdxTextLine(line));
  }

  return output.join('\n');
};

export const renderRawSourceDoc = (doc: RawSourceDoc): string => {
  const sourceFile = path.join(repoRoot, doc.sourcePath);
  if (!fs.existsSync(sourceFile)) {
    throw new Error(`${doc.sourcePath} does not exist. Do not generate ${doc.slug}.mdx until the source file is found.`);
  }

  const body = fs.readFileSync(sourceFile, 'utf8');
  return [
    '---',
    `title: ${yaml(doc.title)}`,
    `description: ${yaml(doc.description)}`,
    '---',
    '',
    generatedNotice(doc.sourcePath),
    '',
    mdxSafeMarkdown(body),
    '',
  ].join('\n');
};

const outputPath = (doc: RawSourceDoc): string => path.join(docsRoot, `${doc.slug}.mdx`);

const writeOrCheck = (filePath: string, content: string): void => {
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  if (checkOnly) {
    if (current !== content) {
      throw new Error(`${path.relative(repoRoot, filePath)} is stale. Run bun run --cwd packages/consuelo-docs generate-os-source-docs.`);
    }
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
};

export const assertRawSourceDocsFresh = (): void => {
  for (const doc of rawSourceDocs) {
    const expected = renderRawSourceDoc(doc);
    const filePaths = [
      outputPath(doc),
      ...localizedFallbackLanguages.map((language) => path.join(docsRoot, 'l', language, `${doc.slug}.mdx`)),
    ];

    for (const filePath of filePaths) {
      const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
      if (current !== expected) {
        throw new Error(`${path.relative(repoRoot, filePath)} is stale. Run bun run --cwd packages/consuelo-docs generate-os-source-docs.`);
      }
    }
  }
};

const syncRawSourceDocs = (): void => {
  for (const doc of rawSourceDocs) {
    writeOrCheck(outputPath(doc), renderRawSourceDoc(doc));
  }
};

const expectedToolPages = (): string[] => rawSourceDocs.map((doc) => doc.slug);

const syncBaseNavigation = (): void => {
  const structure = readJson<BaseStructure>(baseStructurePath);
  const osTab = structure.tabs.find((tab) => tab.key === 'os');
  if (!osTab) {
    throw new Error('navigation/base-structure.json is missing the os tab.');
  }

  const toolsGroup = osTab.groups.find((group) => group.key === 'osTools');
  if (toolsGroup) {
    toolsGroup.label = 'Tools';
    toolsGroup.icon = 'terminal';
    toolsGroup.pages = expectedToolPages();
  } else {
    const insertAfter = ['osAgentInterface', 'osConcepts', 'osOverview']
      .map((key) => osTab.groups.findIndex((group) => group.key === key))
      .find((index) => index !== -1);
    const insertBefore = osTab.groups.findIndex((group) => group.key === 'osSkills');
    const insertAt = insertAfter !== undefined ? insertAfter + 1 : insertBefore === -1 ? osTab.groups.length : insertBefore;
    osTab.groups.splice(insertAt, 0, {
      key: 'osTools',
      label: 'Tools',
      icon: 'terminal',
      pages: expectedToolPages(),
    });
  }

  writeOrCheck(baseStructurePath, `${JSON.stringify(structure, null, 2)}\n`);
};

const syncTemplateNavigation = (): void => {
  const template = readJson<NavigationTemplate>(templatePath);
  const osGroups = template.tabs?.os?.groups;
  if (!osGroups) {
    throw new Error('navigation/navigation.template.json is missing tabs.os.groups.');
  }

  const insertAfterKey = ['osAgentInterface', 'osConcepts', 'osOverview'].find((key) => key in osGroups);
  const nextGroups: Record<string, TemplateGroup> = {};
  let inserted = false;
  for (const [key, value] of Object.entries(osGroups)) {
    nextGroups[key] = value;
    if (key === insertAfterKey) {
      nextGroups.osTools = { label: 'Tools' };
      inserted = true;
    }
  }

  if (!inserted) {
    nextGroups.osTools = { label: 'Tools' };
  }

  template.tabs!.os!.groups = nextGroups;
  writeOrCheck(templatePath, `${JSON.stringify(template, null, 2)}\n`);
};

const writeLocalizedFallback = (doc: RawSourceDoc): void => {
  const content = fs.readFileSync(outputPath(doc), 'utf8');
  for (const language of localizedFallbackLanguages) {
    writeOrCheck(path.join(docsRoot, 'l', language, `${doc.slug}.mdx`), content);
  }
};

const syncLocalizedRawSourceDocs = (): void => {
  for (const doc of rawSourceDocs) {
    if (!fs.existsSync(outputPath(doc))) {
      throw new Error(`${doc.slug}.mdx must exist before locale fallbacks are generated.`);
    }
    writeLocalizedFallback(doc);
  }
};

export const runRawSourceDocsGenerator = (): void => {
  syncRawSourceDocs();
  syncBaseNavigation();
  syncTemplateNavigation();
  syncLocalizedRawSourceDocs();
  process.stdout.write(`${checkOnly ? 'checked' : 'generated'} ${rawSourceDocs.length} raw source docs\n`);
};

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === thisFile) {
  runRawSourceDocsGenerator();
}