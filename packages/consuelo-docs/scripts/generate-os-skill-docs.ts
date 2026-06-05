import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type SkillJson = {
  name: string;
  title: string;
  description: string;
  entrypoint?: string;
  status?: string;
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
const skillsRoot = path.join(repoRoot, 'packages', 'os', 'skills');
const skillDocsRoot = path.join(docsRoot, 'os', 'skills');
const baseStructurePath = path.join(docsRoot, 'navigation', 'base-structure.json');
const templatePath = path.join(docsRoot, 'navigation', 'navigation.template.json');

const plannedSkills = [
  ['campaign-brief', 'Campaign Brief'],
  ['daily-revenue-brief', 'Daily Revenue Brief'],
  ['follow-up-generator', 'Follow-Up Generator'],
  ['google-ads-review', 'Google Ads Review'],
  ['landing-page-builder', 'Landing Page Builder'],
  ['lead-prioritizer', 'Lead Prioritizer'],
  ['meta-ads-review', 'Meta Ads Review'],
  ['post-call-analysis', 'Post-Call Analysis'],
  ['sales-coaching', 'Sales Coaching'],
  ['weekly-manager-report', 'Weekly Manager Report'],
] as const;

const generatedNotice = '{/* Generated from packages/os/skills. Do not edit this page directly. */}';
const localizedFallbackLanguages = ['fr', 'ar', 'cs', 'de', 'es', 'it', 'ja', 'ko', 'pt', 'ro', 'ru', 'tr', 'zh'] as const;

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;

const writeOrCheck = (filePath: string, content: string): void => {
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  if (checkOnly) {
    if (current !== content) {
      throw new Error(`${path.relative(repoRoot, filePath)} is stale. Run bun run generate-os-skill-docs.`);
    }
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
};

const yaml = (value: string): string => JSON.stringify(value);

const docsSafePlaceholderText = (value: string): string => value.replace(/<([A-Za-z0-9_.:-]+)>/g, '{$1}');
const frontmatterSafePlaceholderText = (value: string): string => value.replace(/<([A-Za-z0-9_.:-]+)>/g, '($1)');

const stripFrontmatter = (markdown: string): string => {
  if (!markdown.startsWith('---\n')) {
    return markdown.trimStart();
  }

  const end = markdown.indexOf('\n---', 4);
  if (end === -1) {
    return markdown.trimStart();
  }

  return markdown.slice(end + '\n---'.length).trimStart();
};

const markdownFence = (body: string): string => {
  const longestFence = Math.max(3, ...Array.from(body.matchAll(/`+/g), (match) => match[0].length));
  return '`'.repeat(longestFence + 1);
};

const skillPage = (skill: SkillJson, body: string): string => {
  const skillBody = docsSafePlaceholderText(stripFrontmatter(body).trimEnd());
  const fence = markdownFence(skillBody);

  return [
    '---',
    `title: ${yaml(skill.title)}`,
    `description: ${yaml(frontmatterSafePlaceholderText(skill.description))}`,
    '---',
    '',
    generatedNotice,
    '',
    '## Skill body',
    '',
    `${fence}md`,
    skillBody,
    fence,
    '',
  ].join('\n');
};

const metadataSkillPage = (skill: SkillJson): string => {
  const skillPath = path.join(skillsRoot, skill.name, 'skill.json');
  const metadata = readJson<Record<string, unknown>>(skillPath);
  const trigger = frontmatterSafePlaceholderText(typeof metadata.trigger === 'string' ? metadata.trigger : skill.description);

  return [
    '---',
    `title: ${yaml(skill.title)}`,
    `description: ${yaml(frontmatterSafePlaceholderText(skill.description))}`,
    '---',
    '',
    generatedNotice,
    '',
    `# ${skill.title}`,
    '',
    frontmatterSafePlaceholderText(skill.description),
    '',
    '## Trigger',
    '',
    trigger,
    '',
    '## Skill metadata',
    '',
    '```json',
    JSON.stringify(metadata, null, 2),
    '```',
    '',
  ].join('\n');
};

const plannedPage = (slug: string, title: string): string => [
  '---',
  `title: ${yaml(title)}`,
  `description: ${yaml(`${title} is a planned Consuelo OS skill.`)}`,
  '---',
  '',
  generatedNotice,
  '',
  `# ${title}`,
  '',
  `${title} is a planned Consuelo OS skill. This page keeps the skill visible in the docs while the bundled skill workflow is being migrated into Consuelo OS.`,
  '',
  `When the skill is added under \`packages/os/skills/${slug}\`, this generated placeholder should be replaced by the generated page from that skill's \`SKILL.md\`.`,
  '',
].join('\n');

const loadSkills = (): SkillJson[] =>
  fs
    .readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const skillJsonPath = path.join(skillsRoot, entry.name, 'skill.json');
      if (!fs.existsSync(skillJsonPath)) {
        return null;
      }

      const skill = readJson<SkillJson>(skillJsonPath);
      if (!skill.name || !skill.title || !skill.description) {
        throw new Error(`${path.relative(repoRoot, skillJsonPath)} must include name, title, and description.`);
      }
      return skill;
    })
    .filter((skill): skill is SkillJson => Boolean(skill))
    .sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }));

const generateSkillPages = (skills: SkillJson[]): string[] => {
  const pages: string[] = [];

  for (const skill of skills) {
    const bodyPath = path.join(skillsRoot, skill.name, 'SKILL.md');
    const outPath = path.join(skillDocsRoot, `${skill.name}.mdx`);
    const page = fs.existsSync(bodyPath) ? skillPage(skill, fs.readFileSync(bodyPath, 'utf8')) : metadataSkillPage(skill);
    writeOrCheck(outPath, page);
    pages.push(`os/skills/${skill.name}`);
  }

  return pages;
};

const generatePlannedPages = (actualSkillNames: Set<string>): BaseGroup | null => {
  const pages = plannedSkills
    .filter(([slug]) => !actualSkillNames.has(slug))
    .map(([slug, title]) => {
      const outPath = path.join(skillDocsRoot, 'planned', `${slug}.mdx`);
      writeOrCheck(outPath, plannedPage(slug, title));
      return `os/skills/planned/${slug}`;
    });

  if (!pages.length) {
    return null;
  }

  return {
    key: 'osPlannedSkills',
    label: 'Planned Skills',
    pages,
  };
};

const updateBaseStructure = (skillPages: string[], plannedGroup: BaseGroup | null): void => {
  const structure = readJson<BaseStructure>(baseStructurePath);
  const osTab = structure.tabs.find((tab) => tab.key === 'os');
  if (!osTab) {
    throw new Error('navigation/base-structure.json is missing the os tab.');
  }

  const groupIndex = osTab.groups.findIndex((group) => group.key === 'osRunbooks' || group.key === 'osSkills');
  if (groupIndex === -1) {
    throw new Error('OS tab is missing the runbooks/skills group.');
  }

  osTab.groups[groupIndex] = {
    key: 'osSkills',
    label: 'Skills',
    icon: 'bolt',
    pages: plannedGroup ? [...skillPages, plannedGroup] : skillPages,
  };

  writeOrCheck(baseStructurePath, `${JSON.stringify(structure, null, 2)}\n`);
};

const updateNavigationTemplate = (): void => {
  const template = readJson<NavigationTemplate>(templatePath);
  const osGroups = template.tabs?.os?.groups;
  if (!osGroups) {
    throw new Error('navigation.template.json is missing tabs.os.groups.');
  }

  delete osGroups.osRunbooks;
  osGroups.osSkills = {
    label: 'Skills',
    groups: {
      osPlannedSkills: {
        label: 'Planned Skills',
      },
    },
  };

  writeOrCheck(templatePath, `${JSON.stringify(template, null, 2)}\n`);
};

const titleFromSlug = (slug: string): string =>
  slug
    .split('/')
    .at(-1)!
    .split('-')
    .map((part) => (part.toLowerCase() === 'os' ? 'OS' : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');

const navPlaceholderPage = (slug: string): string => {
  const title = titleFromSlug(slug);

  return [
    '---',
    `title: ${yaml(title)}`,
    `description: ${yaml(`${title} is an OS documentation page that is being rebuilt.`)}`,
    '---',
    '',
    '{/* Generated from packages/consuelo-docs/navigation/base-structure.json to prevent OS docs 404s. Replace with authored docs when ready. */}',
    '',
    `# ${title}`,
    '',
    'This OS documentation page is being rebuilt from the navigation map. It exists so linked OS docs routes resolve instead of returning 404 while the authored documentation catches up.',
    '',
    'If you are updating this page, replace this generated placeholder with authored documentation and keep the path in `navigation/base-structure.json` unchanged unless you also update the nav.',
    '',
  ].join('\n');
};

const collectPageSlugs = (pages: BasePage[]): string[] =>
  pages.flatMap((page) => (typeof page === 'string' ? [page] : collectPageSlugs(page.pages)));

const ensureOsNavPages = (): void => {
  const structure = readJson<BaseStructure>(baseStructurePath);
  const osTab = structure.tabs.find((tab) => tab.key === 'os');
  if (!osTab) {
    throw new Error('navigation/base-structure.json is missing the os tab.');
  }

  const osPages = osTab.groups.flatMap((group) => collectPageSlugs(group.pages));
  for (const slug of osPages) {
    const filePath = path.join(docsRoot, `${slug}.mdx`);
    if (fs.existsSync(filePath)) {
      const current = fs.readFileSync(filePath, 'utf8');
      const generatedPlaceholder = current.includes('Generated from packages/consuelo-docs/navigation/base-structure.json');
      if (!generatedPlaceholder) {
        continue;
      }
    }
    writeOrCheck(filePath, navPlaceholderPage(slug));
  }
};

const writeLocalizedFallback = (slug: string): void => {
  const englishPath = path.join(docsRoot, `${slug}.mdx`);
  if (!fs.existsSync(englishPath)) {
    throw new Error(`${slug}.mdx must exist before locale fallbacks are generated.`);
  }

  const content = fs.readFileSync(englishPath, 'utf8');
  for (const language of localizedFallbackLanguages) {
    const localizedPath = path.join(docsRoot, 'l', language, `${slug}.mdx`);
    if (checkOnly) {
      if (!fs.existsSync(localizedPath)) {
        throw new Error(`${path.relative(repoRoot, localizedPath)} is missing. Run bun run generate-os-skill-docs.`);
      }
      continue;
    }

    if (fs.existsSync(localizedPath)) {
      const localizedContent = fs.readFileSync(localizedPath, 'utf8');
      const generatedFallback =
        localizedContent.includes('Generated from packages/os/skills') ||
        localizedContent.includes('Generated from packages/consuelo-docs/navigation/base-structure.json');
      if (!generatedFallback) {
        continue;
      }
    }

    fs.mkdirSync(path.dirname(localizedPath), { recursive: true });
    fs.writeFileSync(localizedPath, content);
  }
};

const ensureLocalizedOsNavPages = (): void => {
  const structure = readJson<BaseStructure>(baseStructurePath);
  const osTab = structure.tabs.find((tab) => tab.key === 'os');
  if (!osTab) {
    throw new Error('navigation/base-structure.json is missing the os tab.');
  }

  const osPages = osTab.groups.flatMap((group) => collectPageSlugs(group.pages));
  for (const slug of osPages) {
    writeLocalizedFallback(slug);
  }
};

const skills = loadSkills();
const skillPages = generateSkillPages(skills);
const plannedGroup = generatePlannedPages(new Set(skills.map((skill) => skill.name)));
updateBaseStructure(skillPages, plannedGroup);
updateNavigationTemplate();
ensureOsNavPages();
ensureLocalizedOsNavPages();

process.stdout.write(`${checkOnly ? 'checked' : 'generated'} ${skills.length} skill docs\n`);
