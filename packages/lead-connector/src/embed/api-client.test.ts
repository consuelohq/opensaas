import { describe, expect, it } from 'bun:test';

import {
  EmbedSessionExpiredError,
  createLeadConnectorEmbedApi,
  type EmbedFetch,
} from './api-client';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('LeadConnector embed API client', () => {
  it('uses authenticated server contracts for session, resources, calls, status, termination, and dispositions', async () => {
    const requests: Request[] = [];
    const fetcher: EmbedFetch = async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      const path = new URL(request.url).pathname;
      if (path === '/v1/embed/session')
        return jsonResponse({
          token: 'embed-token',
          expiresAt: '2026-07-24T02:00:00.000Z',
        });
      if (path.endsWith('/contacts'))
        return jsonResponse({ contacts: [], total: 0, nextCursor: null });
      if (path.endsWith('/opportunities/search'))
        return jsonResponse({ opportunities: [], total: 0 });
      if (path.endsWith('/pipelines')) return jsonResponse({ pipelines: [] });
      if (path === '/v1/call-sessions' && request.method === 'POST')
        return jsonResponse(
          {
            sessionId: 'session-1',
            providerGroupId: 'group-1',
            status: 'dialing',
            calls: [],
          },
          201,
        );
      if (path === '/v1/call-sessions/group-1' && request.method === 'GET')
        return jsonResponse({
          groupId: 'group-1',
          status: 'dialing',
          winnerSid: null,
          winner: null,
          calls: [],
        });
      if (path.endsWith('/terminate'))
        return jsonResponse({ groupId: 'group-1', status: 'completed' });
      if (path.endsWith('/dispositions'))
        return jsonResponse({ recorded: true });
      return jsonResponse({ error: { code: 'NOT_FOUND' } }, 404);
    };
    const api = createLeadConnectorEmbedApi({
      baseUrl: 'https://dialer.test',
      fetch: fetcher,
    });
    const session = await api.createEmbedSession('opaque-parent-ciphertext');
    api.setSessionToken(session.token);
    await api.listContacts({ query: 'Ada' });
    await api.searchOpportunities({
      pipelineId: 'pipeline-1',
      stageId: 'stage-1',
    });
    await api.listPipelines();
    await api.startCallSession({
      source: 'direct',
      selectionStrategy: 'single',
      requestedFanout: 1,
      targetPhone: '+15550100123',
      contactId: 'contact-1',
    });
    await api.getCallSession('group-1');
    await api.terminateCallSession('group-1');
    await api.recordDisposition({
      contactId: 'contact-1',
      disposition: 'connected',
      note: 'Follow up',
      tags: ['called'],
    });
    expect(requests).toHaveLength(8);
    expect(requests[0]?.headers.get('authorization')).toBeNull();
    expect(await requests[0]?.json()).toEqual({
      encryptedData: 'opaque-parent-ciphertext',
    });
    for (const request of requests.slice(1))
      expect(request.headers.get('authorization')).toBe('Bearer embed-token');
  });

  it('raises a typed expiration error for an expired embed session', async () => {
    const api = createLeadConnectorEmbedApi({
      baseUrl: 'https://dialer.test',
      fetch: async () => jsonResponse({ error: { code: 'UNAUTHORIZED' } }, 401),
    });
    api.setSessionToken('expired');
    await expect(api.listPipelines()).rejects.toBeInstanceOf(
      EmbedSessionExpiredError,
    );
  });
});
