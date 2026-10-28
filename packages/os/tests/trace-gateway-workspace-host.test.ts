import { describe, expect, it } from 'vitest';

import { resolveTraceWorkspaceHost } from '../scripts/server/services/trace-gateway';

describe('trace gateway workspace host resolution', () => {
  it('should substitute the configured workspace host when request host is loopback on a custom port', () => {
    const request = new Request('http://127.0.0.1:47001/gateway/traces/recent');

    expect(
      resolveTraceWorkspaceHost({
        request,
        scopeWorkspaceHost: '127.0.0.1:47001',
        configuredWorkspaceHost: 'testing.consuelohq.com',
      }),
    ).toBe('testing.consuelohq.com');
  });

  it('should preserve an explicit workspace host header when request host is loopback', () => {
    const request = new Request('http://127.0.0.1:47001/gateway/traces/recent', {
      headers: { 'x-consuelo-workspace-host': 'explicit.consuelohq.com' },
    });

    expect(
      resolveTraceWorkspaceHost({
        request,
        scopeWorkspaceHost: 'explicit.consuelohq.com',
        configuredWorkspaceHost: 'testing.consuelohq.com',
      }),
    ).toBe('explicit.consuelohq.com');
  });

  it('should preserve a non-loopback request-derived workspace host', () => {
    const request = new Request('https://other.consuelohq.com/gateway/traces/recent');

    expect(
      resolveTraceWorkspaceHost({
        request,
        scopeWorkspaceHost: 'other.consuelohq.com',
        configuredWorkspaceHost: 'testing.consuelohq.com',
      }),
    ).toBe('other.consuelohq.com');
  });
});
