import fs from 'node:fs';
import path from 'node:path';

import { getPackageRoot, readManifest } from './manifest';
import type { PermissionLevel } from './types';

export type SkillMetadata = {
  name: string;
  title: string;
  description: string;
  script: string;
  permission: PermissionLevel;
  requiresApproval: boolean;
  artifactTypes?: string[];
  capabilities?: string[];
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

export function validateBundledSkills(): SkillValidationIssue[] {
  const manifestByName = new Map(readManifest().map((entry) => [entry.name, entry]));
  const issues: SkillValidationIssue[] = [];

  for (const skill of listBundledSkills()) {
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
