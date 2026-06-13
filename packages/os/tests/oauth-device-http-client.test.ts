import { describe, expect, it } from 'vitest';

import {
  CONSUELO_DEVICE_CODE_URL,
  CONSUELO_DEVICE_VERIFICATION_URL,
  CONSUELO_OAUTH_ACCESS_TOKEN_URL,
} from '../scripts/lib/workspace-device-authorization';
import {
  pollWorkspaceDeviceAccessToken,
  requestWorkspaceDeviceCode,
  type DeviceLoginFetch,
} from '../scripts/lib/workspace-device-login-client';

const devicePublicKeyJwk = JSON.stringify({
  kty: 'OKP',
  crv: 'Ed25519',
  x: '8Jt6QxQYJkVd4Zg7mWkH3mQ5b7Y2nLz7YdN3wB2p9aA',
});

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
  it('requests a GitHub-shaped device code from consuelohq.com with a device public key', async () => {
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
      devicePublicKeyJwk,
      fetchImpl,
      now: '2026-06-13T00:00:00.000Z',
    });

    expect(result.status).toBe('started');
    if (result.status === 'started') {
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
    expect(requestBody.get('device_public_key_jwk')).toBe(devicePublicKeyJwk);
    expect(requestBody.get('device_key_algorithm')).toBe('Ed25519');
    expect(String(calls[0].init?.body)).not.toMatch(/password|username|basic_auth/i);
  });

  it('maps an approved token response to workspace bootstrap material', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: DeviceLoginFetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse({
        workspace_id: 'workspace_123',
        workspace_slug: 'testing',
        workspace_host: 'testing.consuelohq.com',
        connector_id: 'connector_123',
        connector_bootstrap_token: 'bootstrap_token_123',
        connector_bootstrap_expires_at: '2026-06-13T00:10:00.000Z',
        device_public_key_thumbprint: 'dpk_123',
        device_public_key_bound: true,
      });
    };

    const result = await pollWorkspaceDeviceAccessToken({
      clientId: 'consuelo-os-installer',
      deviceCode: 'dev_live_123',
      intervalSeconds: 5,
      fetchImpl,
    });

    expect(result).toMatchObject({
      status: 'approved',
      workspaceId: 'workspace_123',
      workspaceSlug: 'testing',
      workspaceHost: 'testing.consuelohq.com',
      connectorId: 'connector_123',
      connectorBootstrapToken: 'bootstrap_token_123',
      connectorBootstrapExpiresAt: '2026-06-13T00:10:00.000Z',
    });
    expect(calls[0].url).toBe(CONSUELO_OAUTH_ACCESS_TOKEN_URL);
    expect(calls[0].init?.method).toBe('POST');
    expect(String(calls[0].init?.body)).toContain('grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code');
    expect(String(calls[0].init?.body)).toContain('device_code=dev_live_123');
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

  it('returns unavailable instead of throwing when website endpoints are offline', async () => {
    const fetchImpl: DeviceLoginFetch = async () => {
      throw new Error('network down');
    };

    await expect(requestWorkspaceDeviceCode({
      clientId: 'consuelo-os-installer',
      scope: ['workspace:read'],
      workspaceName: 'testing',
      workspaceSlug: 'testing',
      workspaceHost: 'testing.consuelohq.com',
      fetchImpl,
    })).resolves.toMatchObject({ status: 'unavailable' });

    await expect(pollWorkspaceDeviceAccessToken({
      clientId: 'consuelo-os-installer',
      deviceCode: 'dev_live_123',
      intervalSeconds: 5,
      fetchImpl,
    })).resolves.toMatchObject({ status: 'unavailable' });
  });
});
