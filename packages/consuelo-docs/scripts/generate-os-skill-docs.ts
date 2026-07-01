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
  expanded?: boolean;
  pages: BasePage[];
};

type BaseStructure = {
  tabs: Array<{
    key: string;
    label: string;
    groups?: BaseGroup[];
    pages?: BasePage[];
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

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;

const writeOrCheck = (filePath: string, content: string): void => {
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  if (checkOnly) {
    if (current !== content) {
      throw new Error(`${path.relative(repoRoot, filePath)} is stale. Run yarn docs:generate-os-skill-docs.`);
    }
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
};

const yaml = (value: string): string => JSON.stringify(value.replace(/<([^>\n]+)>/g, '($1)'));

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

const normalizePlaceholderText = (line: string): string => line.replace(/<([^>\n]+)>/g, '($1)');

const mdxSafeMarkdown = (body: string): string => {
  const output: string[] = [];
  let inFence = false;

  for (const line of stripFrontmatter(body).trimEnd().split('\n').map(normalizePlaceholderText)) {
    if (line.trim().startsWith('```')) {
      inFence = !inFence;
      output.push(line);
      continue;
    }

    output.push(inFence ? line : line.replace(/\{/g, '\\{').replace(/\}/g, '\\}').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
  }

  return output.join('\n');
};

const skillPage = (skill: SkillJson, body: string): string => [
  '---',
  `title: ${yaml(skill.title)}`,
  `description: ${yaml(skill.description)}`,
  '---',
  '',
  generatedNotice,
  '',
  mdxSafeMarkdown(body),
  '',
].join('\n');

const plannedSkillPage = (slug: string, title: string): string => [
  '---',
  `title: ${yaml(title)}`,
  `description: ${yaml(`${title} is a planned Consuelo OS skill.`)}`,
  '---',
  '',
  `# ${title}`,
  '',
  `${title} is a planned Consuelo OS skill. Keep this page as a placeholder until the skill is available for install.`,
  '',
].join('\n');

const loadSkills = (): SkillJson[] =>
  fs
    .readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readJson<SkillJson>(path.join(skillsRoot, entry.name, 'skill.json')))
    .filter((skill) => skill.status !== 'inactive')
    .sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }));

const syncSkillDocs = (skills: SkillJson[]): void => {
  for (const skill of skills) {
    const skillBodyPath = path.join(skillsRoot, skill.name, skill.entrypoint ?? 'SKILL.md');
    const body = fs.readFileSync(skillBodyPath, 'utf8');
    writeOrCheck(path.join(skillDocsRoot, `${skill.name}.mdx`), skillPage(skill, body));
  }

  for (const [slug, title] of plannedSkills) {
    writeOrCheck(path.join(skillDocsRoot, 'planned', `${slug}.mdx`), plannedSkillPage(slug, title));
  }
};

const skillPages = (skills: SkillJson[]): Array<string | BaseGroup> => [
  ...skills.map((skill) => `os/skills/${skill.name}`),
  {
    key: 'osPlannedSkills',
    label: 'Planned Skills',
    expanded: false,
    pages: plannedSkills.map(([slug]) => `os/skills/planned/${slug}`),
  },
];


const findGroupByKey = (groups: BaseGroup[], key: string): BaseGroup | null => {
  for (const group of groups) {
    if (group.key === key) return group;
    const nestedGroups = group.pages.filter((page): page is BaseGroup => typeof page !== 'string');
    const nestedMatch = findGroupByKey(nestedGroups, key);
    if (nestedMatch) return nestedMatch;
  }
  return null;
};

const osGroups = (structure: BaseStructure): BaseGroup[] => {
  const topLevelOsTab = structure.tabs.find((tab) => tab.key === 'os');
  if (topLevelOsTab?.groups) return topLevelOsTab.groups;

  const userGuide = structure.tabs.find((tab) => tab.key === 'userGuide');
  const userGuideGroups = [
    ...(userGuide?.groups ?? []),
    ...((userGuide?.pages ?? []).filter((page): page is BaseGroup => typeof page !== 'string')),
  ];
  const osGroup = findGroupByKey(userGuideGroups, 'osDocumentation') ?? findGroupByKey(userGuideGroups, 'usingConsueloOs');
  if (osGroup) return osGroup.pages.filter((page): page is BaseGroup => typeof page !== 'string');

  throw new Error('navigation/base-structure.json is missing OS navigation groups.');
};

const syncNavigation = (skills: SkillJson[]): void => {
  const structure = readJson<BaseStructure>(baseStructurePath);
  const skillsGroup = findGroupByKey(
    structure.tabs.flatMap((tab) => [
      ...(tab.groups ?? []),
      ...((tab.pages ?? []).filter((page): page is BaseGroup => typeof page !== 'string')),
    ]),
    'osSkills',
  );
  if (!skillsGroup) {
    throw new Error('navigation/base-structure.json is missing osSkills.');
  }
  skillsGroup.label = 'Skills';
  skillsGroup.pages = skillPages(skills);
  writeOrCheck(baseStructurePath, `${JSON.stringify(structure, null, 2)}\n`);

  const template = readJson<NavigationTemplate>(templatePath);
  const templateOsGroups = template.tabs?.os?.groups;
  if (templateOsGroups) {
    delete templateOsGroups.osRunbooks;
    if (!templateOsGroups.osSkills) {
      templateOsGroups.osSkills = { label: 'Skills' };
    }
    templateOsGroups.osSkills.label = 'Skills';
  }
  writeOrCheck(templatePath, `${JSON.stringify(template, null, 2)}\n`);
};


const skills = loadSkills();
syncSkillDocs(skills);
syncNavigation(skills);

process.stdout.write(`${checkOnly ? 'checked' : 'generated'} ${skills.length} skill docs\n`);
