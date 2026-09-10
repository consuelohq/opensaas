import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const packageRoot = resolve(import.meta.dirname, '..');

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(resolve(packageRoot, relativePath), 'utf8')) as T;
}

describe('artifacts skill', () => {
  it('routes the active guidance skill to the canonical CLI and typed tool family', () => {
    const metadata = readJson<{
      name: string;
      load: { type: string; path: string };
      script: string;
      status: string;
    }>('skills/artifacts/skill.json');
    const registry = readJson<{
      skills: Array<{ name: string; status: string; load: { path: string } }>;
    }>('skills/skills.json');
    const manifest = readJson<{
      tools: Array<{ name: string; kind: string }>;
    }>('manifests/generated/tool.manifest.json');
    const landingPage = readJson<{
      id: string;
      workflow: string;
      defaultTool: string;
      primaryOpenDesignSkill: string;
    }>('skills/artifacts/subskills/landing-page.json');
    const guide = readFileSync(resolve(packageRoot, 'skills/artifacts/SKILL.md'), 'utf8');

    expect(metadata).toMatchObject({
      name: 'artifacts',
      load: { type: 'resource', path: 'packages/os/skills/artifacts/SKILL.md' },
      script: 'scripts/artifacts.ts',
      status: 'active',
    });
    expect(registry.skills.find((skill) => skill.name === metadata.name)).toMatchObject({
      status: 'active',
      load: { path: 'packages/os/skills/artifacts/SKILL.md' },
    });
    expect(manifest.tools.some((tool) => tool.name === metadata.name)).toBe(false);
    expect(manifest.tools.map((tool) => tool.name)).toEqual(expect.arrayContaining([
      'artifacts.publish',
      'artifacts.generateWebsite',
      'artifacts.refresh',
    ]));
    expect(
      manifest.tools
        .filter((tool) => tool.name.startsWith('artifacts.'))
        .every((tool) => tool.kind === 'facade-tool'),
    ).toBe(true);
    expect(landingPage).toMatchObject({
      id: 'landing-page',
      workflow: 'website',
      defaultTool: 'artifacts.generateWebsite',
      primaryOpenDesignSkill: 'saas-landing',
    });
    expect(guide).toContain('Use `bun run artifacts` and `artifacts.*` tools.');
    expect(guide).not.toContain('executeCall');

    const cli = spawnSync('bun', ['./scripts/artifacts.ts', 'help'], {
      cwd: packageRoot,
      encoding: 'utf8',
    });
    expect(cli.status, cli.stderr).toBe(0);
    expect(cli.stdout).toContain(
      'Canonical Consuelo artifact generation, publishing, catalog, and history CLI.',
    );
    expect(cli.stdout).toContain('generate-website');
  });
});
