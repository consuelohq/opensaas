import { spawnSync } from 'node:child_process';

export const DISTRIBUTION_INTEGRATION_SCRIPT =
  'test:distribution:integration' as const;
export const DISTRIBUTION_INTEGRATION_TIMEOUT_MS = 15 * 60 * 1000;

export const DISTRIBUTION_LIFECYCLE_STAGES = [
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
] as const;

export const DISTRIBUTION_INTEGRATION_SUITES = [
  'tests/bootstrap-source.test.ts',
  'tests/daemon-bun-path.test.ts',
  'tests/installer-runtime-dependencies.test.ts',
  'tests/distribution/distribution-integration.test.ts',
  'tests/distribution/runtime-bundle.test.ts',
  'tests/distribution/release-channel-schema.test.ts',
  'tests/distribution/release-channels.test.ts',
  'tests/distribution/release-channels-cli.test.ts',
  'tests/distribution/release-channel-workflows.test.ts',
  'tests/distribution/release-publication-preparer.test.ts',
  'tests/lifecycle-engine.test.ts',
  'tests/lifecycle-restart-contract.test.ts',
  'tests/lifecycle-retention-uninstall.test.ts',
  'tests/managed-components.test.ts',
  'tests/install-state.test.ts',
  'tests/os-steering-runtime-context.test.ts',
  'tests/workspace-node-registry-routing.test.ts',
] as const;

export type DistributionPlatformEvidence = {
  name: 'oci' | 'macos' | 'windows';
  required: true;
  workflow: string;
  job: string;
  matrixName?: 'macos' | 'windows';
};

const PLATFORM_EVIDENCE: readonly DistributionPlatformEvidence[] = [
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
] as const;

export function buildDistributionIntegrationPlan() {
  return {
    lifecycleStages: [...DISTRIBUTION_LIFECYCLE_STAGES],
    suites: [...DISTRIBUTION_INTEGRATION_SUITES],
    platformEvidence: PLATFORM_EVIDENCE.map((entry) => ({ ...entry })),
  };
}

export function runDistributionIntegration(): number {
  const result = spawnSync(
    'bun',
    [
      'x',
      'vitest',
      'run',
      ...DISTRIBUTION_INTEGRATION_SUITES,
      '--testTimeout',
      '30000',
      '--no-file-parallelism',
    ],
    {
      cwd: new URL('../../..', import.meta.url),
      encoding: 'utf8',
      stdio: 'inherit',
      timeout: DISTRIBUTION_INTEGRATION_TIMEOUT_MS,
    },
  );

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
}

if (import.meta.main) {
  process.exitCode = runDistributionIntegration();
}
