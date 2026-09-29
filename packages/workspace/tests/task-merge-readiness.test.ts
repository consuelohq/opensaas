import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { summarizeCheckRuns } from '../scripts/lib/task-merge-readiness.js';

const packageRoot = resolve(import.meta.dirname, '..');

describe('task merge CI readiness', () => {
  it('returns pending without treating in-progress GitHub Actions checks as mergeable', () => {
    expect(summarizeCheckRuns([
      { name: 'Consuelo / verify', status: 'in_progress', conclusion: null },
      { name: 'Consuelo OS / native macos', status: 'completed', conclusion: 'success' },
    ])).toMatchObject({
      state: 'pending',
      pending: ['Consuelo / verify'],
      failed: [],
    });
  });

  it('blocks terminal failed checks and accepts success, neutral, and skipped conclusions', () => {
    expect(summarizeCheckRuns([
      { name: 'verify', status: 'completed', conclusion: 'failure' },
      { name: 'docs', status: 'completed', conclusion: 'skipped' },
    ])).toMatchObject({
      state: 'failed',
      failed: ['verify'],
    });

    expect(summarizeCheckRuns([
      { name: 'verify', status: 'completed', conclusion: 'success' },
      { name: 'docs', status: 'completed', conclusion: 'skipped' },
      { name: 'lint', status: 'completed', conclusion: 'neutral' },
    ])).toMatchObject({
      state: 'passed',
      pending: [],
      failed: [],
    });
  });

  it('keeps --wait bounded to GitHub CI and leaves deploy polling behind an explicit flag', () => {
    for (const path of [
      resolve(packageRoot, 'scripts/task-merge.js'),
      resolve(packageRoot, '../os/scripts/task-merge.js'),
    ]) {
      const source = readFileSync(path, 'utf8');
      expect(source).toContain("case '--wait-deploy'");
      expect(source).toContain('getPullRequestCheckSummary');
      expect(source).toContain('retryAfterSeconds');
      expect(source).toContain('if (args.waitDeploy)');
      expect(source).not.toContain('if (args.wait && mergeSha)');
    }
  });

  it('accepts every stream.sync argument advertised by its manifest', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(packageRoot, 'tooling/tool-manifest.json'), 'utf8'),
    ) as Array<{
      name: string;
      command?: { arguments?: Array<{ flag?: string }> };
    }>;
    const sync = manifest.find((entry) => entry.name === 'stream.sync');
    const advertisedFlags = (sync?.command?.arguments ?? [])
      .map((argument) => argument.flag)
      .filter((flag): flag is string => Boolean(flag));

    for (const path of [
      resolve(packageRoot, 'scripts/stream-sync.js'),
      resolve(packageRoot, '../os/scripts/stream-sync.js'),
    ]) {
      const source = readFileSync(path, 'utf8');
      for (const flag of advertisedFlags) {
        expect(source, `${path} should parse advertised ${flag}`).toContain(
          `case '${flag}'`,
        );
      }
    }
  });
});
