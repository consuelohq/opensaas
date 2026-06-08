import { mkdir, readFile } from 'node:fs/promises';
import { describe, expect, test } from 'bun:test';
import { discoverJobs, launchAgentLabel, sanitizeName } from '../index';

describe('cron_jobs primitive', () => {
  test('sanitizes agent-provided names', () => {
    expect(sanitizeName('Diff Cockpit')).toBe('diff-cockpit');
    expect(() => sanitizeName('///')).toThrow('cron job name is required');
  });

  test('uses namespaced launch labels', () => {
    expect(launchAgentLabel('OpenSaaS Local')).toBe('com.consuelo.cronjobs.opensaas-local');
  });

  test('discovers enabled jobs from cron_jobs folders', async () => {
    await mkdir('cron_jobs/test-job', { recursive: true });
    await Bun.write('cron_jobs/test-job/cron.json', JSON.stringify({ schema: 'consuelo.cron.v1', name: 'test-job', kind: 'diff-cockpit', enabled: true, intervalMs: 30000 }));
    const jobs = await discoverJobs();
    expect(jobs.some((job) => job.name === 'test-job')).toBe(true);
    expect(await readFile('cron_jobs/test-job/cron.json', 'utf8')).toContain('test-job');
  });
});
