import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

type EnrollmentContract = {
  loadOrCreateManagedCloudNodeDeviceKeyPair: (input: {
    home: string;
    nodeId: string;
    generate?: () => typeof deviceKeyPair;
  }) => typeof deviceKeyPair;
  managedCloudNodeDeviceKeyPath: (home: string, nodeId: string) => string;
  runManagedCloudNodeEnrollment: (input: {
    home: string;
    onboarding: {
      workspaceId: string;
      workspaceSlug: string;
      workspaceHost: string;
      nodeId: string;
      nodeName: string;
      authorityOrigin?: string;
    };
    dependencies: {
      loadOrCreateDeviceKeyPair: (input: {
        home: string;
        nodeId: string;
      }) => typeof deviceKeyPair;
      requestDeviceCode: (input: Record<string, unknown>) => Promise<unknown>;
      pollAccessToken: (input: Record<string, unknown>) => Promise<unknown>;
      provision: (input: Record<string, unknown>) => unknown;
      activateHeartbeat: (input: {
        home: string;
        connectorId: string;
      }) => Promise<void>;
      now: () => number;
      sleep: (milliseconds: number) => Promise<void>;
      writeStatus: (status: Record<string, unknown>) => void;
    };
  }) => Promise<{
    status: 'enrolled';
    workspaceId: string;
    nodeId: string;
    connectorId: string;
  }>;
  writeManagedCloudNodeEnrollmentStatus: (
    path: string,
    status: Record<string, unknown>,
  ) => void;
  activateManagedCloudNodeHeartbeat: (input: {
    home: string;
    connectorId: string;
    run: (input: {
      command: string[];
      env: Record<string, string | undefined>;
    }) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
  }) => Promise<void>;
};

async function loadContract(): Promise<EnrollmentContract> {
  const modulePath = pathToFileURL(
    join(process.cwd(), 'scripts', 'lib', 'managed-cloud-node-enrollment.ts'),
  ).href;
  return (await import(modulePath)) as EnrollmentContract;
}

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

const onboarding = {
  workspaceId: 'workspace_kokayi',
  workspaceSlug: 'kokayi',
  workspaceHost: 'kokayi.consuelohq.com',
  nodeId: 'ko-cloud-1',
  nodeName: "Ko's cloud node",
  authorityOrigin: 'https://os.consuelohq.com',
};

const deviceKeyPair = {
  algorithm: 'Ed25519' as const,
  publicKeyJwk: '{"kty":"OKP","crv":"Ed25519","x":"public"}',
  signingKeyJwk: '{"kty":"OKP","crv":"Ed25519","x":"public","d":"private"}',
};

const replacementDeviceKeyPair = {
  algorithm: 'Ed25519' as const,
  publicKeyJwk: '{"kty":"OKP","crv":"Ed25519","x":"replacement"}',
  signingKeyJwk:
    '{"kty":"OKP","crv":"Ed25519","x":"replacement","d":"private-replacement"}',
};

describe('managed cloud node enrollment', () => {
  it('persists one owner-only node keypair and reuses it across enrollment retries', async () => {
    const {
      loadOrCreateManagedCloudNodeDeviceKeyPair,
      managedCloudNodeDeviceKeyPath,
    } = await loadContract();
    const directory = mkdtempSync(join(tmpdir(), 'consuelo-managed-node-key-'));
    temporaryDirectories.push(directory);
    const home = join(directory, 'home');
    let generated = 0;

    const first = loadOrCreateManagedCloudNodeDeviceKeyPair({
      home,
      nodeId: onboarding.nodeId,
      generate: () => {
        generated += 1;
        return deviceKeyPair;
      },
    });
    const second = loadOrCreateManagedCloudNodeDeviceKeyPair({
      home,
      nodeId: onboarding.nodeId,
      generate: () => {
        generated += 1;
        return replacementDeviceKeyPair;
      },
    });
    const keyPath = managedCloudNodeDeviceKeyPath(home, onboarding.nodeId);

    expect(first).toEqual(deviceKeyPair);
    expect(second).toEqual(deviceKeyPair);
    expect(generated).toBe(1);
    expect(existsSync(keyPath)).toBe(true);
    expect(statSync(keyPath).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(keyPath, 'utf8'))).toMatchObject({
      schemaVersion: 1,
      nodeId: onboarding.nodeId,
      deviceKeyPair,
    });
  });

  it('publishes a secret-free device code, polls approval, and provisions the approved bootstrap', async () => {
    const { runManagedCloudNodeEnrollment } = await loadContract();
    const requests: Record<string, unknown>[] = [];
    const polls: Record<string, unknown>[] = [];
    const statuses: Record<string, unknown>[] = [];
    const provisions: Record<string, unknown>[] = [];
    const activations: Array<{ home: string; connectorId: string }> = [];
    const approvedWorkspaceId = onboarding.workspaceId;
    let pollCount = 0;

    const result = await runManagedCloudNodeEnrollment({
      home: '/var/lib/consuelo',
      onboarding,
      dependencies: {
        now: () => Date.parse('2026-07-28T04:59:00.000Z'),
        loadOrCreateDeviceKeyPair: () => deviceKeyPair,
        requestDeviceCode: async (input) => {
          requests.push(input);
          return {
            status: 'started',
            deviceKeyPair,
            session: {
              deviceCode: 'device-secret',
              userCode: 'ABCD-EFGH',
              verificationUri: 'https://os.consuelohq.com/login/device',
              verificationUriComplete:
                'https://os.consuelohq.com/login/device?user_code=ABCDEFGH',
              expiresAt: '2026-07-28T05:00:00.000Z',
              intervalSeconds: 5,
            },
          };
        },
        pollAccessToken: async (input) => {
          polls.push(input);
          pollCount += 1;
          if (pollCount === 1) return { status: 'pending', intervalSeconds: 5 };
          return {
            status: 'approved',
            workspaceId: approvedWorkspaceId,
            workspaceSlug: onboarding.workspaceSlug,
            workspaceHost: onboarding.workspaceHost,
            nodeId: onboarding.nodeId,
            nodeName: onboarding.nodeName,
            nodeRole: 'member',
            nodeStatus: 'created',
            connectorId: 'connector_ko_cloud_1',
            connectorBootstrapToken: 'connector-bootstrap-secret',
            connectorBootstrapExpiresAt: '2026-07-28T05:05:00.000Z',
            cloudflareTunnelToken: 'cloudflare-tunnel-secret',
          };
        },
        provision: (input) => {
          provisions.push(input);
          return { home: '/var/lib/consuelo' };
        },
        activateHeartbeat: async (input) => {
          activations.push(input);
        },
        sleep: async () => {},
        writeStatus: (status) => statuses.push(status),
      },
    });

    expect(requests).toEqual([
      expect.objectContaining({
        clientId: 'consuelo-os-installer',
        scope: ['workspace:read', 'os:connector:register'],
        workspaceId: onboarding.workspaceId,
        workspaceSlug: 'kokayi',
        workspaceHost: 'kokayi.consuelohq.com',
        nodeId: 'ko-cloud-1',
        nodeName: "Ko's cloud node",
        deviceKeyPair,
      }),
    ]);
    expect(polls).toHaveLength(2);
    expect(provisions).toEqual([
      {
        home: '/var/lib/consuelo',
        mode: 'cloud',
        platform: 'linux',
        workspaceBootstrap: {
          workspaceId: approvedWorkspaceId,
          workspaceSlug: onboarding.workspaceSlug,
          workspaceHost: onboarding.workspaceHost,
          nodeId: onboarding.nodeId,
          nodeName: onboarding.nodeName,
          nodeRole: 'member',
          nodeStatus: 'created',
          nodePublicKeyJwk: deviceKeyPair.publicKeyJwk,
          nodeSigningKeyJwk: deviceKeyPair.signingKeyJwk,
          nodeCapabilities: ['mcp', 'tools'],
          authorityOrigin: onboarding.authorityOrigin,
          connectorId: 'connector_ko_cloud_1',
          connectorTransport: 'cloudflare-tunnel',
          connectorBootstrapToken: 'connector-bootstrap-secret',
          cloudflareTunnelToken: 'cloudflare-tunnel-secret',
        },
      },
    ]);
    expect(activations).toEqual([
      {
        home: '/var/lib/consuelo',
        connectorId: 'connector_ko_cloud_1',
      },
    ]);
    expect(statuses[0]).toEqual({
      schemaVersion: 1,
      phase: 'awaiting_authorization',
      userCode: 'ABCD-EFGH',
      verificationUri:
        'https://os.consuelohq.com/login/device?user_code=ABCDEFGH',
      expiresAt: '2026-07-28T05:00:00.000Z',
      workspaceSlug: 'kokayi',
      nodeId: 'ko-cloud-1',
    });
    expect(JSON.stringify(statuses)).not.toMatch(
      /device-secret|connector-bootstrap-secret|cloudflare-tunnel-secret|signingKeyJwk|private/,
    );
    expect(statuses.at(-1)).toEqual({
      schemaVersion: 1,
      phase: 'enrolled',
      workspaceId: approvedWorkspaceId,
      workspaceSlug: onboarding.workspaceSlug,
      nodeId: onboarding.nodeId,
      connectorId: 'connector_ko_cloud_1',
    });
    expect(result).toEqual({
      status: 'enrolled',
      workspaceId: approvedWorkspaceId,
      nodeId: onboarding.nodeId,
      connectorId: 'connector_ko_cloud_1',
    });
  });

  it('fails closed when the approved workspace ID differs from the managed-node plan', async () => {
    const { runManagedCloudNodeEnrollment } = await loadContract();
    const statuses: Record<string, unknown>[] = [];
    let provisioned = false;
    let activated = false;

    await expect(
      runManagedCloudNodeEnrollment({
        home: '/var/lib/consuelo',
        onboarding,
        dependencies: {
          now: () => Date.parse('2026-07-28T04:59:00.000Z'),
          loadOrCreateDeviceKeyPair: () => deviceKeyPair,
          requestDeviceCode: async () => ({
            status: 'started',
            deviceKeyPair,
            session: {
              deviceCode: 'device-secret',
              userCode: 'ABCD-EFGH',
              verificationUri: 'https://os.consuelohq.com/login/device',
              verificationUriComplete:
                'https://os.consuelohq.com/login/device?user_code=ABCDEFGH',
              expiresAt: '2026-07-28T05:00:00.000Z',
              intervalSeconds: 5,
            },
          }),
          pollAccessToken: async () => ({
            status: 'approved',
            workspaceId: 'workspace_other',
            workspaceSlug: onboarding.workspaceSlug,
            workspaceHost: onboarding.workspaceHost,
            nodeId: onboarding.nodeId,
            nodeName: onboarding.nodeName,
            nodeRole: 'member',
            nodeStatus: 'created',
            connectorId: 'connector_ko_cloud_1',
            connectorBootstrapToken: 'connector-bootstrap-secret',
            connectorBootstrapExpiresAt: '2026-07-28T05:05:00.000Z',
            cloudflareTunnelToken: 'cloudflare-tunnel-secret',
          }),
          provision: () => {
            provisioned = true;
          },
          activateHeartbeat: async () => {
            activated = true;
          },
          sleep: async () => {},
          writeStatus: (status) => statuses.push(status),
        },
      }),
    ).rejects.toThrow(/DEVICE_GRANT_IDENTITY_MISMATCH/);
    expect(provisioned).toBe(false);
    expect(activated).toBe(false);
    expect(statuses.at(-1)).toMatchObject({
      phase: 'failed',
      errorCode: 'DEVICE_GRANT_IDENTITY_MISMATCH',
    });
  });

  it('fails closed on denied authorization without provisioning', async () => {
    const { runManagedCloudNodeEnrollment } = await loadContract();
    const statuses: Record<string, unknown>[] = [];
    let provisioned = false;

    await expect(
      runManagedCloudNodeEnrollment({
        home: '/var/lib/consuelo',
        onboarding,
        dependencies: {
          now: () => Date.parse('2026-07-28T04:59:00.000Z'),
          loadOrCreateDeviceKeyPair: () => deviceKeyPair,
          requestDeviceCode: async () => ({
            status: 'started',
            deviceKeyPair,
            session: {
              deviceCode: 'device-secret',
              userCode: 'ABCD-EFGH',
              verificationUri: 'https://os.consuelohq.com/login/device',
              verificationUriComplete:
                'https://os.consuelohq.com/login/device?user_code=ABCDEFGH',
              expiresAt: '2026-07-28T05:00:00.000Z',
              intervalSeconds: 5,
            },
          }),
          pollAccessToken: async () => ({
            status: 'denied',
            errorCode: 'DEVICE_CODE_DENIED',
          }),
          provision: () => {
            provisioned = true;
          },
          activateHeartbeat: async () => {
            throw new Error('heartbeat activation must not run after denial');
          },
          sleep: async () => {},
          writeStatus: (status) => statuses.push(status),
        },
      }),
    ).rejects.toThrow(/DEVICE_CODE_DENIED/);
    expect(provisioned).toBe(false);
    expect(statuses.at(-1)).toMatchObject({
      phase: 'failed',
      errorCode: 'DEVICE_CODE_DENIED',
    });
  });

  it('fails closed when approval lacks an executable tunnel transport', async () => {
    const { runManagedCloudNodeEnrollment } = await loadContract();
    let provisioned = false;
    let activated = false;

    await expect(
      runManagedCloudNodeEnrollment({
        home: '/var/lib/consuelo',
        onboarding,
        dependencies: {
          now: () => Date.parse('2026-07-28T04:59:00.000Z'),
          loadOrCreateDeviceKeyPair: () => deviceKeyPair,
          requestDeviceCode: async () => ({
            status: 'started',
            deviceKeyPair,
            session: {
              deviceCode: 'device-secret',
              userCode: 'ABCD-EFGH',
              verificationUri: 'https://os.consuelohq.com/login/device',
              verificationUriComplete:
                'https://os.consuelohq.com/login/device?user_code=ABCDEFGH',
              expiresAt: '2026-07-28T05:00:00.000Z',
              intervalSeconds: 5,
            },
          }),
          pollAccessToken: async () => ({
            status: 'approved',
            workspaceId: onboarding.workspaceId,
            workspaceSlug: onboarding.workspaceSlug,
            workspaceHost: onboarding.workspaceHost,
            nodeId: onboarding.nodeId,
            nodeName: onboarding.nodeName,
            nodeRole: 'member',
            nodeStatus: 'created',
            connectorId: 'connector_ko_cloud_1',
            connectorBootstrapToken: 'connector-bootstrap-secret',
            connectorBootstrapExpiresAt: '2026-07-28T05:05:00.000Z',
          }),
          provision: () => {
            provisioned = true;
          },
          activateHeartbeat: async () => {
            activated = true;
          },
          sleep: async () => {},
          writeStatus: () => {},
        },
      }),
    ).rejects.toThrow(/CONNECTOR_TRANSPORT_UNAVAILABLE/);
    expect(provisioned).toBe(false);
    expect(activated).toBe(false);
  });

  it('writes enrollment status with owner-only permissions', async () => {
    const { writeManagedCloudNodeEnrollmentStatus } = await loadContract();
    const directory = mkdtempSync(join(tmpdir(), 'consuelo-enrollment-'));
    temporaryDirectories.push(directory);
    const statusPath = join(directory, 'status.json');

    writeManagedCloudNodeEnrollmentStatus(statusPath, {
      schemaVersion: 1,
      phase: 'awaiting_authorization',
      userCode: 'ABCD-EFGH',
    });

    expect(JSON.parse(readFileSync(statusPath, 'utf8'))).toMatchObject({
      phase: 'awaiting_authorization',
      userCode: 'ABCD-EFGH',
    });
    expect(statSync(statusPath).mode & 0o777).toBe(0o600);
  });

  it('activates the durable Linux heartbeat timer through the user manager', async () => {
    const { activateManagedCloudNodeHeartbeat } = await loadContract();
    const calls: Array<{
      command: string[];
      env: Record<string, string | undefined>;
    }> = [];

    await activateManagedCloudNodeHeartbeat({
      home: '/var/lib/consuelo',
      connectorId: 'connector_ko_cloud_1',
      run: async (input) => {
        calls.push(input);
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    });

    expect(calls.map((call) => call.command)).toEqual([
      ['systemctl', '--user', 'daemon-reload'],
      [
        'systemctl',
        '--user',
        'enable',
        '--now',
        'consuelo-cloudflared-connector-ko-cloud-1.service',
      ],
      [
        'systemctl',
        '--user',
        'enable',
        '--now',
        'consuelo-node-heartbeat.timer',
      ],
    ]);
    expect(
      calls.every((call) => call.env.CONSUELO_HOME === '/var/lib/consuelo'),
    ).toBe(true);

    const runnerFailure = new Error('systemctl transport unavailable');
    await expect(
      activateManagedCloudNodeHeartbeat({
        home: '/var/lib/consuelo',
        connectorId: 'connector_ko_cloud_1',
        run: async () => {
          throw runnerFailure;
        },
      }),
    ).rejects.toMatchObject({
      name: 'ManagedCloudNodeEnrollmentError',
      code: 'HEARTBEAT_ACTIVATION_FAILED',
      cause: runnerFailure,
    });
    expect(
      calls.every(
        (call) =>
          call.env.XDG_CONFIG_HOME ===
          (process.env.XDG_CONFIG_HOME ??
            join(process.env.HOME ?? '/var/lib/consuelo', '.config')),
      ),
    ).toBe(true);
  });
});
