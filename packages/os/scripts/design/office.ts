import fs from 'node:fs';
import path from 'node:path';

import { getPackageRoot } from '../lib/manifest';
import type { CallOutput, SkillContext } from '../lib/types';

type OfficeInput = {
  subskill?: string;
  includeReferences?: boolean;
};

function readText(relativePath: string): string {
  return fs.readFileSync(path.join(getPackageRoot(), relativePath), 'utf8');
}

function readJson(relativePath: string): unknown {
  return JSON.parse(readText(relativePath)) as unknown;
}

function listSubskills(): unknown[] {
  const root = path.join(getPackageRoot(), 'skills/office/subskills');
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => readJson(`skills/office/subskills/${name}`));
}

function normalizeInput(input: unknown): OfficeInput {
  return input != null && typeof input === 'object' && !Array.isArray(input)
    ? input as OfficeInput
    : {};
}

export async function runOffice(input: unknown, context: SkillContext): Promise<CallOutput> {
  try {
    const normalizedInput = normalizeInput(input);
    const subskills = listSubskills();
    const selected = typeof normalizedInput.subskill === 'string'
      ? subskills.find((item) => item != null && typeof item === 'object' && (item as { id?: unknown }).id === normalizedInput.subskill) ?? null
      : null;
    const skillMd = readText('skills/office/SKILL.md');
    const result = {
      summary: 'Office orchestration guide loaded. Use this skill to chain workspace tools and existing design scripts; use subskills as additive presets.',
      skill: 'office',
      permission: context.manifestEntry.permission,
      selectedSubskill: selected,
      subskills,
      guide: skillMd,
      references: {
        operatorManual: 'areas/consuelo-design/AGENTS.md',
        packagedManual: 'packages/os/skills/office/references/agents.md',
        designSystem: 'packages/consuelo-website/DESIGN.md',
      },
      nextActions: [
        'Read areas/consuelo-design/AGENTS.md and packages/consuelo-website/DESIGN.md.',
        'Select the matching subskill/preset from packages/os/skills/office/subskills.',
        'Call existing office.* workspace tools and create or update source-first artifacts.',
        'Validate in browser, publish with design.publish when approved, and verify /office.',
      ],
    };
    return {
      ok: true,
      name: context.manifestEntry.name,
      permission: context.manifestEntry.permission,
      requiresApproval: context.manifestEntry.requiresApproval,
      result,
      proposedWrites: [],
    };
  } catch (error: unknown) {
    return {
      ok: false,
      name: context.manifestEntry.name,
      permission: context.manifestEntry.permission,
      requiresApproval: context.manifestEntry.requiresApproval,
      error: {
        code: 'OFFICE_GUIDE_FAILED',
        message: error instanceof Error ? error.message.slice(0, 240) : 'Could not load Office guide.',
      },
    };
  }
}
