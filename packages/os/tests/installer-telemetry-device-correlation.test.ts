import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { INSTALL_ID_HEADER } from '../scripts/lib/install-telemetry-contract';
import {
  generateWorkspaceDeviceKeyPair,
  pollWorkspaceDeviceAccessToken,
  requestWorkspaceDeviceCode,
  selectWorkspaceForDeviceLogin,
  syncWorkspaceAgentStatus,
  type DeviceLoginFetch,
} from '../scripts/lib/workspace-device-login-client';

const INSTALL_ID = 'ins_11111111-1111-4111-8111-111111111111' as const;

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    async json() {
      return body;
    },
  };
}

function headerValue(init: RequestInit | undefined, name: string): string | null {
  return new Headers(init?.headers).get(name);
}

describe('installer telemetry device correlation', () => {
  it('propagates install id to machine requests without adding it to human verification URLs', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const deviceKeyPair = generateWorkspaceDeviceKeyPair();
    const fetchImpl: DeviceLoginFetch = async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith('/login/device/code')) {
        return jsonResponse({
          device_code: 'dev_secret',
          user_code: 'ABCD-EFGH',
          verification_uri: 'https://os.consuelohq.com/login/device',
          verification_uri_complete:
            'https://os.consuelohq.com/login/device?user_code=ABCDEFGH',
          expires_in: 900,
          interval: 5,
        });
      }
      if (String(url).endsWith('/login/oauth/access_token')) {
        return jsonResponse({ error: 'authorization_pending', interval: 5 });
      }
      if (String(url).endsWith('/login/device/workspace')) {
        return jsonResponse({ error: 'workspace_required', interval: 5 });
      }
      return jsonResponse({ ok: true, connectedAgentCount: 0 });
    };

    const started = await requestWorkspaceDeviceCode({
      installId: INSTALL_ID,
      clientId: 'consuelo-os-installer',
      scope: ['workspace:read'],
      deviceKeyPair,
      fetchImpl,
    });
    expect(started.status).toBe('started');
    if (started.status !== 'started') throw new Error('device code did not start');
    expect(started.session.verificationUriComplete).not.toContain(INSTALL_ID);

    await pollWorkspaceDeviceAccessToken({
      installId: INSTALL_ID,
      clientId: 'consuelo-os-installer',
      deviceCode: 'dev_secret',
      intervalSeconds: 5,
      deviceKeyPair,
      fetchImpl,
    });
    await selectWorkspaceForDeviceLogin({
      installId: INSTALL_ID,
      clientId: 'consuelo-os-installer',
      deviceCode: 'dev_secret',
      intervalSeconds: 5,
      workspaceName: 'testing',
      workspaceSlug: 'testing',
      workspaceHost: 'testing.consuelohq.com',
      deviceKeyPair,
      fetchImpl,
    });
    await syncWorkspaceAgentStatus({
      installId: INSTALL_ID,
      connectorBootstrapToken: 'cbt_secret',
      agentNames: [],
      fetchImpl,
    });

    expect(calls).toHaveLength(4);
    for (const call of calls) {
      expect(headerValue(call.init, INSTALL_ID_HEADER)).toBe(INSTALL_ID);
      expect(call.url).not.toContain(INSTALL_ID);
    }
  });

  it('parses canonical user identity only from an explicit user_id field', async () => {
    const deviceKeyPair = generateWorkspaceDeviceKeyPair();
    const fetchImpl: DeviceLoginFetch = async () =>
      jsonResponse({
        user_id: 'user_canonical_123',
        account_id: 'google:provider-sub-must-not-win',
        workspace_id: 'workspace_123',
        workspace_slug: 'testing',
        workspace_host: 'testing.consuelohq.com',
        node_id: 'node_123',
        connector_id: 'connector_123',
        connector_bootstrap_token: 'cbt_secret',
        connector_bootstrap_expires_at: '2026-08-13T18:00:00.000Z',
      });

    const result = await pollWorkspaceDeviceAccessToken({
      installId: INSTALL_ID,
      clientId: 'consuelo-os-installer',
      deviceCode: 'dev_secret',
      intervalSeconds: 5,
      deviceKeyPair,
      fetchImpl,
    });

    expect(result).toMatchObject({
      status: 'approved',
      userId: 'user_canonical_123',
      workspaceId: 'workspace_123',
      nodeId: 'node_123',
    });
  });

  it('never promotes provider-shaped account ids into canonical dashboard identity', async () => {
    const fetchImpl: DeviceLoginFetch = async () =>
      jsonResponse({
        account_id: 'google:provider-sub',
        workspace_id: 'workspace_123',
        workspace_slug: 'testing',
        workspace_host: 'testing.consuelohq.com',
        node_id: 'node_123',
        connector_id: 'connector_123',
        connector_bootstrap_token: 'cbt_secret',
        connector_bootstrap_expires_at: '2026-08-13T18:00:00.000Z',
      });

    const result = await pollWorkspaceDeviceAccessToken({
      installId: INSTALL_ID,
      clientId: 'consuelo-os-installer',
      deviceCode: 'dev_secret',
      intervalSeconds: 5,
      fetchImpl,
    });

    expect(result).toMatchObject({ status: 'approved', workspaceId: 'workspace_123' });
    expect(result).not.toHaveProperty('userId');
  });

  it('returns Branch 1 stable error codes for expected device-auth failures', async () => {
    const requestUnavailable = await requestWorkspaceDeviceCode({
      installId: INSTALL_ID,
      clientId: 'consuelo-os-installer',
      scope: ['workspace:read'],
      fetchImpl: async () => {
        throw new Error('network down');
      },
    });
    expect(requestUnavailable).toMatchObject({
      status: 'unavailable',
      telemetryErrorCode: 'DEVICE_CODE_REQUEST_FAILED',
    });

    const denied = await pollWorkspaceDeviceAccessToken({
      installId: INSTALL_ID,
      clientId: 'consuelo-os-installer',
      deviceCode: 'dev_secret',
      intervalSeconds: 5,
      fetchImpl: async () => jsonResponse({ error: 'access_denied' }),
    });
    expect(denied).toMatchObject({
      status: 'denied',
      telemetryErrorCode: 'DEVICE_AUTH_DENIED',
    });

    const expired = await pollWorkspaceDeviceAccessToken({
      installId: INSTALL_ID,
      clientId: 'consuelo-os-installer',
      deviceCode: 'dev_secret',
      intervalSeconds: 5,
      fetchImpl: async () => jsonResponse({ error: 'expired_token' }),
    });
    expect(expired).toMatchObject({
      status: 'expired',
      telemetryErrorCode: 'DEVICE_AUTH_EXPIRED',
    });

    const pollUnavailable = await pollWorkspaceDeviceAccessToken({
      installId: INSTALL_ID,
      clientId: 'consuelo-os-installer',
      deviceCode: 'dev_secret',
      intervalSeconds: 5,
      fetchImpl: async () => {
        throw new Error('network down');
      },
    });
    expect(pollUnavailable).toMatchObject({
      status: 'unavailable',
      telemetryErrorCode: 'DEVICE_AUTH_UNAVAILABLE',
    });
  });

  it('keeps one correlation id across hosted bootstrap, installer, and background service phases', () => {
    const bootstrap = readFileSync(join(process.cwd(), 'scripts/bootstrap.sh'), 'utf8');
    const daemonInstaller = readFileSync(
      join(process.cwd(), 'scripts/install-system-daemons.sh'),
      'utf8',
    );

    expect(bootstrap).toContain('CONSUELO_INSTALL_ID');
    expect(bootstrap).toContain('export CONSUELO_INSTALL_ID');
    expect(bootstrap).toContain('install-system-daemons.sh --quiet');
    expect(daemonInstaller).toContain('CONSUELO_INSTALL_ID');
    expect(daemonInstaller).toContain('BACKGROUND_SERVICE_INSTALL_FAILED');
    expect(daemonInstaller).toContain('BACKGROUND_SERVICE_START_FAILED');
    expect(daemonInstaller).toContain('BACKGROUND_SERVICE_HEALTHCHECK_FAILED');
  });
});
