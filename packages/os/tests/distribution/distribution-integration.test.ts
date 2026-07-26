import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildDistributionIntegrationPlan,
  DISTRIBUTION_INTEGRATION_SCRIPT,
  DISTRIBUTION_INTEGRATION_TIMEOUT_MS,
} from '../../scripts/testing/distribution/integration-runner';

const repositoryRoot = existsSync(join(process.cwd(), '.github'))
  ? process.cwd()
  : join(process.cwd(), '..', '..');

describe('distribution integration contract', () => {
  it('covers the complete lifecycle, migration, and clean-host sequence', () => {
    const plan = buildDistributionIntegrationPlan();

    expect(plan.lifecycleStages).toEqual([
      'build',
      'publish',
      'install',
      'activate',
      'update',
      'report',
      'migrate',
      'rollback',
      'repair',
      'prune',
      'uninstall',
      'reinstall',
    ]);
    expect(plan.suites).toEqual(
      expect.arrayContaining([
        'tests/bootstrap-source.test.ts',
        'tests/daemon-bun-path.test.ts',
        'tests/installer-runtime-dependencies.test.ts',
        'tests/distribution/runtime-bundle.test.ts',
        'tests/distribution/release-channels.test.ts',
        'tests/lifecycle-engine.test.ts',
        'tests/lifecycle-retention-uninstall.test.ts',
        'tests/managed-components.test.ts',
        'tests/os-steering-runtime-context.test.ts',
      ]),
    );
    expect(plan.suites.some((suite) => suite.includes('lifecycle-contract'))).toBe(false);
    expect(DISTRIBUTION_INTEGRATION_TIMEOUT_MS).toBe(15 * 60 * 1000);
  });

  it('uses real OCI and native matrix coordinates for mandatory evidence', () => {
    const plan = buildDistributionIntegrationPlan();

    expect(plan.platformEvidence).toEqual([
      {
        name: 'oci',
        required: true,
        workflow: '.github/workflows/consuelo-os-distribution-environments.yaml',
        job: 'oci-clean-host',
      },
      {
        name: 'macos',
        required: true,
        workflow: '.github/workflows/consuelo-os-distribution-environments.yaml',
        job: 'native-runtime',
        matrixName: 'macos',
      },
      {
        name: 'windows',
        required: true,
        workflow: '.github/workflows/consuelo-os-distribution-environments.yaml',
        job: 'native-runtime',
        matrixName: 'windows',
      },
    ]);
    expect(DISTRIBUTION_INTEGRATION_SCRIPT).toBe('test:distribution:integration');
  });

  it('runs the full rehearsal in the native matrix and triggers for its source closure', () => {
    const workflow = readFileSync(
      join(
        repositoryRoot,
        '.github',
        'workflows',
        'consuelo-os-distribution-environments.yaml',
      ),
      'utf8',
    );

    expect(workflow).toContain('native-runtime:');
    expect(workflow).toContain('name: Consuelo OS / native ${{ matrix.name }}');
    expect(workflow).toContain("if: matrix.name == 'macos'");
    expect(workflow).toContain('run: bun run test:distribution:integration');
    expect(workflow).toContain("if: matrix.name != 'macos'");
    expect(workflow).toContain(
      'run: bun x vitest run tests/distribution --testTimeout 15000',
    );
    for (const requiredPath of [
      'packages/os/package.json',
      'packages/os/cloudflare/**',
      'packages/os/scripts/**',
      'packages/os/tests/**',
    ]) {
      expect(workflow).toContain(`- ${requiredPath}`);
    }
  });
});
