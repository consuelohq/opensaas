import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import {
  changedPullNumbers,
  discoverJobs,
  launchAgentLabel,
  loadDiffCockpitFingerprint,
  runOnce,
  sanitizeName,
  stableFingerprint,
} from '../index';

async function tempRoot(): Promise<string> {
  const root = path.join(tmpdir(), `consuelo-cron-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(root, { recursive: true });
  return root;
}

describe('cron_jobs primitive', () => {
  test('sanitizes agent-provided names', () => {
    expect(sanitizeName('Diff Cockpit')).toBe('diff-cockpit');
    expect(() => sanitizeName('///')).toThrow('cron job name is required');
  });

  test('uses namespaced launch labels', () => {
    expect(launchAgentLabel('OpenSaaS Local')).toBe('com.consuelo.cronjobs.opensaas-local');
  });

  test('discovers enabled jobs from named folders', async () => {
    const root = await tempRoot();
    await mkdir(path.join(root, 'test_job'), { recursive: true });
    await Bun.write(path.join(root, 'test_job', 'cron.json'), JSON.stringify({ schema: 'consuelo.cron.v1', name: 'test-job', kind: 'diff-cockpit', enabled: true, intervalMs: 30000 }));
    const jobs = await discoverJobs(root);
    expect(jobs.some((job) => job.manifest.name === 'test-job')).toBe(true);
    expect(await readFile(path.join(root, 'test_job', 'cron.json'), 'utf8')).toContain('test-job');
  });

  test('loads a lightweight GitHub PR fingerprint', async () => {
    const response = new Response(JSON.stringify([
      {
        number: 748,
        title: 'Stream/diff-cockpit',
        state: 'open',
        draft: false,
        updated_at: '2026-06-08T00:00:00Z',
        head: { ref: 'stream/diff-cockpit', sha: 'abc123' },
        base: { ref: 'main' },
        user: { login: 'ko' },
      },
    ]));
    const calls: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      calls.push(String(input));
      return response.clone();
    };

    const pulls = await loadDiffCockpitFingerprint({ repo: 'consuelohq/opensaas', prLimit: 50, fetcher });

    expect(calls[0]).toContain('/repos/consuelohq/opensaas/pulls?state=all');
    expect(pulls).toEqual([
      {
        number: 748,
        title: 'Stream/diff-cockpit',
        state: 'open',
        draft: false,
        updatedAt: '2026-06-08T00:00:00Z',
        headRef: 'stream/diff-cockpit',
        baseRef: 'main',
        headSha: 'abc123',
        author: 'ko',
      },
    ]);
  });

  test('selects changed PRs from fingerprint changes', () => {
    const previous = [
      { number: 1, title: '', state: 'open', draft: false, updatedAt: 'a', headRef: 'one', baseRef: 'main', headSha: 'a', author: 'ko' },
      { number: 2, title: '', state: 'open', draft: false, updatedAt: 'b', headRef: 'two', baseRef: 'main', headSha: 'b', author: 'ko' },
    ];
    const current = [
      { number: 1, title: '', state: 'open', draft: false, updatedAt: 'a', headRef: 'one', baseRef: 'main', headSha: 'a', author: 'ko' },
      { number: 2, title: '', state: 'open', draft: false, updatedAt: 'c', headRef: 'two', baseRef: 'main', headSha: 'c', author: 'ko' },
      { number: 3, title: '', state: 'open', draft: false, updatedAt: 'd', headRef: 'three', baseRef: 'main', headSha: 'd', author: 'ko' },
    ];
    expect(changedPullNumbers(previous, current)).toEqual([2, 3]);
  });

  test('runOnce dry-run checks changed jobs without writing state', async () => {
    const root = await tempRoot();
    const statePath = path.join(root, 'state.json');
    const logPath = path.join(root, 'cron.log');
    await mkdir(path.join(root, 'diff_cockpit'), { recursive: true });
    await Bun.write(path.join(root, 'diff_cockpit', 'cron.json'), JSON.stringify({ schema: 'consuelo.cron.v1', name: 'diff-cockpit', kind: 'diff-cockpit', enabled: true, intervalMs: 30000, repo: 'consuelohq/opensaas' }));
    const fetcher: typeof fetch = async () => new Response(JSON.stringify([{ number: 1, title: '', state: 'open', draft: false, updated_at: 'now', head: { ref: 'x', sha: 'sha' }, base: { ref: 'main' }, user: { login: 'ko' } }]));

    const result = await runOnce({ root, statePath, logPath, dryRun: true, force: true, fetcher });

    expect(result.checked).toBe(1);
    expect(result.changed).toBe(1);
    expect(result.errors).toBe(0);
    expect(existsSync(statePath)).toBe(false);
    expect(stableFingerprint([{ b: 1, a: 2 }])).toBe('[{"a":2,"b":1}]');
  });
});
