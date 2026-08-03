import { describe, expect, it, mock } from 'bun:test';
import { Effect } from 'effect';

import { createDialerServer } from './app';
import type { DialerServerDependencies } from './contracts';

const principal = {
  workspaceId: 'workspace-1',
  userId: 'provider-user-1',
  installationId: 'installation-1',
  locationId: 'location-1',
};

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
  authenticate: mock(async () => null),
  verifyTwilioSignature: mock(async () => true),
  issueEmbedSession: mock(async () => ({
    token: 'scoped-embed-token',
    expiresAt: '2026-07-24T03:15:00.000Z',
  })),
  leadConnector: {
    beginOAuth: () => Effect.die('not used'),
    completeOAuth: () => Effect.die('not used'),
    processWebhook: () => Effect.die('not used'),
    listContacts: () => Effect.die('not used'),
    searchOpportunities: () => Effect.die('not used'),
    listPipelines: () => Effect.die('not used'),
    recordDisposition: () => Effect.die('not used'),
    exchangeEmbedBootstrap: mock(() => Effect.succeed(principal)),
    validateEmbedIdentity: mock(() => Effect.succeed(true)),
  },
});

describe('dialer-server production embed bootstrap', () => {
  it('exchanges opaque encrypted parent context without accepting browser provider secrets', async () => {
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
      token: 'scoped-embed-token',
      expiresAt: '2026-07-24T03:15:00.000Z',
    });
    expect(dependencies.authenticate).not.toHaveBeenCalled();
    expect(
      dependencies.leadConnector?.exchangeEmbedBootstrap,
    ).toHaveBeenCalledWith({
      encryptedData: 'opaque-parent-ciphertext',
    });
    expect(dependencies.issueEmbedSession).toHaveBeenCalledWith(principal);
  });

  it('rejects malformed bootstrap input before invoking provider application behavior', async () => {
    const dependencies = createDependencies();
    const response = await createDialerServer(dependencies).request(
      '/v1/embed/session',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ encryptedData: '' }),
      },
    );

    expect(response.status).toBe(400);
    expect(
      dependencies.leadConnector?.exchangeEmbedBootstrap,
    ).not.toHaveBeenCalled();
    expect(dependencies.issueEmbedSession).not.toHaveBeenCalled();
  });
});
