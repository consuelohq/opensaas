import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function runBunEval(code: string): string {
  return execFileSync('bun', ['-e', code], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CONSUELO_HOME: '/tmp/consuelo-design-skill-test-home',
    },
    encoding: 'utf8',
  });
}

describe('consuelo-design skill', () => {
  it('loads the orchestration guide and subskill presets', () => {
    const result = JSON.parse(runBunEval(`
      const { executeCall } = await import('./scripts/os.ts');
      const result = await executeCall({
        name: 'consuelo-design',
        traceId: 'trc_consuelo_design_guide_test',
        input: { subskill: 'landing-page' },
      });
      process.stdout.write(JSON.stringify(result));
    `));

    expect(result.ok).toBe(true);
    expect(result.name).toBe('consuelo-design');
    expect(result.permission).toBe('draft');
    expect(result.result).toMatchObject({
      skill: 'consuelo-design',
      selectedSubskill: {
        id: 'landing-page',
        workflow: 'website',
        defaultTool: 'consueloDesign.generateWebsite',
        primaryOpenDesignSkill: 'saas-landing',
      },
      references: {
        operatorManual: 'areas/consuelo-design/AGENTS.md',
        designSystem: 'packages/consuelo-website/DESIGN.md',
      },
    });
    expect(result.result.subskills.map((subskill: { id: string }) => subskill.id)).toContain('spec');
    expect(result.result.guide).toContain('source-first');
  });
});
