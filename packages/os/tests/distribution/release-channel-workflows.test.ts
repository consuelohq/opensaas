import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '../../../..');

function read(path: string): string {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

type WorkflowStep = {
  name?: string;
  run?: string;
  uses?: string;
  'working-directory'?: string;
};

type WorkflowJob = {
  environment?: string;
  needs?: string | string[];
  permissions?: Record<string, string>;
  steps?: WorkflowStep[];
  uses?: string;
};

type ReleaseWorkflow = {
  jobs?: Record<string, WorkflowJob>;
  permissions?: Record<string, string>;
};

function parseWorkflow(path: string): ReleaseWorkflow {
  return parse(read(path)) as ReleaseWorkflow;
}

function dependencyInstallSteps(workflow: string): WorkflowStep[] {
  const parsed = parse(workflow) as ReleaseWorkflow;
  return Object.values(parsed.jobs ?? {})
    .flatMap((job) => job.steps ?? [])
    .filter((step) => step.name === 'Install dependencies');
}

describe('Consuelo OS release-channel workflows', () => {
  it('keeps pull requests validation-only and publishes dev only from main', () => {
    const workflow = read('.github/workflows/consuelo-os-runtime-publish.yaml');
    const parsed = parseWorkflow(
      '.github/workflows/consuelo-os-runtime-publish.yaml',
    );

    expect(workflow).toContain('push:');
    expect(workflow).toContain('- main');
    expect(workflow).not.toContain('pull_request:');
    expect(workflow).not.toContain('workflow_dispatch:');
    expect(parsed.permissions).toEqual({ contents: 'read' });
    expect(parsed.jobs?.['distribution-gate']).toMatchObject({
      permissions: { contents: 'read' },
      uses: './.github/workflows/consuelo-os-distribution-environments.yaml',
    });
    expect(parsed.jobs?.['windows-service-host']?.needs).toBe(
      'distribution-gate',
    );
    expect(parsed.jobs?.plan?.needs).toEqual([
      'distribution-gate',
      'windows-service-host',
    ]);
    expect(parsed.jobs?.build?.needs).toEqual(['plan', 'windows-service-host']);
    expect(parsed.jobs?.publish?.needs).toEqual([
      'distribution-gate',
      'plan',
      'build',
    ]);
    expect(parsed.jobs?.plan?.permissions).toBeUndefined();
    expect(parsed.jobs?.build?.permissions).toBeUndefined();
    expect(parsed.jobs?.publish?.permissions).toEqual({
      contents: 'write',
      deployments: 'write',
    });
    expect(workflow).toContain('environment: consuelo / production');
    expect(workflow).toContain('runtime-bundle:fingerprint');
    expect(workflow).toContain('release:channels -- publish');
    expect(workflow).toContain('--plan-only');
    expect(workflow).toContain("if: steps.plan.outputs.changed == 'true'");
    expect(workflow).toContain('darwin-arm64');
    expect(workflow).toContain('linux-x64');
    expect(workflow).toContain('windows-x64');
    expect(workflow).toContain('Build deterministic Windows service host');
    expect(workflow).toContain('name: windows-service-host');
    expect(workflow).toContain(
      'native/windows-service/bin/Release/Consuelo.Windows.Service.exe',
    );
    expect(workflow).toContain(
      'path: packages/os/native/windows-service/bin/Release',
    );
    expect(workflow).not.toContain("if: matrix.platform == 'windows'");
    expect(workflow).toContain('CLOUDFLARE_OS_RELEASE_API_TOKEN');
    expect(workflow).toContain('CONSUELO_OS_RELEASE_SIGNING_PRIVATE_KEY');
    expect(workflow).not.toContain(
      'release-state.json" \
            --remote \
            --file "${RELEASE_STATE_PATH}" || true',
    );
    expect(workflow).toContain('No authoritative release state exists yet.');
    expect(workflow).toContain(
      'Failed to restore authoritative release state.',
    );
    expect(workflow).not.toContain('mapfile -t tags < <(');
    expect(workflow).toContain('.release/immutable-tags.txt');
    expect(workflow).toContain('actions/runs/${GITHUB_RUN_ID}');
    expect(workflow).toContain('--now \"${release_time}\"');
    expect(workflow).toContain('--source-root .');
    expect(workflow).not.toContain('--source-root packages/os');
    expect(workflow).toContain('--state \"../../${RELEASE_STATE_PATH}\"');
    expect(workflow).toContain('group: consuelo-os-release-state');
  });

  it('promotes only by manual dispatch through protected environments and never rebuilds', () => {
    const workflow = read('.github/workflows/consuelo-os-runtime-promote.yaml');

    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toContain('pull_request:');
    expect(workflow).not.toContain('push:');
    expect(workflow).toContain('environment: consuelo-os-${{ inputs.to }}');
    expect(workflow).toContain('release:channels -- promote');
    expect(workflow).toContain('--from "${{ inputs.from }}"');
    expect(workflow).toContain('--to "${{ inputs.to }}"');
    expect(workflow).toContain('--bundle "${{ inputs.bundle }}"');
    expect(workflow).toContain('--approval-evidence');
    expect(workflow).not.toContain('build-runtime-bundle');
    expect(workflow).not.toContain('runtime-bundle:build');
    expect(workflow).toContain('actions/runs/${GITHUB_RUN_ID}');
    expect(workflow).toContain('--now \"${release_time}\"');
    expect(workflow).toContain('group: consuelo-os-release-state');
    expect(workflow).not.toContain('expected_revision:');
    expect(workflow).toContain('release_revision=');
    expect(workflow).toContain('--expected-revision \"${release_revision}\"');
  });

  it('provides a manual rollback path that also avoids rebuilding', () => {
    const workflow = read(
      '.github/workflows/consuelo-os-runtime-rollback.yaml',
    );

    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain(
      'environment: consuelo-os-${{ inputs.channel }}',
    );
    expect(workflow).toContain('release:channels -- rollback-channel');
    expect(workflow).toContain('--channel "${{ inputs.channel }}"');
    expect(workflow).toContain('--bundle "${{ inputs.bundle }}"');
    expect(workflow).not.toContain('build-runtime-bundle');
    expect(workflow).toContain('actions/runs/${GITHUB_RUN_ID}');
    expect(workflow).toContain('--now \"${release_time}\"');
    expect(workflow).toContain('group: consuelo-os-release-state');
    expect(workflow).not.toContain('expected_revision:');
    expect(workflow).toContain('release_revision=');
    expect(workflow).toContain('--expected-revision \"${release_revision}\"');
  });

  it('installs release dependencies from the OS package lockfile', () => {
    const workflows = [
      [
        'publish',
        read('.github/workflows/consuelo-os-runtime-publish.yaml'),
        3,
      ],
      [
        'promote',
        read('.github/workflows/consuelo-os-runtime-promote.yaml'),
        1,
      ],
      [
        'rollback',
        read('.github/workflows/consuelo-os-runtime-rollback.yaml'),
        1,
      ],
    ] as const;

    for (const [name, workflow, expectedInstallCount] of workflows) {
      const installSteps = dependencyInstallSteps(workflow);

      expect(installSteps, `${name} install step count`).toHaveLength(
        expectedInstallCount,
      );
      for (const step of installSteps) {
        expect(
          step['working-directory'],
          `${name} install working directory`,
        ).toBe('packages/os');
        expect(step.run, `${name} frozen OS lockfile install`).toBe(
          'bun install --frozen-lockfile',
        );
      }
    }
  });

  it('separates release credentials from channel approval environments', () => {
    const publishSource = read(
      '.github/workflows/consuelo-os-runtime-publish.yaml',
    );
    const promoteSource = read(
      '.github/workflows/consuelo-os-runtime-promote.yaml',
    );
    const rollbackSource = read(
      '.github/workflows/consuelo-os-runtime-rollback.yaml',
    );
    const publish = parseWorkflow(
      '.github/workflows/consuelo-os-runtime-publish.yaml',
    );
    const promote = parseWorkflow(
      '.github/workflows/consuelo-os-runtime-promote.yaml',
    );
    const rollback = parseWorkflow(
      '.github/workflows/consuelo-os-runtime-rollback.yaml',
    );

    expect(publish.jobs?.plan?.environment).toBe('consuelo / production');
    expect(publish.jobs?.publish?.environment).toBe('consuelo / production');

    expect(promote.jobs?.approve?.environment).toBe(
      'consuelo-os-${{ inputs.to }}',
    );
    expect(promote.jobs?.promote?.environment).toBe('consuelo / production');
    expect(promote.jobs?.promote?.needs).toBe('approve');

    expect(rollback.jobs?.approve?.environment).toBe(
      'consuelo-os-${{ inputs.channel }}',
    );
    expect(rollback.jobs?.rollback?.environment).toBe('consuelo / production');
    expect(rollback.jobs?.rollback?.needs).toBe('approve');

    for (const source of [publishSource, promoteSource, rollbackSource]) {
      expect(source).toContain(
        'CLOUDFLARE_ACCOUNT_ID: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}',
      );
      expect(source).toContain(
        'CLOUDFLARE_OS_RELEASE_API_TOKEN: ${{ secrets.CLOUDFLARE_OS_RELEASE_API_TOKEN }}',
      );
      expect(source).not.toContain(
        'CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}',
      );
    }
  });

  it('installs the pinned Wrangler CLI before every credentialed provider operation', () => {
    const cases = [
      [
        'publish plan',
        parseWorkflow('.github/workflows/consuelo-os-runtime-publish.yaml').jobs
          ?.plan,
      ],
      [
        'publish mutation',
        parseWorkflow('.github/workflows/consuelo-os-runtime-publish.yaml').jobs
          ?.publish,
      ],
      [
        'promotion',
        parseWorkflow('.github/workflows/consuelo-os-runtime-promote.yaml').jobs
          ?.promote,
      ],
      [
        'rollback',
        parseWorkflow('.github/workflows/consuelo-os-runtime-rollback.yaml')
          .jobs?.rollback,
      ],
    ] as const;

    for (const [name, job] of cases) {
      const steps = job?.steps ?? [];
      const wranglerIndex = steps.findIndex(
        (step) => step.name === 'Install Wrangler',
      );
      const restoreIndex = steps.findIndex(
        (step) => step.name === 'Restore authoritative release state',
      );

      expect(wranglerIndex, `${name} Wrangler setup`).toBeGreaterThanOrEqual(0);
      expect(steps[wranglerIndex]?.run, `${name} pinned Wrangler version`).toBe(
        'bun install --global wrangler@4.105.0',
      );
      expect(wranglerIndex, `${name} setup order`).toBeLessThan(restoreIndex);
    }
  });

  it('allowlists only the dedicated release workflows for write permissions', () => {
    const guard = read(
      'packages/workspace/scripts/ci/check-github-workflows.cjs',
    );

    expect(guard).toContain(
      "'.github/workflows/consuelo-os-runtime-publish.yaml'",
    );
    expect(guard).toContain(
      "'.github/workflows/consuelo-os-runtime-promote.yaml'",
    );
    expect(guard).toContain(
      "'.github/workflows/consuelo-os-runtime-rollback.yaml'",
    );
  });

  it('wires a Bun-owned release command and documents all supported operations', () => {
    const packageJson = JSON.parse(read('packages/os/package.json')) as {
      scripts: Record<string, string>;
    };
    const scriptsDoc = read('packages/os/SCRIPTS.md');
    const releaseDoc = read(
      'packages/os/docs/distribution/release-channels.md',
    );

    expect(packageJson.scripts['release:channels']).toBe(
      'bun ./scripts/release-channels.ts',
    );
    for (const command of [
      'publish',
      'promote',
      'inspect',
      'rollback-channel',
    ]) {
      expect(scriptsDoc).toContain(command);
      expect(releaseDoc).toContain(command);
    }
    expect(releaseDoc).toContain('consuelo-os-dev');
    expect(releaseDoc).toContain('consuelo-os-canary');
    expect(releaseDoc).toContain('consuelo-os-beta');
    expect(releaseDoc).toContain('consuelo-os-stable');
    expect(releaseDoc).toContain('promotion never rebuilds');
  });
});
