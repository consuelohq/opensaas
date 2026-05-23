import fs from 'node:fs';
import path from 'node:path';

import { getPackageRoot } from '../lib/manifest';
import type { CallOutput, SkillContext } from '../lib/types';

type ConsueloDesignInput = {
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
  const root = path.join(getPackageRoot(), 'skills/consuelo-design/subskills');
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => readJson(`skills/consuelo-design/subskills/${name}`));
}

function normalizeInput(input: unknown): ConsueloDesignInput {
  return input != null && typeof input === 'object' && !Array.isArray(input)
    ? input as ConsueloDesignInput
    : {};
}

export async function runConsueloDesign(input: unknown, context: SkillContext): Promise<CallOutput> {
  try {
    const normalizedInput = normalizeInput(input);
    const subskills = listSubskills();
    const selected = typeof normalizedInput.subskill === 'string'
      ? subskills.find((item) => item != null && typeof item === 'object' && (item as { id?: unknown }).id === normalizedInput.subskill) ?? null
      : null;
    const skillMd = readText('skills/consuelo-design/SKILL.md');
    const result = {
      summary: 'Consuelo Design orchestration guide loaded. Use this skill to chain workspace tools and existing design scripts; use subskills as additive presets.',
      skill: 'consuelo-design',
      permission: context.manifestEntry.permission,
      selectedSubskill: selected,
      subskills,
      guide: skillMd,
      references: {
        operatorManual: 'areas/consuelo-design/AGENTS.md',
        packagedManual: 'packages/os/skills/consuelo-design/references/agents.md',
        designSystem: 'packages/consuelo-website/DESIGN.md',
      },
      nextActions: [
        'Read areas/consuelo-design/AGENTS.md and packages/consuelo-website/DESIGN.md.',
        'Select the matching subskill/preset from packages/os/skills/consuelo-design/subskills.',
        'Call existing consueloDesign.* workspace tools and create or update source-first artifacts.',
        'Validate in browser, publish with design.publish when approved, and verify /design-wiki.',
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
        code: 'CONSUELO_DESIGN_GUIDE_FAILED',
        message: error instanceof Error ? error.message.slice(0, 240) : 'Could not load Consuelo Design guide.',
      },
    };
  }
}
