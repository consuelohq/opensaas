import { describe, expect, it } from 'vitest';

import {
  buildWorkspaceSessionCookie,
  createMemoryWorkspaceHandoffStore,
  normalizeAuthReturnPath,
  resolveMembershipChoice,
  UNIVERSAL_AUTH_ROUTE_MATRIX,
} from '../cloudflare/os-device-authority/src/security/web-auth-contract';

describe('OS web authentication contract', () => {
  it('accepts only local return paths', () => {
    expect(normalizeAuthReturnPath('/settings?tab=agents')).toBe('/settings?tab=agents');
    expect(normalizeAuthReturnPath('https://evil.example/steal')).toBe('/');
    expect(normalizeAuthReturnPath('//evil.example/steal')).toBe('/');
    expect(normalizeAuthReturnPath('/\\evil.example')).toBe('/');
    expect(normalizeAuthReturnPath('javascript:alert(1)')).toBe('/');
  });

  it('separates zero, one, and multiple workspace membership outcomes', () => {
    expect(resolveMembershipChoice([])).toEqual({ kind: 'none' });
    expect(resolveMembershipChoice([{ workspaceId: 'w1', workspaceHost: 'one.consuelohq.com' }])).toEqual({
      kind: 'single',
      workspaceId: 'w1',
      workspaceHost: 'one.consuelohq.com',
    });
    expect(resolveMembershipChoice([
      { workspaceId: 'w1', workspaceHost: 'one.consuelohq.com' },
      { workspaceId: 'w2', workspaceHost: 'two.consuelohq.com' },
    ])).toEqual({ kind: 'multiple', count: 2 });
  });

  it('consumes short-lived handoffs once and only for the intended workspace audience', async () => {
    const store = createMemoryWorkspaceHandoffStore();
    const handoff = await store.issue({
      accountId: 'acct_1',
      workspaceId: 'workspace_1',
      workspaceHost: 'one.consuelohq.com',
      returnPath: '/agents',
      nowMs: 1_000,
      ttlMs: 30_000,
    });

    await expect(store.consume({ token: handoff.token, audience: 'two.consuelohq.com', nowMs: 2_000 }))
      .resolves.toEqual({ ok: false, error: 'invalid_handoff' });
    await expect(store.consume({ token: handoff.token, audience: 'one.consuelohq.com', nowMs: 2_000 }))
      .resolves.toMatchObject({ ok: true, workspaceId: 'workspace_1', returnPath: '/agents' });
    await expect(store.consume({ token: handoff.token, audience: 'one.consuelohq.com', nowMs: 2_001 }))
      .resolves.toEqual({ ok: false, error: 'invalid_handoff' });

    const expired = await store.issue({
      accountId: 'acct_1',
      workspaceId: 'workspace_1',
      workspaceHost: 'one.consuelohq.com',
      returnPath: '/',
      nowMs: 5_000,
      ttlMs: 10,
    });
    await expect(store.consume({ token: expired.token, audience: 'one.consuelohq.com', nowMs: 5_011 }))
      .resolves.toEqual({ ok: false, error: 'invalid_handoff' });
  });

  it('builds a host-only secure workspace session cookie', () => {
    const cookie = buildWorkspaceSessionCookie({ value: 'session-token', maxAgeSeconds: 900 });
    expect(cookie).toContain('__Host-consuelo_os_session=session-token');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).not.toContain('Domain=');
  });

  it('documents public, protected, and preserved protocol routes', () => {
    expect(UNIVERSAL_AUTH_ROUTE_MATRIX).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: 'GET', path: '/', access: 'public-preauth' }),
      expect.objectContaining({ method: 'GET', path: '/login/google/start', access: 'public-oauth' }),
      expect.objectContaining({ method: 'GET', path: '/auth/consume', access: 'public-handoff-consumer' }),
      expect.objectContaining({ method: 'ALL', path: '/oauth/authorize', access: 'preserved-mcp-oauth' }),
      expect.objectContaining({ method: 'ALL', path: '/mcp/*', access: 'preserved-bearer' }),
      expect.objectContaining({ method: 'GET', path: '/workspace/agents', access: 'public-sanitized-status' }),
    ]));
  });
});
