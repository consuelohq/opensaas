import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

type WorkspaceDeviceAuthorizationSession = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresAt: string;
  intervalSeconds: number;
  workspaceHost?: never;
  connectorBootstrap?: never;
};

type WorkspaceDeviceAuthorizationPollResult =
  | {
      status: 'pending' | 'slow_down';
      intervalSeconds: number;
      connectorBootstrap?: never;
    }
  | {
      status: 'approved';
      workspaceId: string;
      workspaceSlug: string;
      workspaceHost: string;
      connectorId: string;
      connectorBootstrapToken: string;
      connectorBootstrapExpiresAt: string;
      cloudflareTunnelToken?: string;
    }
  | { status: 'denied' | 'expired'; errorCode: string };

type WorkspaceDeviceAuthorizationContract = {
  CONSUELO_DEVICE_VERIFICATION_URL: string;
  CONSUELO_DEVICE_CODE_URL: string;
  CONSUELO_OAUTH_ACCESS_TOKEN_URL: string;
  startWorkspaceDeviceAuthorization: (input: {
    clientId: string;
    scope: string[];
    verificationBaseUrl?: string;
    now?: string;
  }) => WorkspaceDeviceAuthorizationSession;
  pollWorkspaceDeviceAuthorization: (input: {
    deviceCode: string;
    now?: string;
    approve?: {
      workspaceId: string;
      workspaceSlug: string;
      workspaceHost: string;
      connectorId: string;
      cloudflareTunnelToken?: string;
    };
    deny?: boolean;
  }) => WorkspaceDeviceAuthorizationPollResult;
};

const runContract =
  process.env.CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS === '1';
const contractDescribe = runContract ? describe : describe.skip;

async function loadWorkspaceDeviceAuthorizationContract(): Promise<WorkspaceDeviceAuthorizationContract> {
  const modulePath = pathToFileURL(
    join(process.cwd(), 'scripts', 'lib', 'workspace-device-authorization.ts'),
  ).href;
  const module = (await import(
    modulePath
  )) as Partial<WorkspaceDeviceAuthorizationContract>;
  const requiredExports: Array<keyof WorkspaceDeviceAuthorizationContract> = [
    'CONSUELO_DEVICE_VERIFICATION_URL',
    'CONSUELO_DEVICE_CODE_URL',
    'CONSUELO_OAUTH_ACCESS_TOKEN_URL',
    'startWorkspaceDeviceAuthorization',
    'pollWorkspaceDeviceAuthorization',
  ];
  const missingExports = requiredExports.filter(
    (name) => module[name] === undefined,
  );

  if (missingExports.length > 0) {
    throw new Error(
      `workspace device authorization contract module is missing exports: ${missingExports.join(', ')}`,
    );
  }

  return module as WorkspaceDeviceAuthorizationContract;
}

contractDescribe('workspace OAuth device authorization contract', () => {
  it('should expose GitHub-style OAuth device endpoint paths on os.consuelohq.com', async () => {
    const contract = await loadWorkspaceDeviceAuthorizationContract();

    expect(contract.CONSUELO_DEVICE_VERIFICATION_URL).toBe('https://os.consuelohq.com/login/device');
    expect(contract.CONSUELO_DEVICE_CODE_URL).toBe('https://os.consuelohq.com/login/device/code');
    expect(contract.CONSUELO_OAUTH_ACCESS_TOKEN_URL).toBe('https://os.consuelohq.com/login/oauth/access_token');
    expect(JSON.stringify(contract)).not.toContain('app.consuelohq.com');
  });

  it('should start onboarding with a device code and no OS or tunnel credentials before approval', async () => {
    const {
      CONSUELO_DEVICE_VERIFICATION_URL,
      startWorkspaceDeviceAuthorization,
    } = await loadWorkspaceDeviceAuthorizationContract();

    const session = startWorkspaceDeviceAuthorization({
      clientId: 'consuelo-os-installer',
      scope: ['workspace:read', 'os:connector:register'],
      now: '2026-06-11T00:00:00.000Z',
    });

    expect(session.deviceCode).toMatch(/^dev_[a-zA-Z0-9_-]{24,}$/);
    expect(session.userCode).toMatch(/^[A-Z0-9-]{8,}$/);
    expect(session.verificationUri).toBe(CONSUELO_DEVICE_VERIFICATION_URL);
    expect(session.verificationUriComplete).toContain(session.userCode.replace(/-/g, ''));
    expect(session.intervalSeconds).toBeGreaterThanOrEqual(5);
    expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(
      new Date('2026-06-11T00:00:00.000Z').getTime(),
    );
    expect(JSON.stringify(session)).not.toMatch(/token|credential|secret|tunnel/i);
  });

  it('should require polling clients to respect pending and slow-down intervals', async () => {
    const { startWorkspaceDeviceAuthorization, pollWorkspaceDeviceAuthorization } =
      await loadWorkspaceDeviceAuthorizationContract();
    const session = startWorkspaceDeviceAuthorization({
      clientId: 'consuelo-os-installer',
      scope: ['workspace:read', 'os:connector:register'],
      now: '2026-06-11T00:00:00.000Z',
    });

    const pending = pollWorkspaceDeviceAuthorization({
      deviceCode: session.deviceCode,
      now: '2026-06-11T00:00:01.000Z',
    });
    const tooFast = pollWorkspaceDeviceAuthorization({
      deviceCode: session.deviceCode,
      now: '2026-06-11T00:00:02.000Z',
    });

    expect(pending).toMatchObject({
      status: 'pending',
      intervalSeconds: session.intervalSeconds,
    });
    expect(tooFast).toMatchObject({
      status: 'slow_down',
      intervalSeconds: session.intervalSeconds + 5,
    });
  });

  it('should exchange an approved device grant for workspace identity and scoped bootstrap material', async () => {
    const { startWorkspaceDeviceAuthorization, pollWorkspaceDeviceAuthorization } =
      await loadWorkspaceDeviceAuthorizationContract();
    const session = startWorkspaceDeviceAuthorization({
      clientId: 'consuelo-os-installer',
      scope: ['workspace:read', 'os:connector:register'],
      now: '2026-06-11T00:00:00.000Z',
    });

    const approved = pollWorkspaceDeviceAuthorization({
      deviceCode: session.deviceCode,
      now: '2026-06-11T00:00:10.000Z',
      approve: {
        workspaceId: 'workspace_123',
        workspaceSlug: 'kokayi',
        workspaceHost: 'kokayi.consuelohq.com',
        connectorId: 'connector_123',
        cloudflareTunnelToken: 'cloudflared_tunnel_token_fixture',
      },
    });

    expect(approved).toMatchObject({
      status: 'approved',
      workspaceId: 'workspace_123',
      workspaceSlug: 'kokayi',
      workspaceHost: 'kokayi.consuelohq.com',
      connectorId: 'connector_123',
      cloudflareTunnelToken: 'cloudflared_tunnel_token_fixture',
    });
    expect(approved).toHaveProperty('connectorBootstrapToken');
    expect(JSON.stringify(approved)).not.toMatch(/cloudflare_api_token|edge_signing_secret/i);
    if (approved.status === 'approved') {
      expect(new Date(approved.connectorBootstrapExpiresAt).getTime()).toBeLessThanOrEqual(
        new Date('2026-06-11T00:15:10.000Z').getTime(),
      );
    }
  });

  it('should fail closed for expired, unknown, or denied device codes', async () => {
    const { startWorkspaceDeviceAuthorization, pollWorkspaceDeviceAuthorization } =
      await loadWorkspaceDeviceAuthorizationContract();
    const session = startWorkspaceDeviceAuthorization({
      clientId: 'consuelo-os-installer',
      scope: ['workspace:read', 'os:connector:register'],
      now: '2026-06-11T00:00:00.000Z',
    });

    expect(
      pollWorkspaceDeviceAuthorization({
        deviceCode: 'dev_missing',
        now: '2026-06-11T00:00:10.000Z',
      }),
    ).toMatchObject({ status: 'denied', errorCode: 'DEVICE_CODE_NOT_FOUND' });
    const deniedSession = startWorkspaceDeviceAuthorization({
      clientId: 'consuelo-os-installer',
      scope: ['workspace:read', 'os:connector:register'],
      now: '2026-06-11T00:00:00.000Z',
    });

    expect(
      pollWorkspaceDeviceAuthorization({
        deviceCode: deniedSession.deviceCode,
        now: '2026-06-11T00:00:10.000Z',
        deny: true,
      }),
    ).toMatchObject({ status: 'denied', errorCode: 'DEVICE_CODE_DENIED' });
    expect(
      pollWorkspaceDeviceAuthorization({
        deviceCode: session.deviceCode,
        now: '2026-06-11T00:30:00.000Z',
      }),
    ).toMatchObject({ status: 'expired', errorCode: 'DEVICE_CODE_EXPIRED' });
  });
});
