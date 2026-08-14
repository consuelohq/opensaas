import { describe, expect, it } from 'vitest';

import {
  CONSUELO_DEVICE_CODE_URL,
  CONSUELO_DEVICE_VERIFICATION_URL,
  CONSUELO_DEVICE_WORKSPACE_URL,
  CONSUELO_OAUTH_ACCESS_TOKEN_URL,
} from '../scripts/lib/workspace-device-authorization';
import {
  generateWorkspaceDeviceKeyPair,
  pollWorkspaceDeviceAccessToken,
  requestWorkspaceDeviceCode,
  selectWorkspaceForDeviceLogin,
  syncWorkspaceAgentStatus,
  type DeviceLoginFetch,
} from '../scripts/lib/workspace-device-login-client';

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    async json() {
      return body;
    },
  };
}

describe('workspace device-login HTTP client', () => {
  it('starts device authorization without pre-auth workspace fields', async () => {
    const deviceKeyPair = generateWorkspaceDeviceKeyPair();
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: DeviceLoginFetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse({
        device_code: 'dev_live_auth_first',
        user_code: 'WXYZ-1234',
        verification_uri: CONSUELO_DEVICE_VERIFICATION_URL,
        verification_uri_complete: CONSUELO_DEVICE_VERIFICATION_URL + '?user_code=WXYZ1234',
        expires_in: 900,
        interval: 5,
      });
    };

    const result = await requestWorkspaceDeviceCode({
      clientId: 'consuelo-os-installer',
      scope: ['workspace:read', 'os:connector:register'],
      deviceKeyPair,
      fetchImpl,
      now: '2026-06-13T00:00:00.000Z',
    });

    expect(result.status).toBe('started');
    expect(calls).toHaveLength(1);
    const requestBody = new URLSearchParams(String(calls[0].init?.body));
    expect(requestBody.get('client_id')).toBe('consuelo-os-installer');
    expect(requestBody.get('scope')).toBe('workspace:read os:connector:register');
    expect(requestBody.get('device_public_key_jwk')).toBe(deviceKeyPair.publicKeyJwk);
    expect(requestBody.get('workspace_name')).toBeNull();
    expect(requestBody.get('workspace_slug')).toBeNull();
    expect(requestBody.get('workspace_host')).toBeNull();
  });

  it('requests a GitHub-shaped device code from consuelohq.com with an optional retained workspace identity', async () => {
    const deviceKeyPair = generateWorkspaceDeviceKeyPair();
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: DeviceLoginFetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse({
        device_code: 'dev_live_123',
        user_code: 'ABCD-EFGH',
        verification_uri: CONSUELO_DEVICE_VERIFICATION_URL,
        verification_uri_complete: `${CONSUELO_DEVICE_VERIFICATION_URL}?user_code=ABCDEFGH`,
        expires_in: 900,
        interval: 5,
      });
    };

    const result = await requestWorkspaceDeviceCode({
      clientId: 'consuelo-os-installer',
      scope: ['workspace:read', 'os:connector:register'],
      workspaceName: 'testing',
      workspaceSlug: 'testing',
      workspaceHost: 'testing.consuelohq.com',
      deviceKeyPair,
      fetchImpl,
      now: '2026-06-13T00:00:00.000Z',
    });

    expect(result.status).toBe('started');
    if (result.status === 'started') {
      expect(result.deviceKeyPair).toBe(deviceKeyPair);
      expect(result.session).toMatchObject({
        deviceCode: 'dev_live_123',
        userCode: 'ABCD-EFGH',
        verificationUri: CONSUELO_DEVICE_VERIFICATION_URL,
        verificationUriComplete: `${CONSUELO_DEVICE_VERIFICATION_URL}?user_code=ABCDEFGH`,
        intervalSeconds: 5,
      });
      expect(result.session.expiresAt).toBe('2026-06-13T00:15:00.000Z');
    }

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(CONSUELO_DEVICE_CODE_URL);
    expect(calls[0].init?.method).toBe('POST');
    const requestBody = new URLSearchParams(String(calls[0].init?.body));
    expect(requestBody.get('client_id')).toBe('consuelo-os-installer');
    expect(requestBody.get('workspace_name')).toBe('testing');
    expect(requestBody.get('scope')).toBe('workspace:read os:connector:register');
    expect(requestBody.get('device_public_key_jwk')).toBe(deviceKeyPair.publicKeyJwk);
    expect(requestBody.get('device_key_algorithm')).toBe('Ed25519');
    expect(String(calls[0].init?.body)).not.toMatch(/password|username|basic_auth/i);
  });

  it('sends device proof when polling for workspace bootstrap material', async () => {
    const deviceKeyPair = generateWorkspaceDeviceKeyPair();
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: DeviceLoginFetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse({
        workspace_id: 'workspace_123',
        workspace_slug: 'testing',
        workspace_host: 'testing.consuelohq.com',
        connector_id: 'connector_123',
        edge_request_signing_secret: 'wen_node_scoped_secret_123',
        connector_bootstrap_token: 'bootstrap_token_123',
        connector_bootstrap_expires_at: '2026-06-13T00:10:00.000Z',
        cloudflare_tunnel_token: 'cloudflared_tunnel_token_fixture',
        device_public_key_thumbprint: 'dpk_123',
        device_public_key_bound: true,
      });
    };

    const result = await pollWorkspaceDeviceAccessToken({
      clientId: 'consuelo-os-installer',
      deviceCode: 'dev_live_123',
      intervalSeconds: 5,
      deviceKeyPair,
      fetchImpl,
    });

    expect(result).toMatchObject({
      status: 'approved',
      workspaceId: 'workspace_123',
      workspaceSlug: 'testing',
      workspaceHost: 'testing.consuelohq.com',
      connectorId: 'connector_123',
      edgeRequestSigningSecret: 'wen_node_scoped_secret_123',
      connectorBootstrapToken: 'bootstrap_token_123',
      connectorBootstrapExpiresAt: '2026-06-13T00:10:00.000Z',
      cloudflareTunnelToken: 'cloudflared_tunnel_token_fixture',
    });
    expect(calls[0].url).toBe(CONSUELO_OAUTH_ACCESS_TOKEN_URL);
    expect(calls[0].init?.method).toBe('POST');
    const tokenRequestBody = new URLSearchParams(String(calls[0].init?.body));
    expect(tokenRequestBody.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:device_code');
    expect(tokenRequestBody.get('device_code')).toBe('dev_live_123');
    expect(tokenRequestBody.get('device_public_key_proof_payload')).toContain('consuelo-os-installer.dev_live_123.dpk_');
    expect(tokenRequestBody.get('device_public_key_proof')).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('maps pending, slow-down, denied, and expired OAuth errors', async () => {
    const makeFetch = (error: string): DeviceLoginFetch => async () =>
      jsonResponse({ error, interval: 5 });

    await expect(pollWorkspaceDeviceAccessToken({
      clientId: 'consuelo-os-installer',
      deviceCode: 'dev_pending',
      intervalSeconds: 5,
      fetchImpl: makeFetch('authorization_pending'),
    })).resolves.toMatchObject({ status: 'pending', intervalSeconds: 5 });

    await expect(pollWorkspaceDeviceAccessToken({
      clientId: 'consuelo-os-installer',
      deviceCode: 'dev_slow',
      intervalSeconds: 5,
      fetchImpl: makeFetch('slow_down'),
    })).resolves.toMatchObject({ status: 'slow_down', intervalSeconds: 10 });

    await expect(pollWorkspaceDeviceAccessToken({
      clientId: 'consuelo-os-installer',
      deviceCode: 'dev_denied',
      intervalSeconds: 5,
      fetchImpl: makeFetch('access_denied'),
    })).resolves.toMatchObject({ status: 'denied', errorCode: 'DEVICE_CODE_DENIED' });

    await expect(pollWorkspaceDeviceAccessToken({
      clientId: 'consuelo-os-installer',
      deviceCode: 'dev_expired',
      intervalSeconds: 5,
      fetchImpl: makeFetch('expired_token'),
    })).resolves.toMatchObject({ status: 'expired', errorCode: 'DEVICE_CODE_EXPIRED' });
  });

  it('should preserve workspace selection server error messages when route setup fails', async () => {
    const deviceKeyPair = generateWorkspaceDeviceKeyPair();
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: DeviceLoginFetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse(
        {
          error: 'workspace_route_setup_failed',
          message: 'missing route registry binding',
        },
        { ok: false, status: 502 },
      );
    };

    const result = await selectWorkspaceForDeviceLogin({
      clientId: 'consuelo-os-installer',
      deviceCode: 'dev_workspace_required',
      intervalSeconds: 5,
      workspaceName: 'testing',
      workspaceSlug: 'testing',
      workspaceHost: 'testing.consuelohq.com',
      deviceKeyPair,
      fetchImpl,
    });

    expect(result).toMatchObject({
      status: 'unavailable',
      message: 'workspace_route_setup_failed: missing route registry binding',
    });
    expect(calls[0].url).toBe(CONSUELO_DEVICE_WORKSPACE_URL);
    const requestBody = new URLSearchParams(String(calls[0].init?.body));
    expect(requestBody.get('workspace_slug')).toBe('testing');
    expect(requestBody.get('workspace_host')).toBe('testing.consuelohq.com');
    expect(requestBody.get('device_public_key_proof')).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('should preserve poll server error messages when token exchange fails', async () => {
    const fetchImpl: DeviceLoginFetch = async () =>
      jsonResponse(
        {
          error: 'temporarily_unavailable',
          message: 'device grant store unavailable',
        },
        { ok: false, status: 503 },
      );

    await expect(pollWorkspaceDeviceAccessToken({
      clientId: 'consuelo-os-installer',
      deviceCode: 'dev_unavailable',
      intervalSeconds: 5,
      fetchImpl,
    })).resolves.toMatchObject({
      status: 'unavailable',
      message: 'temporarily_unavailable: device grant store unavailable',
    });
  });

  it('returns unavailable instead of throwing when website endpoints are offline', async () => {
    const fetchImpl: DeviceLoginFetch = async () => {
      throw new Error('network down');
    };

    await expect(requestWorkspaceDeviceCode({
      clientId: 'consuelo-os-installer',
      scope: ['workspace:read'],
      fetchImpl,
    })).resolves.toMatchObject({ status: 'unavailable' });

    await expect(pollWorkspaceDeviceAccessToken({
      clientId: 'consuelo-os-installer',
      deviceCode: 'dev_live_123',
      intervalSeconds: 5,
      fetchImpl,
    })).resolves.toMatchObject({ status: 'unavailable' });
  });

  it('syncs only verified agent identifiers with the short-lived bootstrap credential', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: DeviceLoginFetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse({
        ok: true,
        connectedAgentCount: 2,
        agents: [
          { name: 'codex', label: 'Codex' },
          { name: 'gemini', label: 'Gemini' },
        ],
      });
    };

    const result = await syncWorkspaceAgentStatus({
      connectorBootstrapToken: 'cbt_status_sync_secret',
      agentNames: ['gemini', 'codex', 'codex'],
      fetchImpl,
    });

    expect(result).toMatchObject({ status: 'synced', connectedAgentCount: 2 });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://os.consuelohq.com/workspace/agents');
    expect(calls[0].init?.method).toBe('POST');
    expect(new Headers(calls[0].init?.headers).get('authorization')).toBe(
      'Bearer cbt_status_sync_secret',
    );
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      agents: ['codex', 'gemini'],
    });
    expect(String(calls[0].init?.body)).not.toMatch(/configPath|homePath|token|secret/i);
  });

  it('returns unavailable when agent-status synchronization cannot reach the control plane', async () => {
    await expect(syncWorkspaceAgentStatus({
      connectorBootstrapToken: 'cbt_status_sync_secret',
      agentNames: ['codex'],
      fetchImpl: async () => {
        throw new Error('network down');
      },
    })).resolves.toMatchObject({
      status: 'unavailable',
      message: 'network down',
    });
  });
});
