import { describe, expect, it } from 'vitest';

import {
  buildDistributionIntegrationPlan,
  DISTRIBUTION_INTEGRATION_SCRIPT,
} from '../../scripts/testing/distribution/integration-runner';

describe('distribution integration contract', () => {
  it('covers the complete lifecycle and migration sequence with executable suites', () => {
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
        'tests/distribution/runtime-bundle.test.ts',
        'tests/distribution/release-channels.test.ts',
        'tests/lifecycle-engine.test.ts',
        'tests/lifecycle-retention-uninstall.test.ts',
        'tests/managed-components.test.ts',
        'tests/os-steering-runtime-context.test.ts',
      ]),
    );
    expect(plan.suites.some((suite) => suite.includes('lifecycle-contract'))).toBe(false);
  });

  it('defines mandatory OCI, macOS, and Windows evidence lanes', () => {
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
        job: 'platform-contracts (macos)',
      },
      {
        name: 'windows',
        required: true,
        workflow: '.github/workflows/consuelo-os-distribution-environments.yaml',
        job: 'platform-contracts (windows)',
      },
    ]);
    expect(DISTRIBUTION_INTEGRATION_SCRIPT).toBe('test:distribution:integration');
  });
});
