import { describe, expect, it } from 'vitest';

import { exchangeMcpOAuthToken } from '../cloudflare/os-device-authority/src/services/mcp-oauth';
import { createMemoryDeviceGrantStore } from '../cloudflare/os-device-authority/src/stores';
import type { Store } from '../cloudflare/os-device-authority/src/types';
import { hash } from '../cloudflare/os-device-authority/src/utils';

const NOW_MS = Date.parse('2026-07-26T12:00:00.000Z');
const RESOURCE = 'https://os.consuelohq.com/mcp';
const CLIENT_ID = 'chatgpt-consuelo-os';
const ORIGINAL_REFRESH_TOKEN = 'cor_original_refresh_token';
const REPLAY_WINDOW_MS = 60_000;

function form(data: Record<string, string>): Request {
  return new Request('https://os.consuelohq.com/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(data).toString(),
  });
}

async function seedRefreshToken(store: Store): Promise<void> {
  await store.putMcpOAuthRefreshToken({
    tokenHash: await hash(ORIGINAL_REFRESH_TOKEN),
    clientId: CLIENT_ID,
    scope: 'mcp:read mcp:call route:/mcp:read',
    scopes: ['mcp:read', 'mcp:call', 'route:/mcp:read'],
    resource: RESOURCE,
    workspaceHost: 'internal.consuelohq.com',
    accountId: 'google:account-1',
    email: 'ko@example.com',
    issuedAt: NOW_MS,
    expiresAt: NOW_MS + 30 * 24 * 60 * 60 * 1000,
  });
}

async function refresh(
  store: Store,
  nowMs = NOW_MS,
  overrides: Record<string, string> = {},
): Promise<Response> {
  return exchangeMcpOAuthToken({
    store,
    nowMs,
    request: form({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: ORIGINAL_REFRESH_TOKEN,
      resource: RESOURCE,
      ...overrides,
    }),
  });
}

async function body(response: Response): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

describe('MCP OAuth refresh-token rotation', () => {
  it('returns a one-hour access token and replays the same rotation after an interrupted response', async () => {
    const store = createMemoryDeviceGrantStore();
    await seedRefreshToken(store);

    const firstResponse = await refresh(store);
    const firstBody = await body(firstResponse);
    const retryResponse = await refresh(store);
    const retryBody = await body(retryResponse);

    expect(firstResponse.status).toBe(200);
    expect(firstBody.expires_in).toBe(60 * 60);
    expect(firstBody.access_token).toMatch(/^coa_/);
    expect(firstBody.refresh_token).toMatch(/^cor_/);
    expect(retryResponse.status).toBe(200);
    expect(retryBody).toEqual(firstBody);
  });

  it('collapses concurrent duplicate refresh requests into one credential family', async () => {
    const base = createMemoryDeviceGrantStore();
    await seedRefreshToken(base);

    let reads = 0;
    let releaseReads!: () => void;
    const readsReleased = new Promise<void>((resolve) => {
      releaseReads = resolve;
    });
    const store: Store = {
      ...base,
      async byMcpOAuthRefreshToken(tokenHash) {
        const stored = await base.byMcpOAuthRefreshToken(tokenHash);
        reads += 1;
        if (reads === 2) releaseReads();
        await readsReleased;
        return stored;
      },
    };

    const [firstResponse, secondResponse] = await Promise.all([
      refresh(store),
      refresh(store),
    ]);
    const [firstBody, secondBody] = await Promise.all([
      body(firstResponse),
      body(secondResponse),
    ]);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(secondBody).toEqual(firstBody);
  });

  it('keeps the original refresh token usable when replacement persistence fails', async () => {
    const base = createMemoryDeviceGrantStore();
    await seedRefreshToken(base);

    let failReplacement = true;
    const store: Store = {
      ...base,
      async rotateMcpOAuthRefreshToken(input) {
        if (failReplacement) {
          failReplacement = false;
          throw new Error('transient replacement persistence failure');
        }
        return base.rotateMcpOAuthRefreshToken(input);
      },
    };

    const failedResponse = await refresh(store);
    expect(failedResponse.status).toBe(500);
    await expect(body(failedResponse)).resolves.toMatchObject({
      error: 'server_error',
    });

    const retryResponse = await refresh(store);
    expect(retryResponse.status).toBe(200);
    await expect(body(retryResponse)).resolves.toMatchObject({
      access_token: expect.stringMatching(/^coa_/),
      refresh_token: expect.stringMatching(/^cor_/),
    });
  });

  it('limits replay to the identical request and a bounded retry window', async () => {
    const store = createMemoryDeviceGrantStore();
    await seedRefreshToken(store);

    const firstResponse = await refresh(store);
    expect(firstResponse.status).toBe(200);

    const changedScopeResponse = await refresh(store, NOW_MS, {
      scope: 'mcp:read',
    });
    expect(changedScopeResponse.status).toBe(400);
    await expect(body(changedScopeResponse)).resolves.toMatchObject({
      error: 'invalid_grant',
    });

    const expiredReplayResponse = await refresh(
      store,
      NOW_MS + REPLAY_WINDOW_MS + 1,
    );
    expect(expiredReplayResponse.status).toBe(400);
    await expect(body(expiredReplayResponse)).resolves.toMatchObject({
      error: 'invalid_grant',
    });
  });
});
