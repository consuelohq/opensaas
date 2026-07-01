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
  loadSitesLauncherSnapshot,
  runOnce,
  selectWarmPullNumbers,
  sanitizeName,
  stableFingerprint,
} from '../index';

async function tempRoot(): Promise<string> {
  const root = path.join(tmpdir(), `consuelo-cron-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(root, { recursive: true });
  return root;
}

describe('cron_jobs primitive', () => {
  test('should sanitize names when input contains spaces and symbols', () => {
    expect(sanitizeName('Diff Cockpit')).toBe('diff-cockpit');
    expect(() => sanitizeName('///')).toThrow('cron job name is required');
  });

  test('should namespace launch labels when installing local jobs', () => {
    expect(launchAgentLabel('OpenSaaS Local')).toBe('com.consuelo.cronjobs.opensaas-local');
  });

  test('should discover enabled jobs when named folders contain valid manifests', async () => {
    const root = await tempRoot();
    await mkdir(path.join(root, 'test_job'), { recursive: true });
    await Bun.write(path.join(root, 'test_job', 'cron.json'), JSON.stringify({ schema: 'consuelo.cron.v1', name: 'test-job', kind: 'diff-cockpit', enabled: true, intervalMs: 30000 }));
    const jobs = await discoverJobs(root);
    expect(jobs.some((job) => job.manifest.name === 'test-job')).toBe(true);
    expect(await readFile(path.join(root, 'test_job', 'cron.json'), 'utf8')).toContain('test-job');
  });

  test('should load a lightweight GitHub PR fingerprint when GitHub returns pulls', async () => {
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

  test('should throw an HTTP error when GitHub fingerprint loading fails', async () => {
    const fetcher: typeof fetch = async () => new Response('server error', { status: 500 });

    await expect(loadDiffCockpitFingerprint({ repo: 'consuelohq/opensaas', prLimit: 50, fetcher })).rejects.toThrow('GitHub PR fingerprint fetch failed with HTTP 500');
  });

  test('should throw a payload error when GitHub fingerprint payload is not an array', async () => {
    const fetcher: typeof fetch = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });

    await expect(loadDiffCockpitFingerprint({ repo: 'consuelohq/opensaas', prLimit: 50, fetcher })).rejects.toThrow('GitHub PR fingerprint response was not an array');
  });

  test('should select changed PRs when fingerprint fields differ', () => {
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


  test('should select changed, active, and recent PRs for shared cache warming', () => {
    const previous = [
      { number: 1, title: 'stream', state: 'open', draft: false, updatedAt: 'a', headRef: 'stream/diff-cockpit', baseRef: 'main', headSha: 'a', author: 'ko' },
      { number: 2, title: 'changed task', state: 'open', draft: false, updatedAt: 'b', headRef: 'task/diff-cockpit/changed', baseRef: 'stream/diff-cockpit', headSha: 'b', author: 'ko' },
      { number: 3, title: 'active task', state: 'open', draft: false, updatedAt: 'c', headRef: 'task/diff-cockpit/active', baseRef: 'stream/diff-cockpit', headSha: 'c', author: 'ko' },
      { number: 4, title: 'recent merged', state: 'closed', draft: false, updatedAt: 'd', headRef: 'task/diff-cockpit/recent', baseRef: 'stream/diff-cockpit', headSha: 'd', author: 'ko' },
    ];
    const current = [
      { number: 4, title: 'recent merged', state: 'closed', draft: false, updatedAt: 'd', headRef: 'task/diff-cockpit/recent', baseRef: 'stream/diff-cockpit', headSha: 'd', author: 'ko' },
      { number: 3, title: 'active task', state: 'open', draft: false, updatedAt: 'c', headRef: 'task/diff-cockpit/active', baseRef: 'stream/diff-cockpit', headSha: 'c', author: 'ko' },
      { number: 2, title: 'changed task', state: 'open', draft: false, updatedAt: 'b2', headRef: 'task/diff-cockpit/changed', baseRef: 'stream/diff-cockpit', headSha: 'b2', author: 'ko' },
      { number: 1, title: 'stream', state: 'open', draft: false, updatedAt: 'a', headRef: 'stream/diff-cockpit', baseRef: 'main', headSha: 'a', author: 'ko' },
    ];

    expect(selectWarmPullNumbers(previous, current, 3)).toEqual([2, 3, 1]);
  });

  test('should avoid writing state when run-once is dry-run', async () => {
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
  test('should discover enabled sites launcher jobs', async () => {
    const root = await tempRoot();
    await mkdir(path.join(root, 'sites_launcher'), { recursive: true });
    await Bun.write(path.join(root, 'sites_launcher', 'cron.json'), JSON.stringify({ schema: 'consuelo.cron.v1', name: 'sites-launcher', kind: 'sites-launcher', enabled: true, intervalMs: 60000, origin: 'https://sites.consuelohq.com' }));
    const jobs = await discoverJobs(root);
    expect(jobs.some((job) => job.manifest.name === 'sites-launcher' && job.manifest.kind === 'sites-launcher')).toBe(true);
  });

  test('should validate sites launcher cache headers and numeric hotkeys', async () => {
    const fetcher: typeof fetch = async () => new Response(
      '<a data-hotkey="1"></a><a data-hotkey="2"></a><a data-hotkey="3"></a><a data-hotkey="4"></a><a data-hotkey="5"></a><script>const siteHotkeys = {}</script>',
      { status: 200, headers: { 'cache-control': 'public, max-age=60, s-maxage=86400, stale-while-revalidate=604800', 'cf-cache-status': 'HIT' } },
    );
    const snapshot = await loadSitesLauncherSnapshot({ origin: 'https://sites.consuelohq.com', expectedCacheControl: 's-maxage=86400', fetcher });
    expect(snapshot).toEqual({
      url: 'https://sites.consuelohq.com/',
      status: 200,
      ok: true,
      cacheControl: 'public, max-age=60, s-maxage=86400, stale-while-revalidate=604800',
      cfCacheStatus: 'HIT',
      hasNumericHotkeys: true,
    });
  });

  test('should refresh and verify the sites launcher job', async () => {
    const root = await tempRoot();
    const statePath = path.join(root, 'state.json');
    const logPath = path.join(root, 'cron.log');
    await mkdir(path.join(root, 'sites_launcher'), { recursive: true });
    await Bun.write(path.join(root, 'sites_launcher', 'cron.json'), JSON.stringify({ schema: 'consuelo.cron.v1', name: 'sites-launcher', kind: 'sites-launcher', enabled: true, intervalMs: 60000, origin: 'https://sites.consuelohq.com', expectedCacheControl: 's-maxage=86400' }));
    const commands: string[][] = [];
    const commandRunner = async (command: string[]) => {
      commands.push(command);
      return { stdout: '{\"ok\":true}', stderr: '', exitCode: 0 };
    };
    const fetcher: typeof fetch = async () => new Response(
      '<a data-hotkey="1"></a><a data-hotkey="2"></a><a data-hotkey="3"></a><a data-hotkey="4"></a><a data-hotkey="5"></a><script>const siteHotkeys = {}</script>',
      { status: 200, headers: { 'cache-control': 'public, max-age=60, s-maxage=86400', 'cf-cache-status': 'DYNAMIC' } },
    );

    const result = await runOnce({ root, statePath, logPath, force: true, fetcher, commandRunner });

    expect(result.checked).toBe(1);
    expect(result.changed).toBe(1);
    expect(result.errors).toBe(0);
    expect(commands[0]).toEqual(['bun', 'packages/workspace/scripts/consuelo-design.ts', 'refresh', '--json']);
    expect(await readFile(statePath, 'utf8')).toContain('sites-launcher');
    expect(await readFile(logPath, 'utf8')).toContain('sites-launcher: refreshed status=200');
  });
});

