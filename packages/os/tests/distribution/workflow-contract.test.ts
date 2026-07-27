import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

type DistributionWorkflow = {
  jobs: {
    'native-runtime': {
      strategy: {
        matrix: {
          include: Array<{ name: string; runner: string }>;
        };
      };
      steps: Array<{
        name?: string;
        if?: string;
        run?: string;
        uses?: string;
        with?: Record<string, string>;
      }>;
    };
    'oci-clean-host': {
      'runs-on': string;
      steps: Array<{ run?: string }>;
    };
    'regression-contracts': {
      'runs-on': string;
    };
  };
};

describe('OS distribution environment workflow', () => {
  it('should retain mandatory OCI and native runners when the workflow changes', async () => {
    const workflowPath = resolve(
      fileURLToPath(new URL('.', import.meta.url)),
      '../../../..',
      '.github/workflows/consuelo-os-distribution-environments.yaml',
    );
    const workflow = parse(
      await readFile(workflowPath, 'utf8'),
    ) as DistributionWorkflow;

    expect(workflow.jobs['oci-clean-host']['runs-on']).toBe('ubuntu-24.04');
    expect(
      workflow.jobs['oci-clean-host'].steps.some((step) =>
        step.run?.includes('docker.io/oven/bun:1.3.14'),
      ),
    ).toBe(true);
    expect(workflow.jobs['native-runtime'].strategy.matrix.include).toEqual([
      { name: 'linux', runner: 'ubuntu-24.04' },
      { name: 'macos', runner: 'macos-26' },
      { name: 'windows', runner: 'windows-2025' },
    ]);
    const nativeSteps = workflow.jobs['native-runtime'].steps;
    expect(nativeSteps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Run macOS menu-bar contracts',
          if: "matrix.name == 'macos'",
        }),
        expect.objectContaining({
          name: 'Package the macOS alpha app',
          if: "matrix.name == 'macos'",
          run: 'bash packages/os/scripts/testing/macos-alpha-package.sh packages/os/.tmp-macos-alpha',
        }),
        expect.objectContaining({
          name: 'Upload the macOS alpha app',
          if: "matrix.name == 'macos'",
          uses: 'actions/upload-artifact@v4',
        }),
      ]),
    );
    expect(workflow.jobs['regression-contracts']['runs-on']).toBe(
      'ubuntu-24.04',
    );
  });
});
