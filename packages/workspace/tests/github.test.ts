import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function scriptPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'github.js');
}

function runGithub(args: string[]) {
  const result = spawnSync('bun', [scriptPath(), ...args], { encoding: 'utf8' });
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout) as { ok: boolean; operation: string; command: string[]; fields?: string[]; dryRun: boolean; reason?: string };
}

describe('github typed facade script', () => {
  it('expands pr.view review preset into a gh command', () => {
    const result = runGithub(['pr.view', '--pr', '436', '--preset', 'review', '--dry-run']);
    expect(result.ok).toBe(true);
    expect(result.operation).toBe('pr.view');
    expect(result.dryRun).toBe(true);
    expect(result.command).toEqual([
      'gh',
      'pr',
      'view',
      '436',
      '--repo',
      'consuelohq/opensaas',
      '--json',
      'number,title,url,headRefName,baseRefName,state,mergeStateStatus,reviewDecision,latestReviews,statusCheckRollup,headRefOid',
    ]);
    expect(result.fields).toContain('statusCheckRollup');
  });

  it('supports branch.compare with explicit base and head refs', () => {
    const result = runGithub(['branch.compare', '--base', 'main', '--head', 'stream/workspace-agents', '--dry-run']);
    expect(result.ok).toBe(true);
    expect(result.operation).toBe('branch.compare');
    expect(result.command).toEqual([
      'gh',
      'api',
      'repos/consuelohq/opensaas/compare/main...stream%2Fworkspace-agents',
    ]);
  });

  it('requires a reason for the raw escape hatch', () => {
    const result = spawnSync('bun', [scriptPath(), 'raw', '--raw-arg', 'pr', '--dry-run'], { encoding: 'utf8' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('requires --reason');
  });
});
