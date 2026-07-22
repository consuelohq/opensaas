import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

function scriptPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'github.js');
}

function runGithub(args: string[]) {
  const result = spawnSync('bun', [scriptPath(), ...args], { encoding: 'utf8' });
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout) as { ok: boolean; operation: string; command: string[]; fields?: string[]; dryRun: boolean; reason?: string };
}

type GithubOutput = {
  ok: boolean;
  operation: string;
  command: string[];
  dryRun: boolean;
  summary?: Record<string, unknown>;
  packet?: {
    raw?: Record<string, unknown>;
    details?: Record<string, { total?: number; truncated?: boolean; omitted?: number }>;
  };
  data?: unknown;
  stdout?: unknown;
};

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

  it('builds bounded packets for large pr.view review payloads', () => {
    const { createGithubOutput } = require('../scripts/github.js') as {
      createGithubOutput: (
        operation: string,
        args: Record<string, unknown>,
        commandResult: { command: string[]; stdout: string; data: unknown },
        extra?: Record<string, unknown>,
      ) => GithubOutput;
    };

    const checks = Array.from({ length: 180 }, (_, index) => ({
      bucket: index % 5 === 0 ? 'fail' : 'pass',
      completedAt: '2026-06-14T15:09:03Z',
      conclusion: index % 5 === 0 ? 'FAILURE' : 'SUCCESS',
      description: `check ${index} `.repeat(80),
      link: `https://example.com/checks/${index}`,
      name: `workspace check ${index}`,
      startedAt: '2026-06-14T15:08:03Z',
      state: index % 5 === 0 ? 'FAILURE' : 'SUCCESS',
      workflow: 'verify',
    }));
    const latestReviews = Array.from({ length: 75 }, (_, index) => ({
      id: index,
      author: { login: `reviewer-${index}` },
      body: `review body ${index} `.repeat(100),
      state: index % 2 === 0 ? 'COMMENTED' : 'APPROVED',
      submittedAt: '2026-06-14T15:09:03Z',
    }));
    const files = Array.from({ length: 240 }, (_, index) => ({
      path: `packages/workspace/generated-file-${index}.ts`,
      filename: `packages/workspace/generated-file-${index}.ts`,
      additions: index + 1,
      deletions: index % 3,
      changes: index + 4,
      patch: `+${'x'.repeat(1000)}`,
      status: 'modified',
    }));
    const data = {
      number: 1041,
      title: 'bound github tool response packets',
      url: 'https://github.com/consuelohq/opensaas/pull/1041',
      headRefName: 'task/workspace-agents/bound-github-tool-response-packets',
      baseRefName: 'stream/workspace-agents',
      state: 'OPEN',
      mergeStateStatus: 'CLEAN',
      reviewDecision: 'CHANGES_REQUESTED',
      latestReviews,
      statusCheckRollup: checks,
      headRefOid: 'abc123',
      files,
      author: { login: 'kokayicobb' },
    };

    const result = createGithubOutput(
      'pr.view',
      { operation: 'pr.view', repo: 'consuelohq/opensaas', dryRun: false },
      { command: ['gh', 'pr', 'view', '1041'], stdout: JSON.stringify(data), data },
      { fields: ['number', 'title', 'statusCheckRollup', 'latestReviews', 'files'] },
    );

    const serialized = JSON.stringify(result);
    expect(serialized.length).toBeLessThan(30000);
    expect(result).not.toHaveProperty('data');
    expect(result).not.toHaveProperty('stdout');
    expect(result.summary).not.toHaveProperty('raw');
    expect(result.packet?.raw?.dataOmitted).toBe(true);
    expect(result.packet?.raw?.stdoutOmitted).toBe(true);
    expect(result.packet?.details?.checks?.total).toBe(180);
    expect(result.packet?.details?.checks?.truncated).toBe(true);
    expect(result.packet?.details?.reviews?.total).toBe(75);
    expect(result.packet?.details?.files?.total).toBe(240);
    expect(result.packet?.details?.files?.omitted).toBeGreaterThan(0);
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
