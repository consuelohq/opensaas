import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(currentDir, '..');
const DEFAULT_SKILLS_ROOT = path.join(packageRoot, 'skills');
const DEFAULT_OUTPUT_PATH = path.join(DEFAULT_SKILLS_ROOT, 'skills.json');

const REQUIRED_FIELDS = [
  'name',
  'title',
  'description',
  'trigger',
  'entrypoint',
  'load',
  'status',
] as const;

const COMPACT_FIELDS = [
  'name',
  'title',
  'description',
  'trigger',
  'entrypoint',
  'load',
  'permission',
  'requiresApproval',
  'status',
  'capabilities',
  'tools',
  'subskills',
] as const;

type RequiredField = (typeof REQUIRED_FIELDS)[number];
type CompactField = (typeof COMPACT_FIELDS)[number];

type JsonObject = Record<string, unknown>;

type SkillsRegistry = {
  version: 1;
  skills: JsonObject[];
};

export type GenerateSkillsRegistryOptions = {
  skillsRoot?: string;
  outputPath?: string;
  write?: boolean;
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, field: string, skillName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${skillName}: ${field} must be a non-empty string`);
  }

  return value;
}

function readJsonObject(filePath: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isObject(parsed)) {
    throw new Error(`${filePath}: expected JSON object`);
  }

  return parsed;
}

function relativeToRepo(filePath: string): string {
  return path.relative(path.join(packageRoot, '..', '..'), filePath).split(path.sep).join('/');
}

function resolveLoadPath(loadPath: string, skillDir: string): string {
  if (path.isAbsolute(loadPath)) return loadPath;

  const repoRoot = path.join(packageRoot, '..', '..');
  const repoRelative = path.join(repoRoot, loadPath);
  if (fs.existsSync(repoRelative)) return repoRelative;

  return path.join(skillDir, loadPath);
}

function validateSkillMetadata(skill: JsonObject, skillDir: string): void {
  const skillName = typeof skill.name === 'string' ? skill.name : path.basename(skillDir);

  for (const field of REQUIRED_FIELDS) {
    if (!(field in skill)) {
      throw new Error(`${skillName}: missing required field ${field}`);
    }
  }

  for (const field of REQUIRED_FIELDS.filter((field): field is Exclude<RequiredField, 'load'> => field !== 'load')) {
    assertString(skill[field], field, skillName);
  }

  if (!isObject(skill.load)) {
    throw new Error(`${skillName}: load must be an object`);
  }

  const entrypoint = assertString(skill.entrypoint, 'entrypoint', skillName);
  const entrypointPath = path.join(skillDir, entrypoint);
  if (!fs.existsSync(entrypointPath)) {
    throw new Error(`${skillName}: entrypoint does not exist: ${entrypoint}`);
  }

  const loadPath = assertString(skill.load.path, 'load.path', skillName);
  const resolvedLoadPath = resolveLoadPath(loadPath, skillDir);
  if (!fs.existsSync(resolvedLoadPath)) {
    throw new Error(`${skillName}: load.path does not exist: ${loadPath}`);
  }
}

function compactSkillMetadata(skill: JsonObject): JsonObject {
  const compact: JsonObject = {};

  for (const field of COMPACT_FIELDS) {
    if (field in skill) {
      compact[field] = skill[field as CompactField];
    }
  }

  return compact;
}

export function buildSkillsRegistry(options: GenerateSkillsRegistryOptions = {}): SkillsRegistry {
  const skillsRoot = options.skillsRoot ?? DEFAULT_SKILLS_ROOT;
  const skillDirs = fs.readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(skillsRoot, entry.name))
    .filter((skillDir) => fs.existsSync(path.join(skillDir, 'skill.json')));

  const skills = skillDirs.map((skillDir) => {
    const skill = readJsonObject(path.join(skillDir, 'skill.json'));
    validateSkillMetadata(skill, skillDir);
    return compactSkillMetadata(skill);
  }).sort((left, right) => String(left.name).localeCompare(String(right.name)));

  return { version: 1, skills };
}

export function generateSkillsRegistry(options: GenerateSkillsRegistryOptions = {}): SkillsRegistry {
  const outputPath = options.outputPath ?? DEFAULT_OUTPUT_PATH;
  const registry = buildSkillsRegistry(options);

  if (options.write ?? true) {
    fs.writeFileSync(outputPath, `${JSON.stringify(registry, null, 2)}\n`);
  }

  return registry;
}

if (import.meta.main) {
  try {
    const registry = generateSkillsRegistry();
    process.stdout.write(`wrote ${relativeToRepo(DEFAULT_OUTPUT_PATH)} (${registry.skills.length} skills)\n`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}
