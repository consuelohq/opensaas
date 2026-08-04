import { describe, expect, it, mock } from 'bun:test';
import { Effect } from 'effect';

import { createDialerServer } from './app';
import type { DialerServerDependencies } from './contracts';

const createDependencies = (): DialerServerDependencies => ({
  application: {
    startCallSession: () => Effect.die('not used'),
    getCallSession: () => Effect.die('not used'),
    terminateCallSession: () => Effect.die('not used'),
    processTwilioStatus: () => Effect.die('not used'),
    generateTwilioCustomerTwiml: () => Effect.die('not used'),
    generateTwilioAgentTwiml: () => Effect.die('not used'),
    markAgentReady: () => Effect.die('not used'),
  },
  authenticate: mock(async () => ({
    workspaceId: 'workspace-1',
    userId: 'user-1',
  })),
  verifyTwilioSignature: mock(async () => true),
  issueEmbedSession: mock(async () => ({
    token: 'embed-token',
    expiresAt: '2026-07-24T02:00:00.000Z',
  })),
  leadConnector: {
    beginOAuth: () => Effect.die('not used'),
    completeOAuth: () => Effect.die('not used'),
    processWebhook: () => Effect.die('not used'),
    listContacts: mock(() =>
      Effect.succeed({ contacts: [], total: 0, nextCursor: null }),
    ),
    searchOpportunities: mock(() =>
      Effect.succeed({ opportunities: [], total: 0 }),
    ),
    listPipelines: mock(() => Effect.succeed([])),
    recordDisposition: mock(() => Effect.succeed({ recorded: true as const })),
    exchangeEmbedBootstrap: mock(() =>
      Effect.succeed({
        workspaceId: 'workspace-1',
        userId: 'provider-user-1',
        installationId: 'installation-1',
        locationId: 'location-1',
      }),
    ),
    validateEmbedIdentity: mock(() => Effect.succeed(true)),
  },
});

const auth = {
  authorization: 'Bearer opaque-token',
  'content-type': 'application/json',
};

describe('dialer-server embed and LeadConnector resources', () => {
  it('exchanges encrypted parent context for a short-lived scoped embed session', async () => {
    const dependencies = createDependencies();
    const response = await createDialerServer(dependencies).request(
      '/v1/embed/session',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ encryptedData: 'opaque-parent-ciphertext' }),
      },
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      token: 'embed-token',
      expiresAt: '2026-07-24T02:00:00.000Z',
    });
    expect(dependencies.issueEmbedSession).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      userId: 'provider-user-1',
      installationId: 'installation-1',
      locationId: 'location-1',
    });
  });

  it('loads contacts, opportunities, and pipelines through thin authenticated handlers', async () => {
    const dependencies = createDependencies();
    const app = createDialerServer(dependencies);
    expect(
      (
        await app.request(
          '/v1/integrations/leadconnector/contacts?query=Ada&limit=25',
          { headers: auth },
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await app.request(
          '/v1/integrations/leadconnector/opportunities/search',
          {
            method: 'POST',
            headers: auth,
            body: JSON.stringify({
              pipelineId: 'pipeline-1',
              stageId: 'stage-1',
            }),
          },
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await app.request('/v1/integrations/leadconnector/pipelines', {
          headers: auth,
        })
      ).status,
    ).toBe(200);
    expect(dependencies.leadConnector?.listContacts).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      query: 'Ada',
      limit: 25,
      cursor: undefined,
    });
    expect(
      dependencies.leadConnector?.searchOpportunities,
    ).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      pipelineId: 'pipeline-1',
      stageId: 'stage-1',
    });
    expect(dependencies.leadConnector?.listPipelines).toHaveBeenCalledWith(
      'workspace-1',
    );
  });

  it('writes a disposition through the provider application without provider logic in the route', async () => {
    const dependencies = createDependencies();
    const response = await createDialerServer(dependencies).request(
      '/v1/integrations/leadconnector/dispositions',
      {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          contactId: 'contact-1',
          disposition: 'connected',
          note: 'Follow up',
          tags: ['called'],
        }),
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      recorded: true,
      crmSyncStatus: 'synced',
    });
    expect(dependencies.leadConnector?.recordDisposition).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      contactId: 'contact-1',
      disposition: 'connected',
      note: 'Follow up',
      tags: ['called'],
    });
  });
});
