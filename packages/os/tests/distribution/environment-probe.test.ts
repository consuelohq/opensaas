import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runDistributionEnvironmentProbe } from '../../scripts/testing/distribution/environment-probe';

const temporaryRoots: string[] = [];
const PROBE_DIRECTORY_PREFIX = '.consuelo-os-environment-probe-';

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
    await mkdir(home, { recursive: true });
    await writeFile(join(home, 'sentinel.txt'), 'preserve', 'utf8');

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
    expect(existsSync(home)).toBe(true);
    expect(await readFile(join(home, 'sentinel.txt'), 'utf8')).toBe('preserve');
    expect(
      (await readdir(home)).filter((entry) =>
        entry.startsWith(PROBE_DIRECTORY_PREFIX),
      ),
    ).toEqual([]);
    expect(JSON.stringify(report)).not.toContain('osat-never-print-this');
    expect(JSON.stringify(report)).not.toContain(root);
  });

  it.each([
    ['a home-like parent', (root: string) => join(root, 'home')],
    [
      'a normalized Consuelo parent',
      (root: string) => join(root, '.consuelo', '..'),
    ],
    ['a repo-like parent', (root: string) => join(root, 'repo-checkout')],
  ])(
    'should preserve caller-owned content when cleanup uses %s',
    async (_label, suppliedHome) => {
      const root = await mkdtemp(join(tmpdir(), 'consuelo-os-probe-parent-'));
      const home = suppliedHome(root);
      const resolvedHome = resolve(home);
      temporaryRoots.push(root);
      await mkdir(resolvedHome, { recursive: true });
      await writeFile(join(resolvedHome, 'sentinel.txt'), 'preserve', 'utf8');

      await runDistributionEnvironmentProbe({ cleanup: true, home });

      expect(existsSync(resolvedHome)).toBe(true);
      expect(await readFile(join(resolvedHome, 'sentinel.txt'), 'utf8')).toBe(
        'preserve',
      );
      expect(
        (await readdir(resolvedHome)).filter((entry) =>
          entry.startsWith(PROBE_DIRECTORY_PREFIX),
        ),
      ).toEqual([]);
    },
  );

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
    expect(
      (await readdir(home)).some((entry) =>
        entry.startsWith(PROBE_DIRECTORY_PREFIX),
      ),
    ).toBe(true);
  });

  it('should reject the real Consuelo home when the exact product path is supplied', async () => {
    await expect(
      runDistributionEnvironmentProbe({
        home: join(homedir(), '.consuelo'),
      }),
    ).rejects.toThrow('Distribution probe refuses to use the real Consuelo home.');
  });
});
