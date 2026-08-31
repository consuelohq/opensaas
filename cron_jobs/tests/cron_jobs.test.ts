import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import {
  discoverJobs,
  launchAgentLabel,
  loadSitesLauncherSnapshot,
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
    await Bun.write(path.join(root, 'test_job', 'cron.json'), JSON.stringify({ schema: 'consuelo.cron.v1', name: 'test-job', kind: 'sites-launcher', enabled: true, intervalMs: 30000 }));
    const jobs = await discoverJobs(root);
    expect(jobs.some((job) => job.manifest.name === 'test-job')).toBe(true);
    expect(await readFile(path.join(root, 'test_job', 'cron.json'), 'utf8')).toContain('test-job');
  });

  test('should avoid writing state when run-once is dry-run', async () => {
    const root = await tempRoot();
    const statePath = path.join(root, 'state.json');
    const logPath = path.join(root, 'cron.log');
    await mkdir(path.join(root, 'sites_launcher'), { recursive: true });
    await Bun.write(path.join(root, 'sites_launcher', 'cron.json'), JSON.stringify({ schema: 'consuelo.cron.v1', name: 'sites-launcher', kind: 'sites-launcher', enabled: true, intervalMs: 30000, origin: 'https://sites.consuelohq.com', expectedCacheControl: 's-maxage=86400' }));
    const fetcher: typeof fetch = async () => new Response(
      '<a data-hotkey="1"></a><a data-hotkey="2"></a><a data-hotkey="3"></a><a data-hotkey="4"></a><a data-hotkey="5"></a><script>const siteHotkeys = {}</script>',
      { status: 200, headers: { 'cache-control': 'public, max-age=60, s-maxage=86400' } },
    );

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
    expect(commands[0]).toEqual(['bun', 'packages/os/scripts/os.ts', 'sites', 'refresh', '--json']);
    expect(await readFile(statePath, 'utf8')).toContain('sites-launcher');
    expect(await readFile(logPath, 'utf8')).toContain('sites-launcher: refreshed status=200');
  });
});

