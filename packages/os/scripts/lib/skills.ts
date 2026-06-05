import fs from 'node:fs';
import path from 'node:path';

import { getPackageRoot, readManifest } from './manifest';
import type { PermissionLevel } from './types';

type GuidanceSkillLoad = {
  type: 'resource';
  path: string;
};

export type SkillMetadata = {
  name: string;
  title: string;
  description: string;
  trigger?: string;
  status?: string;
  script?: string;
  entrypoint?: string;
  load?: GuidanceSkillLoad;
  permission: PermissionLevel;
  requiresApproval: boolean;
  artifactTypes?: string[];
  capabilities?: string[];
  tools?: string[];
};

export type SkillValidationIssue = {
  skill: string;
  code: string;
  message: string;
};

function readSkillMetadata(filePath: string): SkillMetadata {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as SkillMetadata;
}

export function getSkillsRoot(): string {
  return path.join(getPackageRoot(), 'skills');
}

export function listBundledSkills(): SkillMetadata[] {
  const skillsRoot = getSkillsRoot();
  if (!fs.existsSync(skillsRoot)) return [];
  return fs.readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(skillsRoot, entry.name, 'skill.json'))
    .filter((filePath) => fs.existsSync(filePath))
    .map(readSkillMetadata);
}

function validateGuidanceSkill(skill: SkillMetadata): SkillValidationIssue[] {
  const issues: SkillValidationIssue[] = [];
  const entrypoint = skill.entrypoint ?? 'SKILL.md';
  const loadPath = skill.load?.path ?? path.join('packages/os/skills', skill.name, entrypoint);
  const markdownPath = path.isAbsolute(loadPath) ? loadPath : path.join(getPackageRoot(), '..', '..', loadPath);

  if (!fs.existsSync(markdownPath)) {
    issues.push({ skill: skill.name, code: 'GUIDANCE_ENTRYPOINT_MISSING', message: 'guidance skill entrypoint does not exist' });
    return issues;
  }

  if (!skill.tools?.includes('os.get_steering') || !skill.tools.includes('os.call')) {
    issues.push({ skill: skill.name, code: 'GUIDANCE_TOOLS_MISSING', message: 'guidance skill must declare canonical OS tools' });
  }

  return issues;
}

export function validateBundledSkills(): SkillValidationIssue[] {
  const manifestByName = new Map(readManifest().map((entry) => [entry.name, entry]));
  const issues: SkillValidationIssue[] = [];

  for (const skill of listBundledSkills()) {
    if (skill.permission === 'guidance') {
      issues.push(...validateGuidanceSkill(skill));
      continue;
    }

    const manifestEntry = manifestByName.get(skill.name);
    if (!manifestEntry) {
      issues.push({ skill: skill.name, code: 'SKILL_NOT_IN_MANIFEST', message: 'skill metadata has no manifest entry' });
      continue;
    }
    if (skill.script !== manifestEntry.implementation.script) {
      issues.push({ skill: skill.name, code: 'SCRIPT_MISMATCH', message: 'skill script does not match manifest implementation' });
    }
    if (skill.permission !== manifestEntry.permission) {
      issues.push({ skill: skill.name, code: 'PERMISSION_MISMATCH', message: 'skill permission does not match manifest' });
    }
    if (skill.requiresApproval !== manifestEntry.requiresApproval) {
      issues.push({ skill: skill.name, code: 'APPROVAL_MISMATCH', message: 'skill approval rule does not match manifest' });
    }
  }

  return issues;
}
