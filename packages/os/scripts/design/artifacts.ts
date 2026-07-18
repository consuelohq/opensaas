import fs from 'node:fs';
import path from 'node:path';

import { getPackageRoot } from '../lib/manifest';
import type { CallOutput, SkillContext } from '../lib/types';

type ArtifactsInput = {
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
  const root = path.join(getPackageRoot(), 'skills/artifacts/subskills');
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => readJson(`skills/artifacts/subskills/${name}`));
}

function normalizeInput(input: unknown): ArtifactsInput {
  return input != null && typeof input === 'object' && !Array.isArray(input)
    ? input as ArtifactsInput
    : {};
}

export async function runArtifacts(input: unknown, context: SkillContext): Promise<CallOutput> {
  try {
    const normalizedInput = normalizeInput(input);
    const subskills = listSubskills();
    const selected = typeof normalizedInput.subskill === 'string'
      ? subskills.find((item) => item != null && typeof item === 'object' && (item as { id?: unknown }).id === normalizedInput.subskill) ?? null
      : null;
    const skillMd = readText('skills/artifacts/SKILL.md');
    const result = {
      summary: 'Artifacts orchestration guide loaded. Use this skill to chain OS tools and existing design scripts; use subskills as additive presets.',
      skill: 'artifacts',
      permission: context.manifestEntry.permission,
      selectedSubskill: selected,
      subskills,
      guide: skillMd,
      references: {
        operatorManual: 'areas/consuelo-design/AGENTS.md',
        packagedManual: 'packages/os/skills/artifacts/references/agents.md',
        designSystem: 'packages/consuelo-website/DESIGN.md',
      },
      nextActions: [
        'Read areas/consuelo-design/AGENTS.md and packages/consuelo-website/DESIGN.md.',
        'Select the matching subskill/preset from packages/os/skills/artifacts/subskills.',
        'Call existing artifacts.* OS tools and create or update source-first outputs.',
        'Validate in browser, publish with artifacts.publish when approved, and verify /artifacts.',
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
        code: 'ARTIFACTS_GUIDE_FAILED',
        message: error instanceof Error ? error.message.slice(0, 240) : 'Could not load Artifacts guide.',
      },
    };
  }
}
