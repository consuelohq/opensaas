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
      expect.objectContaining({ name: 'oci', required: true }),
      expect.objectContaining({ name: 'macos', required: true }),
      expect.objectContaining({ name: 'windows', required: true }),
    ]);
    expect(DISTRIBUTION_INTEGRATION_SCRIPT).toBe('test:distribution:integration');
  });
});
