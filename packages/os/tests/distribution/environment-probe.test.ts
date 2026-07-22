import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runDistributionEnvironmentProbe } from '../../scripts/testing/distribution/environment-probe';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((path) =>
      rm(path, { force: true, recursive: true }),
    ),
  );
});

describe('distribution environment probe', () => {
  it('should prove portable filesystem behavior when using an isolated Consuelo home', async () => {
    const root = await mkdtemp(join(tmpdir(), 'consuelo-os-probe-test-'));
    const home = join(root, '.consuelo');
    temporaryRoots.push(root);

    const report = await runDistributionEnvironmentProbe({
      arch: 'test-arch',
      cleanup: true,
      environment: {
        CI: 'true',
        CONSUELO_OS_TEST_TOKEN: 'osat-never-print-this',
      },
      home,
      platform: 'test-platform',
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      runtime: {
        arch: 'test-arch',
        platform: 'test-platform',
      },
      home: {
        atomicReplace: true,
        cleanup: true,
        isolated: true,
        writable: true,
      },
    });
    expect(existsSync(home)).toBe(false);
    expect(JSON.stringify(report)).not.toContain('osat-never-print-this');
    expect(JSON.stringify(report)).not.toContain(root);
  });

  it('should preserve the isolated home when cleanup is disabled', async () => {
    const root = await mkdtemp(join(tmpdir(), 'consuelo-os-probe-test-'));
    const home = join(root, '.consuelo');
    temporaryRoots.push(root);

    const report = await runDistributionEnvironmentProbe({
      cleanup: false,
      home,
    });

    expect(report.home.cleanup).toBe(false);
    expect(existsSync(home)).toBe(true);
  });
});
