import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

type LifecycleContract = {
  createLifecycleOnboardingCommand: (input: {
    osRoot: string;
    home?: string;
    onboardingFile?: string;
  }) => {
    kind: 'interactive' | 'managed-cloud-node';
    args: string[];
  };
};

async function loadContract(): Promise<LifecycleContract> {
  const modulePath = pathToFileURL(
    join(process.cwd(), 'scripts', 'lifecycle.ts'),
  ).href;
  return (await import(modulePath)) as LifecycleContract;
}

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('managed cloud node lifecycle onboarding', () => {
  it('builds deterministic noninteractive installer args from the cloud descriptor', async () => {
    const { createLifecycleOnboardingCommand } = await loadContract();
    const directory = mkdtempSync(join(tmpdir(), 'consuelo-cloud-onboarding-'));
    temporaryDirectories.push(directory);
    const onboardingFile = join(directory, 'onboarding.json');
    writeFileSync(
      onboardingFile,
      JSON.stringify({
        schemaVersion: 1,
        projectId: 'consuelo-cloud-dev-igg2mr',
        workspaceId: 'workspace_kokayi',
        workspaceSlug: 'kokayi',
        workspaceHost: 'kokayi.consuelohq.com',
        nodeId: 'ko-cloud-1',
        nodeName: "Ko's cloud node",
        authorityOrigin: 'https://os.consuelohq.com',
      }),
      { mode: 0o600 },
    );

    expect(
      createLifecycleOnboardingCommand({
        osRoot: '/opt/consuelo/runtime',
        home: '/var/lib/consuelo',
        onboardingFile,
      }),
    ).toEqual({
      kind: 'managed-cloud-node',
      args: [
        '/opt/consuelo/runtime/scripts/install.ts',
        '--yes',
        '--quiet',
        '--skip-daemons',
        '--mode',
        'cloud',
        '--home',
        '/var/lib/consuelo',
        '--workspace-url',
        'kokayi.consuelohq.com',
        '--workspace-slug',
        'kokayi',
      ],
    });
  });

  it('preserves interactive onboarding when no managed descriptor is configured', async () => {
    const { createLifecycleOnboardingCommand } = await loadContract();
    expect(
      createLifecycleOnboardingCommand({
        osRoot: '/opt/consuelo/runtime',
        home: '/var/lib/consuelo',
      }),
    ).toEqual({
      kind: 'interactive',
      args: [
        '/opt/consuelo/runtime/scripts/install.ts',
        '--skip-daemons',
        '--home',
        '/var/lib/consuelo',
      ],
    });
  });

  it('rejects malformed, secret-bearing, or mismatched descriptors', async () => {
    const { createLifecycleOnboardingCommand } = await loadContract();
    const directory = mkdtempSync(join(tmpdir(), 'consuelo-cloud-onboarding-'));
    temporaryDirectories.push(directory);

    for (const [name, descriptor] of [
      ['malformed', '{'],
      [
        'secret-bearing',
        JSON.stringify({
          schemaVersion: 1,
          workspaceId: 'workspace_kokayi',
          workspaceSlug: 'kokayi',
          workspaceHost: 'kokayi.consuelohq.com',
          nodeId: 'ko-cloud-1',
          nodeName: "Ko's cloud node",
          connectorBootstrapToken: 'must-not-be-here',
        }),
      ],
      [
        'mismatched-host',
        JSON.stringify({
          schemaVersion: 1,
          workspaceId: 'workspace_kokayi',
          workspaceSlug: 'kokayi',
          workspaceHost: 'other.consuelohq.com',
          nodeId: 'ko-cloud-1',
          nodeName: "Ko's cloud node",
        }),
      ],
    ] as const) {
      const onboardingFile = join(directory, `${name}.json`);
      writeFileSync(onboardingFile, descriptor, { mode: 0o600 });
      expect(() =>
        createLifecycleOnboardingCommand({
          osRoot: '/opt/consuelo/runtime',
          home: '/var/lib/consuelo',
          onboardingFile,
        }),
      ).toThrow();
    }
  });
});
