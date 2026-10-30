import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getPullRequestCheckSummary, summarizeCheckRuns } from '../scripts/lib/task-merge-readiness.js';
import { mergePullRequest } from '../scripts/lib/github.js';

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

const HEAD = '56aea5499b851bef4b2a357f37e9248eca84407e';

function actionCheck(
  name: string,
  workflow: string,
  run: number,
  conclusion: string | null,
  options: { status?: string; startedAt?: string; updatedAt?: string; id?: string } = {},
) {
  const when = options.startedAt ?? '2026-10-29T03:27:34Z';
  return {
    __typename: 'CheckRun',
    id: options.id ?? `${run}-${name}`,
    name,
    status: options.status ?? 'COMPLETED',
    conclusion,
    startedAt: when,
    completedAt: when,
    checkSuite: {
      app: { databaseId: 15368 },
      workflowRun: {
        databaseId: run,
        event: 'pull_request',
        createdAt: when,
        updatedAt: options.updatedAt ?? when,
        workflow: { id: workflow, name: workflow },
      },
    },
  };
}

function checkResponse(nodes: unknown[], count: number, hasNextPage = false, endCursor = 'page-1') {
  return {
    data: {
      repository: {
        object: {
          oid: HEAD,
          statusCheckRollup: {
            contexts: { totalCount: count, pageInfo: { hasNextPage, endCursor }, nodes },
          },
        },
      },
    },
  };
}

describe('DEV-1637 effective check contexts and fail-closed boundaries', () => {
  it('reconciles 37 historical runs to 19 effective contexts without collapsing equal names across workflows', () => {
    const jobs = [
      ['CI Docs', 'changed-files-check / changed-files'],
      ['CI Docs', 'docs-check'],
      ['Consuelo Website', 'changed-files-check / changed-files'],
      ['Consuelo Website', 'Consuelo / website status'],
      ...['clean OCI host', 'native linux', 'native macos', 'native windows', 'native macos-intel', 'Debian 12 Linux platform', 'existing distribution regressions']
        .map(name => ['OS Distribution', `Consuelo OS / ${name}`]),
      ...['changed files', 'workflow security', 'website', 'verify', 'OS contracts', 'dialer', 'Sites Gateway + Cloudflare']
        .map(name => ['Consuelo CI', `Consuelo / ${name}`]),
    ] as Array<[string, string]>;
    expect(jobs).toHaveLength(18);
    const old = jobs.map(([workflow, name], i) =>
      actionCheck(name, workflow, 100 + ['CI Docs', 'Consuelo Website', 'OS Distribution', 'Consuelo CI'].indexOf(workflow), 'CANCELLED', { id: `old-${i}` }));
    const current = jobs.map(([workflow, name], i) =>
      actionCheck(name, workflow, 200 + ['CI Docs', 'Consuelo Website', 'OS Distribution', 'Consuelo CI'].indexOf(workflow),
        name === 'docs-check' ? 'SKIPPED' : 'SUCCESS',
        { id: `new-${i}`, startedAt: '2026-10-29T03:27:38Z', updatedAt: '2026-10-29T03:29:00Z' }));
    const result = summarizeCheckRuns([...old, ...current, {
      __typename: 'CheckRun',
      name: 'CodeRabbit',
      status: 'COMPLETED',
      conclusion: 'NEUTRAL',
      checkSuite: { app: { databaseId: 123 }, workflowRun: null },
    }]);
    expect(result).toMatchObject({ state: 'passed', total: 19, pending: [], failed: [] });
    expect(result.passed.filter((name: string) => name === 'changed-files-check / changed-files')).toHaveLength(2);
  });

  it('keeps real failures, pending/unknown checks, and unreplaced cancellations blocking', () => {
    const old = actionCheck('build', 'CI', 10, 'CANCELLED');
    const newer = actionCheck('build', 'CI', 11, 'FAILURE', { updatedAt: '2026-10-29T03:30:00Z' });
    expect(summarizeCheckRuns([old, newer]).failed).toContain('build');
    expect(summarizeCheckRuns([old]).failed).toContain('build');
    expect(summarizeCheckRuns([actionCheck('queue', 'CI', 11, null, { status: 'QUEUED' })]).state).toBe('pending');
    expect(summarizeCheckRuns([actionCheck('unknown', 'CI', 11, 'TOTALLY_NEW')]).state).not.toBe('passed');
    expect(summarizeCheckRuns([actionCheck('unknown app', 'CI', 11, 'CANCELLED', { updatedAt: '2026-10-29T03:27:34Z' })]).state).not.toBe('passed');
  });

  it('never hides another matrix job or a missing replacement check', () => {
    const first = actionCheck('matrix', 'CI', 15, 'SUCCESS', { id: 'matrix-linux' });
    const second = actionCheck('matrix', 'CI', 15, 'FAILURE', { id: 'matrix-windows' });
    expect(summarizeCheckRuns([first, second])).toMatchObject({ state: 'failed', total: 2, failed: ['matrix'] });
    const missing = summarizeCheckRuns([
      actionCheck('matrix', 'CI', 14, 'CANCELLED', { id: 'old-linux' }),
      actionCheck('matrix', 'CI', 14, 'CANCELLED', { id: 'old-windows' }),
      actionCheck('matrix', 'CI', 15, 'SUCCESS', { id: 'new-linux', updatedAt: '2026-10-29T03:29:00Z' }),
    ]);
    expect(missing.state).toBe('pending');
    expect(missing.pending.some((name: string) => name.includes('matrix'))).toBe(true);
  });

  it('blocks conflicting run-order evidence rather than masking a later-started failure', () => {
    const laterStartedFailure = actionCheck('verify', 'CI', 21, 'FAILURE', {
      startedAt: '2026-10-29T03:31:00Z',
      updatedAt: '2026-10-29T03:31:05Z',
    });
    const laterUpdatedSuccess = actionCheck('verify', 'CI', 22, 'SUCCESS', {
      startedAt: '2026-10-29T03:28:00Z',
      updatedAt: '2026-10-29T03:32:00Z',
    });
    expect(summarizeCheckRuns([laterStartedFailure, laterUpdatedSuccess]).state).not.toBe('passed');
  });

  it('never interprets successful legacy-only contexts as complete GitHub Actions CI', () => {
    const legacy = (state: string) => ({
      __typename: 'StatusContext', id: 'status-1', context: 'legacy/verify',
      state, createdAt: '2026-10-29T03:29:00Z',
    });
    const passingLegacyOnly = summarizeCheckRuns([legacy('SUCCESS')]);
    expect(passingLegacyOnly).toMatchObject({
      state: 'pending', total: 1, failed: [], passed: ['legacy/verify'],
    });
    expect(passingLegacyOnly.pending).toEqual(expect.arrayContaining([
      expect.stringContaining('GitHub Actions'),
    ]));

    const thirdParty = {
      __typename: 'CheckRun', id: 'coderabbit', name: 'CodeRabbit',
      status: 'COMPLETED', conclusion: 'SUCCESS',
      checkSuite: { app: { databaseId: 123 }, workflowRun: null },
    };
    expect(summarizeCheckRuns([legacy('SUCCESS'), thirdParty])).toMatchObject({
      state: 'pending', total: 2, failed: [],
    });

    expect(summarizeCheckRuns([legacy('FAILURE')]).state).toBe('failed');
    expect(summarizeCheckRuns([legacy('PENDING')]).state).toBe('pending');
    expect(summarizeCheckRuns([legacy('UNKNOWN')]).state).not.toBe('passed');

    const actualActions = actionCheck('verify', 'CI', 42, 'SUCCESS');
    expect(summarizeCheckRuns([legacy('SUCCESS'), actualActions])).toMatchObject({
      state: 'passed', total: 2, failed: [], pending: [],
    });
  });

  it('gates legacy status contexts and never treats unknown legacy states as success', () => {
    const ok = actionCheck('verify', 'CI', 15, 'SUCCESS');
    const status = (state: string) => ({ __typename: 'StatusContext', context: 'legacy/verify', state, createdAt: '2026-10-29T03:29:00Z' });
    expect(summarizeCheckRuns([ok, status('SUCCESS')]).state).toBe('passed');
    expect(summarizeCheckRuns([ok, status('FAILURE')]).state).toBe('failed');
    expect(summarizeCheckRuns([ok, status('PENDING')]).state).toBe('pending');
    expect(summarizeCheckRuns([ok, status('UNKNOWN')]).state).not.toBe('passed');
  });

  it('holds the PR merge gate pending when GraphQL returns a successful legacy status but no Actions check run', async () => {
    const status = {
      __typename: 'StatusContext', id: 'legacy-only', context: 'legacy/verify',
      state: 'SUCCESS', createdAt: '2026-10-29T03:29:00Z',
    };
    const bot = {
      __typename: 'CheckRun', id: 'unrelated-bot', name: 'CodeRabbit',
      status: 'COMPLETED', conclusion: 'NEUTRAL',
      checkSuite: { app: { databaseId: 123 }, workflowRun: null },
    };
    const result = await getPullRequestCheckSummary(
      'token', 'consuelohq/opensaas', { head: { sha: HEAD } },
      async () => checkResponse([status, bot], 2),
    );
    expect(result).toMatchObject({
      state: 'pending', total: 2, headSha: HEAD, failed: [],
    });
    expect(result.pending).toEqual(expect.arrayContaining([expect.stringContaining('GitHub Actions')]));
  });

  it('reads every page for 105 contexts and catches a failing check beyond the first 100', async () => {
    const checks = Array.from({ length: 105 }, (_, i) => ({
      __typename: 'CheckRun', id: `check-id-${i}`, name: `check-${i}`, status: 'COMPLETED',
      conclusion: i === 104 ? 'FAILURE' : 'SUCCESS',
      checkSuite: { app: { databaseId: 123 }, workflowRun: null },
    }));
    const responses = [
      checkResponse(checks.slice(0, 100), 105, true, 'next-page'),
      checkResponse(checks.slice(100), 105, false, 'last-page'),
    ];
    const requests: Array<Record<string, any>> = [];
    const request = async (params: Record<string, any>) => {
      requests.push(params);
      return responses[requests.length - 1];
    };
    const result = await getPullRequestCheckSummary('token', 'consuelohq/opensaas', { head: { sha: HEAD } }, request);
    expect(result).toMatchObject({ state: 'failed', headSha: HEAD, total: 105, failed: ['check-104'] });
    expect(requests).toHaveLength(2);
    expect(requests.map(value => value.body.variables.cursor)).toEqual([null, 'next-page']);
  });

  it('does not count a repeated page as 105 unique checks', async () => {
    const first = Array.from({ length: 100 }, (_, i) => ({
      __typename: 'CheckRun', id: `id-${i}`, name: `job-${i}`,
      status: 'COMPLETED', conclusion: 'SUCCESS',
      checkSuite: { app: { databaseId: 123 }, workflowRun: null },
    }));
    let page = 0;
    const request = async () => ++page === 1
      ? checkResponse(first, 105, true, 'cursor-2')
      : checkResponse(first.slice(0, 5), 105, false, 'end');
    const result = await getPullRequestCheckSummary('token', 'consuelohq/opensaas', { head: { sha: HEAD } }, request);
    expect(result.state).toBe('pending');
  });

  it('fails closed on truncated context counts, invalid cursors, provider errors and inconsistent SHA', async () => {
    const good = actionCheck('verify', 'CI', 4, 'SUCCESS');
    const evaluate = async (response: unknown) => getPullRequestCheckSummary(
      'token', 'consuelohq/opensaas', { head: { sha: HEAD } }, async () => response,
    );
    expect((await evaluate(checkResponse([good], 2, false))).state).toBe('pending');
    expect((await evaluate(checkResponse([good], 2, true, ''))).state).toBe('pending');
    expect((await evaluate({ errors: [{ message: 'GitHub GraphQL unavailable' }] })).state).toBe('pending');
    expect((await evaluate({ ...checkResponse([good], 1), data: { repository: { object: { oid: 'different' } } } })).state).toBe('pending');
    const result = await getPullRequestCheckSummary(
      'token', 'consuelohq/opensaas', { head: { sha: HEAD } },
      async () => { throw new Error('provider timeout'); },
    );
    expect(result).toMatchObject({ state: 'pending', headSha: HEAD });
    expect(result.error).toContain('provider timeout');
  });
});

describe('DEV-1637 exact SHA precondition', () => {
  it('includes the verified SHA in normal and squash merge requests; refuses a concurrent head update', async () => {
    const originalFetch = globalThis.fetch;
    const bodies: Array<Record<string, any>> = [];
    try {
      globalThis.fetch = (async (_url: string | URL | Request, options?: RequestInit) => {
        const body = JSON.parse(String(options?.body));
        bodies.push(body);
        if (bodies.length === 3) {
          return new Response(JSON.stringify({ message: 'Head branch was modified' }), { status: 409 });
        }
        return new Response(JSON.stringify({ merged: true, sha: HEAD }), { status: 200 });
      }) as typeof fetch;
      await mergePullRequest({ token: 'token', repository: 'consuelohq/opensaas', prNumber: 2651, sha: HEAD });
      await mergePullRequest({ token: 'token', repository: 'consuelohq/opensaas', prNumber: 2651, sha: HEAD, mergeMethod: 'squash' });
      await expect(mergePullRequest({ token: 'token', repository: 'consuelohq/opensaas', prNumber: 2651, sha: HEAD }))
        .rejects.toMatchObject({ details: { status: 409 } });
      expect(bodies.map(body => body.sha)).toEqual([HEAD, HEAD, HEAD]);
      expect(bodies.map(body => body.merge_method)).toEqual(['merge', 'squash', 'merge']);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('passes the checked PR head through both mirrored merge commands even without --wait', () => {
    for (const path of [resolve(packageRoot, 'scripts/task-merge.js'), resolve(packageRoot, '../os/scripts/task-merge.js')]) {
      const source = readFileSync(path, 'utf8');
      expect(source).toContain('sha: headSha');
    }
  });
});
