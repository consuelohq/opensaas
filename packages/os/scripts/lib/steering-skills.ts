import fs from 'node:fs';
import path from 'node:path';

import { readManifestOverlay } from './manifest-overlay';

type JsonRecord = Record<string, unknown>;

export type SteeringSkillMetadata = {
  name: string;
  title?: string;
  description?: string;
  trigger?: string;
  entrypoint?: string;
  load?: { type: string; path: string };
  permission?: string;
  requiresApproval?: boolean;
  status?: string;
  capabilities?: string[];
  tools?: string[];
  subskills?: string[];
};

export type SteeringSkillCatalog = {
  source: 'installed-selected' | 'legacy-installed' | 'bundled' | 'invalid-installed';
  skills: SteeringSkillMetadata[];
  truncated: number;
};

const MAX_STEERING_SKILLS = 64;
const MAX_SHORT_TEXT = 240;
const MAX_LONG_TEXT = 1_200;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function boundedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  return normalized.slice(0, maxLength);
}

function boundedStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 32);
  return items.length > 0 ? items : undefined;
}

function compactSkill(value: unknown): SteeringSkillMetadata | null {
  if (!isRecord(value)) return null;
  const name = boundedString(value.name ?? value.id, MAX_SHORT_TEXT);
  if (!name) return null;

  const loadValue = isRecord(value.load) ? value.load : null;
  const loadType = loadValue ? boundedString(loadValue.type, MAX_SHORT_TEXT) : undefined;
  const loadPath = loadValue ? boundedString(loadValue.path, MAX_LONG_TEXT) : undefined;
  const metadata: SteeringSkillMetadata = { name };

  const title = boundedString(value.title, MAX_SHORT_TEXT);
  const description = boundedString(value.description, MAX_LONG_TEXT);
  const trigger = boundedString(value.trigger, MAX_LONG_TEXT);
  const entrypoint = boundedString(value.entrypoint, MAX_LONG_TEXT);
  const permission = boundedString(value.permission, MAX_SHORT_TEXT);
  const status = boundedString(value.status, MAX_SHORT_TEXT);
  const capabilities = boundedStringArray(value.capabilities);
  const tools = boundedStringArray(value.tools);
  const subskills = boundedStringArray(value.subskills);

  if (title) metadata.title = title;
  if (description) metadata.description = description;
  if (trigger) metadata.trigger = trigger;
  if (entrypoint) metadata.entrypoint = entrypoint;
  if (loadType && loadPath) metadata.load = { type: loadType, path: loadPath };
  if (permission) metadata.permission = permission;
  if (typeof value.requiresApproval === 'boolean') metadata.requiresApproval = value.requiresApproval;
  if (status) metadata.status = status;
  if (capabilities) metadata.capabilities = capabilities;
  if (tools) metadata.tools = tools;
  if (subskills) metadata.subskills = subskills;

  return metadata;
}

function compactSkills(
  values: unknown[],
  disabledSkills: ReadonlySet<string>,
): { skills: SteeringSkillMetadata[]; truncated: number } {
  const deduped = new Map<string, SteeringSkillMetadata>();
  for (const skill of values
    .map(compactSkill)
    .filter((skill): skill is SteeringSkillMetadata => Boolean(skill))
    .filter((skill) => !disabledSkills.has(skill.name))) {
    if (!deduped.has(skill.name)) deduped.set(skill.name, skill);
  }
  const all = [...deduped.values()].sort((left, right) => left.name.localeCompare(right.name));
  return {
    skills: all.slice(0, MAX_STEERING_SKILLS),
    truncated: Math.max(0, all.length - MAX_STEERING_SKILLS),
  };
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
}

function readCustomSkillMetadata(home: string, value: unknown): unknown {
  if (!isRecord(value)) return value;
  const legacyPath = boundedString(value.legacyPath, MAX_LONG_TEXT);
  if (!legacyPath) return value;

  const resolvedHome = path.resolve(home);
  const customDir = path.resolve(resolvedHome, legacyPath);
  const relative = path.relative(resolvedHome, customDir);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return value;

  try {
    return readJson(path.join(customDir, 'skill.json'));
  } catch {
    return value;
  }
}

export function readSteeringSkillCatalog(input: {
  home: string;
  packageRoot: string;
}): SteeringSkillCatalog {
  const disabledSkills = new Set(readManifestOverlay(input.home).disabledSkills);
  const installedPath = path.join(input.home, 'components', 'installed-skills.json');
  if (fs.existsSync(installedPath)) {
    try {
      const value = readJson(installedPath);
      if (!isRecord(value) || !Array.isArray(value.selected)) {
        return { source: 'invalid-installed', skills: [], truncated: 0 };
      }
      const custom = Array.isArray(value.legacyCustom)
        ? value.legacyCustom.map((skill) => readCustomSkillMetadata(input.home, skill))
        : [];
      const compacted = compactSkills([...value.selected, ...custom], disabledSkills);
      return { source: 'installed-selected', ...compacted };
    } catch {
      return { source: 'invalid-installed', skills: [], truncated: 0 };
    }
  }

  const legacyPath = path.join(input.home, 'skills', 'skills.json');
  if (fs.existsSync(legacyPath)) {
    try {
      const value = readJson(legacyPath);
      if (isRecord(value) && Array.isArray(value.skills)) {
        const compacted = compactSkills(value.skills, disabledSkills);
        return { source: 'legacy-installed', ...compacted };
      }
    } catch {
      // Older installs may have a corrupt legacy registry. Source/dev fallback remains safe
      // because no current selected-skill index exists in this branch of the read path.
    }
  }

  const bundledPath = path.join(input.packageRoot, 'skills', 'skills.json');
  try {
    const value = readJson(bundledPath);
    if (isRecord(value) && Array.isArray(value.skills)) {
      const compacted = compactSkills(value.skills, disabledSkills);
      return { source: 'bundled', ...compacted };
    }
  } catch {
    // Steering must stay available even if optional skill discovery metadata is unavailable.
  }

  return { source: 'bundled', skills: [], truncated: 0 };
}
