import { describe, expect, it } from 'bun:test';

import { createEmbedSessionService } from './embed-session';

describe('dialer-server embed sessions', () => {
  it('issues a short-lived token that authenticates the original workspace and user', async () => {
    const service = createEmbedSessionService({
      secret: 'test-secret-with-sufficient-length',
      ttlSeconds: 300,
      now: () => 1_750_000_000_000,
    });
    const issued = await service.issue({
      workspaceId: 'workspace-1',
      userId: 'user-1',
    });
    expect(issued.expiresAt).toBe('2025-06-15T15:11:40.000Z');
    const identity = await service.authenticate(
      new Request('https://dialer.test/v1/call-sessions', {
        headers: { authorization: `Bearer ${issued.token}` },
      }),
    );
    expect(identity).toEqual({ workspaceId: 'workspace-1', userId: 'user-1' });
    expect(issued.token).not.toContain('workspace-1');
  });

  it('rejects expired, malformed, and tampered tokens', async () => {
    let now = 1_750_000_000_000;
    const service = createEmbedSessionService({
      secret: 'test-secret-with-sufficient-length',
      ttlSeconds: 1,
      now: () => now,
    });
    const issued = await service.issue({
      workspaceId: 'workspace-1',
      userId: 'user-1',
    });
    const request = (token: string) =>
      new Request('https://dialer.test/v1/call-sessions', {
        headers: { authorization: `Bearer ${token}` },
      });
    expect(await service.authenticate(request(`${issued.token}x`))).toBeNull();
    expect(await service.authenticate(request('malformed'))).toBeNull();
    now += 2_000;
    expect(await service.authenticate(request(issued.token))).toBeNull();
  });
});
