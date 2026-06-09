import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type RawSourceDoc = {
  sourcePath: string;
  slug: string;
  legacySlugs: string[];
  title: string;
  description: string;
  runtimeRole: string;
  controls: string;
  generatedRoute: string;
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

type DocsJson = {
  redirects?: Array<{
    source: string;
    destination: string;
  }>;
  [key: string]: unknown;
};

const checkOnly = process.argv.includes('--check');
const thisFile = fileURLToPath(import.meta.url);
const docsRoot = path.resolve(path.dirname(thisFile), '..');
const repoRoot = path.resolve(docsRoot, '..', '..');
const baseStructurePath = path.join(docsRoot, 'navigation', 'base-structure.json');
const templatePath = path.join(docsRoot, 'navigation', 'navigation.template.json');
const docsJsonPath = path.join(docsRoot, 'docs.json');

const agentContextGroupKey = 'osAgentContext';
// Legacy raw-source slugs still redirect from /os/tools/*, but osTools is now a real
// user-facing group. Do not remove it when injecting Agent Context.
const legacyGroupKey = '__legacyOsRawSourceTools';
const agentContextGroupLabel = 'Agent Context';
const agentContextGroupIcon = 'brain';

const localizedFallbackLanguages = ['fr', 'ar', 'cs', 'de', 'es', 'it', 'ja', 'ko', 'pt', 'ro', 'ru', 'tr', 'zh'] as const;

export const rawSourceDocs: RawSourceDoc[] = [
  {
    sourcePath: 'packages/os/STEERING.md',
    slug: 'os/agent-context/steering',
    legacySlugs: ['os/tools/default-steering'],
    title: 'steering.md',
    description: 'Runtime steering loaded into the Consuelo OS agent.',
    runtimeRole: 'Identity, product boundaries, OS server contract, permissions posture, customer-facing skill doctrine, and runtime operating context.',
    controls: 'How OS agents think, which server and skill boundaries they protect, when they act, and when they stop.',
    generatedRoute: '/os/agent-context/steering',
  },
  {
    sourcePath: 'packages/os/decision.md',
    slug: 'os/agent-context/decision',
    legacySlugs: ['os/tools/decision-engine'],
    title: 'decision.md',
    description: 'Decision-process doctrine used by Consuelo OS agents.',
    runtimeRole: 'Decision-engine doctrine for evidence collection, confidence, validation, and next action selection inside Consuelo OS.',
    controls: 'How OS agents inspect facts, resolve conflicts, preserve intent, and choose the next safe action.',
    generatedRoute: '/os/agent-context/decision',
  },
  {
    sourcePath: 'packages/os/TOOLS.md',
    slug: 'os/agent-context/tools',
    legacySlugs: ['os/tools/tool-manifest'],
    title: 'tools.md',
    description: 'Human-readable catalog of callable Consuelo OS tools.',
    runtimeRole: 'OS tool contracts, call shapes, envelopes, categories, skill-facing examples, and operational affordances.',
    controls: 'Which OS tool names exist, how they are called through the server, and what each tool returns.',
    generatedRoute: '/os/agent-context/tools',
  },
  {
    sourcePath: 'packages/os/SCRIPTS.md',
    slug: 'os/agent-context/scripts',
    legacySlugs: ['os/tools/scripts'],
    title: 'scripts.md',
    description: 'Procedural script reference for Consuelo OS runtime work.',
    runtimeRole: 'OS runtime scripts, install commands, task commands, validation commands, and operator procedures.',
    controls: 'How humans and agents run OS operations without bypassing the server, skill, or task workflow.',
    generatedRoute: '/os/agent-context/scripts',
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

const fenceInfoPattern = /^(\s*)(`{3,}|~{3,})(.*)$/;
const fenceClosePattern = /^(\s*)(`{3,}|~{3,})\s*$/;

type FenceState = {
  marker: '`' | '~';
  length: number;
};

const openingFence = (line: string): FenceState | null => {
  const match = line.match(fenceInfoPattern);
  if (!match) return null;
  const markerRun = match[2];
  return {
    marker: markerRun[0] as '`' | '~',
    length: markerRun.length,
  };
};

const closesFence = (line: string, fence: FenceState): boolean => {
  const match = line.match(fenceClosePattern);
  if (!match) return false;
  const markerRun = match[2];
  return markerRun[0] === fence.marker && markerRun.length >= fence.length;
};

const normalizeAnglePlaceholders = (line: string): string =>
  line.replace(/<([a-zA-Z][a-zA-Z0-9_-]*(?: [a-zA-Z0-9_-]+)*)>/g, '{$1}');

const escapeMdxTextLine = (line: string): string =>
  normalizeAnglePlaceholders(line)
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const mdxSafeMarkdown = (body: string): string => {
  const output: string[] = [];
  let fence: FenceState | null = null;

  for (const rawLine of stripFrontmatter(body).trimEnd().split('\n')) {
    const line = rawLine.trimEnd();
    if (fence) {
      output.push(normalizeAnglePlaceholders(line));
      if (closesFence(line, fence)) {
        fence = null;
      }
      continue;
    }

    const maybeFence = openingFence(line);
    if (maybeFence) {
      fence = maybeFence;
      output.push(line);
      continue;
    }

    output.push(escapeMdxTextLine(line));
  }

  return output.join('\n');
};

const tableCell = (value: string): string => value.replace(/\|/g, '\\|').replace(/\n/g, ' ');

const renderSourceIntro = (doc: RawSourceDoc): string[] => [
  `> ${doc.description}`,
  '',
  '<Note>',
  `This page is generated from \`${doc.sourcePath}\`. Edit the source Markdown, then run \`bun run --cwd packages/consuelo-docs generate-os-source-docs\` to refresh the public docs.`,
  '</Note>',
  '',
  '## What this file controls',
  '',
  '| Field | Value |',
  '| --- | --- |',
  `| Source file | \`${doc.sourcePath}\` |`,
  `| Runtime role | ${tableCell(doc.runtimeRole)} |`,
  `| Controls | ${tableCell(doc.controls)} |`,
  `| Generated route | \`${doc.generatedRoute}\` |`,
  '',
  '## Source document',
  '',
];

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
    ...renderSourceIntro(doc),
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

const expectedAgentContextPages = (): string[] => rawSourceDocs.map((doc) => doc.slug);

const buildAgentContextGroup = (): BaseGroup => ({
  key: agentContextGroupKey,
  label: agentContextGroupLabel,
  icon: agentContextGroupIcon,
  pages: expectedAgentContextPages(),
});

const insertAgentContextGroup = (groups: BaseGroup[]): BaseGroup[] => {
  const cleaned = groups.filter((group) => group.key !== agentContextGroupKey && group.key !== legacyGroupKey);
  const insertAfter = ['osConcepts', 'osAgentInterface', 'osOverview']
    .map((key) => cleaned.findIndex((group) => group.key === key))
    .find((index) => index !== -1);
  const insertBefore = cleaned.findIndex((group) => group.key === 'osSkills');
  const insertAt = insertAfter !== undefined ? insertAfter + 1 : insertBefore === -1 ? cleaned.length : insertBefore;

  cleaned.splice(insertAt, 0, buildAgentContextGroup());
  return cleaned;
};

const syncBaseNavigation = (): void => {
  const structure = readJson<BaseStructure>(baseStructurePath);
  const osTab = structure.tabs.find((tab) => tab.key === 'os');
  if (!osTab) {
    throw new Error('navigation/base-structure.json is missing the os tab.');
  }

  osTab.groups = insertAgentContextGroup(osTab.groups);
  writeOrCheck(baseStructurePath, `${JSON.stringify(structure, null, 2)}\n`);
};

const syncTemplateNavigation = (): void => {
  const template = readJson<NavigationTemplate>(templatePath);
  const osGroups = template.tabs?.os?.groups;
  if (!osGroups) {
    throw new Error('navigation/navigation.template.json is missing tabs.os.groups.');
  }

  const nextGroups: Record<string, TemplateGroup> = {};
  let inserted = false;
  const insertAfterKey = ['osConcepts', 'osAgentInterface', 'osOverview'].find((key) => key in osGroups);

  for (const [key, value] of Object.entries(osGroups)) {
    if (key === legacyGroupKey || key === agentContextGroupKey) {
      continue;
    }

    nextGroups[key] = value;
    if (key === insertAfterKey) {
      nextGroups[agentContextGroupKey] = { label: agentContextGroupLabel };
      inserted = true;
    }
  }

  if (!inserted) {
    nextGroups[agentContextGroupKey] = { label: agentContextGroupLabel };
  }

  template.tabs!.os!.groups = nextGroups;
  writeOrCheck(templatePath, `${JSON.stringify(template, null, 2)}\n`);
};

const redirectFor = (slug: string, target: string, language?: string): { source: string; destination: string } => {
  const prefix = language ? `/l/${language}/` : '/';
  return {
    source: `${prefix}${slug}`,
    destination: `${prefix}${target}`,
  };
};

const expectedRedirects = (): Array<{ source: string; destination: string }> => {
  const redirects: Array<{ source: string; destination: string }> = [];
  for (const doc of rawSourceDocs) {
    for (const legacySlug of doc.legacySlugs) {
      redirects.push(redirectFor(legacySlug, doc.slug));
      for (const language of localizedFallbackLanguages) {
        redirects.push(redirectFor(legacySlug, doc.slug, language));
      }
    }
  }
  return redirects;
};

const syncDocsRedirects = (): void => {
  const docsJson = readJson<DocsJson>(docsJsonPath);
  const required = expectedRedirects();
  const requiredSources = new Set(required.map((redirect) => redirect.source));
  const existing = (docsJson.redirects ?? []).filter((redirect) => !requiredSources.has(redirect.source));
  const next = [...existing, ...required].sort((a, b) => a.source.localeCompare(b.source));
  docsJson.redirects = next;
  writeOrCheck(docsJsonPath, `${JSON.stringify(docsJson, null, 2)}\n`);
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
  syncDocsRedirects();
  syncLocalizedRawSourceDocs();
  process.stdout.write(`${checkOnly ? 'checked' : 'generated'} ${rawSourceDocs.length} raw source docs\n`);
};

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === thisFile) {
  runRawSourceDocsGenerator();
}
