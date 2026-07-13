import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const packageRoot = join(import.meta.dirname, '..');
const githubScript = join(packageRoot, 'scripts', 'github.js');

type GithubPacket = {
  ok: boolean;
  operation: string;
  packet?: {
    summary?: Record<string, unknown>;
    details?: Record<string, unknown>;
  };
};

function createFakeGh(): { dir: string; logFile: string } {
  const dir = mkdtempSync(join(tmpdir(), 'os-github-pr-reviews-'));
  const logFile = join(dir, 'gh.log');
  const ghPath = join(dir, 'gh');
  writeFileSync(
    ghPath,
    `#!/usr/bin/env bun
const fs = require('fs');
const logFile = process.env.FAKE_GH_LOG;
const args = process.argv.slice(2);
fs.appendFileSync(logFile, JSON.stringify(args) + '\\n');
const endpoint = args[1] || '';
function out(value) { process.stdout.write(JSON.stringify(value)); }
if (args[0] === 'pr' && args[1] === 'view') {
  out({
    number: 1,
    title: 'OS review collector PR',
    headRefName: 'task/os/review-collector',
    baseRefName: 'stream/os',
    state: 'OPEN',
    files: [{ path: 'packages/os/scripts/github.js' }],
    author: { login: 'kokayicobb' },
  });
} else if (args[0] === 'api' && endpoint === 'repos/consuelohq/opensaas/pulls/1/comments') {
  out([[
    {
      id: 100,
      path: 'packages/os/scripts/github.js',
      line: 12,
      body: 'Old duplicate body',
      user: { login: 'coderabbitai[bot]' },
      created_at: '2026-07-01T00:00:00Z',
      updated_at: '2026-07-01T00:00:00Z',
    }
  ]]);
} else if (args[0] === 'api' && endpoint === 'repos/consuelohq/opensaas/issues/1/comments') {
  out([[
    {
      id: 200,
      body: 'HTTP 429 rate limit; try again later',
      user: { login: 'coderabbitai[bot]' },
      created_at: '2026-07-01T00:00:00Z',
      updated_at: '2026-07-01T00:00:00Z',
    }
  ]]);
} else if (args[0] === 'api' && endpoint === 'repos/consuelohq/opensaas/pulls/1/reviews') {
  out([[
    {
      id: 10,
      state: 'COMMENTED',
      body: 'Actionable comments posted.',
      user: { login: 'openai-codex[bot]' },
      submitted_at: '2026-07-01T00:00:00Z',
    }
  ]]);
} else if (args[0] === 'api' && endpoint === 'repos/consuelohq/opensaas/pulls/1/reviews/10/comments') {
  out([[
    {
      id: 100,
      path: 'packages/os/scripts/github.js',
      line: 12,
      body: 'Latest actionable inline comment',
      user: { login: 'openai-codex[bot]' },
      created_at: '2026-07-01T00:00:00Z',
      updated_at: '2026-07-02T00:00:00Z',
    }
  ]]);
} else {
  process.stderr.write('unexpected gh args: ' + JSON.stringify(args));
  process.exit(1);
}
`,
    { mode: 0o755 },
  );
  return { dir, logFile };
}

function runGithubPrReviews() {
  const fake = createFakeGh();
  const result = spawnSync('bun', [githubScript, 'pr.reviews', '--pr', '1', '--json'], {
    cwd: packageRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${fake.dir}:${process.env.PATH}`,
      FAKE_GH_LOG: fake.logFile,
    },
  });
  expect(result.status, result.stderr).toBe(0);
  const packet = JSON.parse(result.stdout) as GithubPacket;
  const ghCalls = readFileSync(fake.logFile, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as string[]);
  return { packet, ghCalls };
}

describe('os github pr.reviews', () => {
  it('uses the normalized collector for actionable PR review feedback', () => {
    const { packet, ghCalls } = runGithubPrReviews();
    const serialized = JSON.stringify(packet);

    expect(packet.ok).toBe(true);
    expect(packet.operation).toBe('pr.reviews');
    expect(ghCalls.some((call) => call.includes('repos/consuelohq/opensaas/pulls/1/comments'))).toBe(true);
    expect(ghCalls.some((call) => call.includes('repos/consuelohq/opensaas/issues/1/comments'))).toBe(true);
    expect(ghCalls.some((call) => call.includes('repos/consuelohq/opensaas/pulls/1/reviews'))).toBe(true);
    expect(ghCalls.some((call) => call.includes('repos/consuelohq/opensaas/pulls/1/reviews/10/comments'))).toBe(true);
    expect(serialized).toContain('Latest actionable inline comment');
    expect(serialized).toContain('codex');
    expect(serialized).not.toContain('Old duplicate body');
    expect(serialized).not.toContain('HTTP 429 rate limit');
  });
});
