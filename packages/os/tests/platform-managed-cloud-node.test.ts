import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

type FoundationStatus = 'created' | 'unchanged';

type FoundationClient = {
  ensureService: (service: string) => Promise<FoundationStatus>;
  ensureNetwork: (input: unknown) => Promise<FoundationStatus>;
  ensureSubnet: (input: unknown) => Promise<FoundationStatus>;
  ensureRouter: (input: unknown) => Promise<FoundationStatus>;
  ensureNat: (input: unknown) => Promise<FoundationStatus>;
  ensureFirewallRule: (input: unknown) => Promise<FoundationStatus>;
  ensureServiceAccount: (input: unknown) => Promise<FoundationStatus>;
  ensureProjectRoleBinding: (input: unknown) => Promise<FoundationStatus>;
  ensureSnapshotPolicy: (input: unknown) => Promise<FoundationStatus>;
  ensureBudget: (input: unknown) => Promise<FoundationStatus>;
};

type PlatformManagedCloudNodeContract = {
  provisionManagedCloudNodeFoundation: (input: {
    projectId: string;
    billingAccountId: string;
    region?: string;
    budgetAmountUsd?: number;
    dryRun?: boolean;
    client?: FoundationClient;
  }) => Promise<{
    status: 'planned' | 'provisioned';
    plan: { projectId: string; region: string };
    operations: Array<{ resource: string; status: string }>;
  }>;
};

async function loadContract(): Promise<PlatformManagedCloudNodeContract> {
  const modulePath = pathToFileURL(
    join(process.cwd(), 'scripts', 'lib', 'platform-managed-cloud-node.ts'),
  ).href;
  return (await import(modulePath)) as PlatformManagedCloudNodeContract;
}

const createFixtureClient = (): {
  calls: string[];
  client: FoundationClient;
} => {
  const calls: string[] = [];
  const record = async (name: string): Promise<FoundationStatus> => {
    calls.push(name);
    return 'created';
  };
  return {
    calls,
    client: {
      ensureService: async () => record('service'),
      ensureNetwork: async () => record('network'),
      ensureSubnet: async () => record('subnet'),
      ensureRouter: async () => record('router'),
      ensureNat: async () => record('nat'),
      ensureFirewallRule: async () => record('firewall'),
      ensureServiceAccount: async () => record('service-account'),
      ensureProjectRoleBinding: async () => record('iam'),
      ensureSnapshotPolicy: async () => record('snapshot-policy'),
      ensureBudget: async () => record('budget'),
    },
  };
};

describe('platform managed cloud node boundary', () => {
  it('plans without provider authority and applies through the same application service', async () => {
    const { provisionManagedCloudNodeFoundation } = await loadContract();
    const planned = await provisionManagedCloudNodeFoundation({
      projectId: 'consuelo-cloud-dev-igg2mr',
      billingAccountId: 'billing_fixture',
      dryRun: true,
    });
    expect(planned).toMatchObject({
      status: 'planned',
      plan: {
        projectId: 'consuelo-cloud-dev-igg2mr',
        region: 'us-east1',
      },
    });

    const fixture = createFixtureClient();
    const applied = await provisionManagedCloudNodeFoundation({
      projectId: 'consuelo-cloud-dev-igg2mr',
      billingAccountId: 'billing_fixture',
      client: fixture.client,
    });
    expect(applied.status).toBe('provisioned');
    expect(fixture.calls).toEqual(
      expect.arrayContaining([
        'service',
        'network',
        'subnet',
        'router',
        'nat',
        'firewall',
        'service-account',
        'iam',
        'snapshot-policy',
        'budget',
      ]),
    );
  });

  it('exposes an explicit operator CLI and package script without wiring cloud admin into install', () => {
    const scriptSource = readFileSync(
      join(process.cwd(), 'scripts', 'managed-cloud-node.ts'),
      'utf8',
    );
    const installSource = readFileSync(
      join(process.cwd(), 'scripts', 'install.ts'),
      'utf8',
    );
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
    ) as { scripts?: Record<string, string> };

    expect(scriptSource).toContain('provisionManagedCloudNodeFoundation');
    expect(scriptSource).toContain("command === 'plan'");
    expect(scriptSource).toContain("command === 'apply'");
    expect(scriptSource).toContain('--project');
    expect(scriptSource).toContain('--billing-account');
    expect(scriptSource).toContain('--region');
    expect(scriptSource).toContain('--budget-usd');
    expect(packageJson.scripts?.['cloud:node']).toBe(
      'bun ./scripts/managed-cloud-node.ts',
    );
    expect(installSource).not.toContain('platform-managed-cloud-node');
    expect(installSource).not.toContain('provisionManagedCloudNodeFoundation');
  });
});
