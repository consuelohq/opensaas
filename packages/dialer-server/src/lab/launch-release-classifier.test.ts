import { describe, expect, it } from 'bun:test';
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dir, '../../../..');
const releaseWorkflow = join(
  repoRoot,
  '.github/workflows/consuelo-production-release.yaml',
);

async function writeFixture(root: string, filename: string, content: string) {
  const path = join(root, filename);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

function git(root: string, ...args: string[]): string {
  const result = Bun.spawnSync(['git', ...args], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if (result.exitCode !== 0) {
    throw new Error('Fixture git failed: ' + result.stderr.toString());
  }
  return result.stdout.toString().trim();
}

async function classify(
  root: string,
  before: string,
  after: string,
  event: 'push' | 'workflow_dispatch' = 'push',
  target = 'all',
) {
  const contents = await readFile(releaseWorkflow, 'utf8');
  const job = contents
    .split('  dialer-changes:\n')[1]
    ?.split('\n  public-changes:\n')[0];
  const encoded = job?.split('        run: |\n')[1];
  if (!encoded)
    throw new Error('Release workflow is missing its dialer classifier Bash');
  const script = encoded
    .split('\n')
    .map((line) => line.replace(/^ {10}/, ''))
    .join('\n')
    .replaceAll('$' + '{{ github.event_name }}', event)
    .replaceAll('$' + '{{ inputs.target }}', target)
    .replaceAll('$' + '{{ github.event.before }}', before);
  const output = join(root, 'github-output');
  await unlink(output).catch((error: unknown) => {
    if (
      !error ||
      typeof error !== 'object' ||
      !('code' in error) ||
      error.code !== 'ENOENT'
    )
      throw error;
  });
  const result = Bun.spawnSync(['bash', '-c', script], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      PATH: process.env.PATH ?? '/usr/bin:/bin',
      GITHUB_SHA: after,
      GITHUB_OUTPUT: output,
      RUNNER_TEMP: root,
    },
  });
  expect(result.exitCode, result.stderr.toString()).toBe(0);
  return await readFile(output, 'utf8');
}

describe('production release classification for QA-only Dialer changes', () => {
  it('does not redeploy live Dialer for a test harness but still deploys runtime, dependency and manual target changes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dialer-qa-release-'));
    try {
      git(root, 'init', '-q');
      git(root, 'config', 'user.email', 'qa@consuelo.invalid');
      git(root, 'config', 'user.name', 'Release QA');
      const packageJson: {
        name: string;
        scripts: Record<string, string>;
        dependencies: Record<string, string>;
      } = {
        name: '@consuelo/dialer-server',
        scripts: { test: 'bun test' },
        dependencies: { hono: '4.0.0' },
      };
      await writeFixture(
        root,
        'packages/dialer-server/package.json',
        JSON.stringify(packageJson) + '\n',
      );
      await writeFixture(
        root,
        'packages/dialer-server/src/main.ts',
        'export const healthy = true;\n',
      );
      git(root, 'add', '.');
      git(root, 'commit', '-qm', 'base');
      const a = git(root, 'rev-parse', 'HEAD');

      packageJson.scripts['lab:launch'] = 'bun ./scripts/launch-scenarios.ts';
      await writeFixture(
        root,
        'packages/dialer-server/package.json',
        JSON.stringify(packageJson) + '\n',
      );
      for (const path of [
        'packages/dialer-server/LAUNCH-QA.md',
        'packages/dialer-server/scripts/launch-scenarios.ts',
        'packages/dialer-server/scripts/local-dialer-lab.ts',
        'packages/dialer-server/src/lab/launch-scenarios.ts',
        'packages/dialer-server/src/lab/launch-scenarios.test.ts',
        'packages/dialer-server/src/lab/launch-scenarios.cli.test.ts',
        'packages/dialer-server/src/lab/launch-release-classifier.test.ts',
        'packages/dialer-server/src/lab/learning-rollback-scenario.ts',
        'packages/dialer-server/src/lab/rep-campaign.ts',
        'packages/dialer-server/src/lab/rep-campaign-plan.ts',
        'packages/dialer-server/src/lab/rep-campaign.test.ts',
        'packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts',
        'packages/dialer-server/src/inbound/rep-capacity.integration.test.ts',
        'packages/dialer-server/src/inbound/routing.integration.test.ts',
        'packages/dialer-server/src/inbound/callbacks.integration.test.ts',
        'packages/dialer-server/src/lab/qa-postgres-suites.ts',
        'packages/dialer-server/src/lab/historical-inbound-fixture.ts',
        'packages/dialer-server/src/inbound/telephony.integration.test.ts',
      ])
        await writeFixture(root, path, 'test-only change\n');
      git(root, 'add', '.');
      git(root, 'commit', '-qm', 'QA only');
      const b = git(root, 'rev-parse', 'HEAD');
      expect(await classify(root, a, b)).toContain('release=false');
      expect(
        await classify(root, a, b, 'workflow_dispatch', 'dialer'),
      ).toContain('release=true');
      expect(await classify(root, a, b, 'workflow_dispatch', 'docs')).toContain(
        'release=false',
      );

      await writeFixture(
        root,
        'packages/dialer-server/src/main.ts',
        'export const healthy = false;\n',
      );
      git(root, 'add', '.');
      git(root, 'commit', '-qm', 'real runtime change');
      const c = git(root, 'rev-parse', 'HEAD');
      expect(await classify(root, b, c)).toContain('release=true');
      expect(await classify(root, a, c)).toContain('release=true');

      packageJson.dependencies.hono = '4.1.0';
      await writeFixture(
        root,
        'packages/dialer-server/package.json',
        JSON.stringify(packageJson) + '\n',
      );
      git(root, 'add', '.');
      git(root, 'commit', '-qm', 'dependency change');
      const d = git(root, 'rev-parse', 'HEAD');
      expect(await classify(root, c, d)).toContain('release=true');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
