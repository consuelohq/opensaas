import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let tempHome: string;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'office-skill-'));
});

afterEach(() => {
  rmSync(tempHome, { recursive: true, force: true });
});

function runBunEval(code: string): string {
  return execFileSync('bun', ['-e', code], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CONSUELO_HOME: tempHome,
    },
    encoding: 'utf8',
  });
}

describe('office-landing-page skill', () => {
  it('creates a draft artifact from the existing Office website workflow', () => {
    const result = JSON.parse(runBunEval(`
      const { executeCall } = await import('./scripts/os.ts');
      const result = await executeCall({
        name: 'office-landing-page',
        traceId: 'trc_office_landing_page_test_' + Date.now() + '_' + process.pid,
        workspaceId: 'workspace-id',
        userId: 'user-id',
        input: {
          artifactTitle: 'Insurance Revenue Landing Page',
          campaign: {
            audience: 'independent insurance agencies',
            offer: 'Book more qualified calls',
            objective: 'landing page draft',
            proofPoints: ['faster follow-up', 'agent-ready workspace']
          },
          sourceContext: { notes: 'Use OS-first language.' }
        },
      });
      process.stdout.write(JSON.stringify(result));
    `));

    expect(result.ok).toBe(true);
    expect(result.permission).toBe('draft');
    expect(result.requiresApproval).toBe(false);
    expect(result.result).toMatchObject({
      workflow: 'website',
      designSystem: 'consuelo',
      primaryDesignSkill: 'saas-landing',
    });
    expect(result.artifacts).toHaveLength(1);

    const artifact = result.artifacts[0];
    expect(artifact).toMatchObject({
      name: 'insurance-revenue-landing-page.json',
      title: 'Insurance Revenue Landing Page',
      type: 'draft',
      format: 'json',
      storageMode: 'local',
      traceId: result.traceId,
      skillName: 'office-landing-page',
    });
    expect(existsSync(artifact.localPath)).toBe(true);

    const artifactBody = JSON.parse(readFileSync(artifact.localPath, 'utf8')) as {
      result: { primaryDesignSkill: string };
      designPlan: { project: { metadata: { fallbackSkillIds: string[] } } };
    };
    expect(artifactBody.result.primaryDesignSkill).toBe('saas-landing');
    expect(artifactBody.designPlan.project.metadata.fallbackSkillIds).toEqual([
      'web-prototype',
      'web-prototype-taste-editorial',
    ]);
  });

  it('requires approval before publishing or replacing customer-facing pages', () => {
    const result = JSON.parse(runBunEval(`
      const { executeCall } = await import('./scripts/os.ts');
      const result = await executeCall({
        name: 'office-landing-page',
        traceId: 'trc_design_publish_gate_test',
        input: { publish: true, replaceCustomerFacingPage: true },
      });
      process.stdout.write(JSON.stringify(result));
    `));

    expect(result.ok).toBe(false);
    expect(result.requiresApproval).toBe(true);
    expect(result.error).toMatchObject({ code: 'APPROVAL_REQUIRED' });
    expect(result.proposedWrites[0]).toMatchObject({
      type: 'office-publish-request',
      approvalRequired: true,
    });
  });
});
