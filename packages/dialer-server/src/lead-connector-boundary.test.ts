import { describe, expect, it, mock } from 'bun:test';
import { Effect } from 'effect';
import {
  LeadConnectorOAuthStateError,
  LeadConnectorWebhookSignatureError,
} from '@consuelo/lead-connector';

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
  leadConnector: {
    beginOAuth: mock(() =>
      Effect.succeed({
        authorizationUrl: 'https://provider.test/authorize',
        state: 'state-1',
      }),
    ),
    completeOAuth: mock(() =>
      Effect.succeed({
        workspaceId: 'workspace-1',
        locationId: 'location-1',
        connected: true as const,
      }),
    ),
    processWebhook: mock(() =>
      Effect.succeed({
        accepted: true as const,
        duplicate: false,
        workspaceId: 'workspace-1',
        event: null,
      }),
    ),
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

describe('dialer-server LeadConnector boundary', () => {
  it('preserves the authenticated OAuth start route and legacy response shape', async () => {
    const dependencies = createDependencies();
    const response = await createDialerServer(dependencies).request(
      '/v1/integrations/leadconnector/oauth',
      {
        method: 'POST',
        headers: { authorization: 'Bearer test-token' },
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      redirectUrl: 'https://provider.test/authorize',
      state: 'state-1',
    });
    expect(dependencies.leadConnector?.beginOAuth).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
    });
  });

  it('keeps the OAuth callback public and state-authenticated', async () => {
    const dependencies = createDependencies();
    const response = await createDialerServer(dependencies).request(
      '/v1/integrations/leadconnector/callback?code=code-1&state=state-1',
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      connected: true,
      locationId: 'location-1',
    });
    expect(dependencies.leadConnector?.completeOAuth).toHaveBeenCalledWith({
      code: 'code-1',
      state: 'state-1',
    });
  });

  it('passes raw webhook bytes and provider-owned headers without exposing internal state', async () => {
    const dependencies = createDependencies();
    const body = JSON.stringify({
      webhookId: 'event-1',
      type: 'OpportunityUpdate',
      locationId: 'location-1',
    });
    const response = await createDialerServer(dependencies).request(
      '/v1/webhooks/leadconnector',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-ghl-signature': 'provider-signature',
        },
        body,
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, duplicate: false });
    expect(dependencies.leadConnector?.processWebhook).toHaveBeenCalledWith({
      rawBody: body,
      headers: expect.objectContaining({
        'x-ghl-signature': 'provider-signature',
      }),
    });
  });

  it('maps provider denial, invalid state, and invalid signatures to stable public errors', async () => {
    const deniedDependencies = createDependencies();
    const denied = await createDialerServer(deniedDependencies).request(
      '/v1/integrations/leadconnector/callback?error=access_denied',
    );
    expect(denied.status).toBe(400);
    expect(await denied.json()).toEqual({
      error: {
        code: 'LEADCONNECTOR_AUTH_DENIED',
        message: 'LeadConnector authorization was denied',
        retryable: false,
      },
    });

    const invalidStateDependencies = createDependencies();
    invalidStateDependencies.leadConnector!.completeOAuth = () =>
      Effect.fail(
        new LeadConnectorOAuthStateError({
          code: 'INVALID_OAUTH_STATE',
          message: 'secret state detail',
          retryable: false,
        }),
      );
    const invalidState = await createDialerServer(
      invalidStateDependencies,
    ).request(
      '/v1/integrations/leadconnector/callback?code=code-1&state=state-1',
    );
    expect(invalidState.status).toBe(400);
    expect(await invalidState.json()).toEqual({
      error: {
        code: 'INVALID_OAUTH_STATE',
        message: 'LeadConnector OAuth state is invalid or expired',
        retryable: false,
      },
    });

    const signatureDependencies = createDependencies();
    signatureDependencies.leadConnector!.processWebhook = () =>
      Effect.fail(
        new LeadConnectorWebhookSignatureError({
          code: 'INVALID_WEBHOOK_SIGNATURE',
          message: 'provider signature detail',
          retryable: false,
        }),
      );
    const signature = await createDialerServer(signatureDependencies).request(
      '/v1/webhooks/leadconnector',
      { method: 'POST', body: '{}' },
    );
    expect(signature.status).toBe(401);
    expect(await signature.json()).toEqual({
      error: {
        code: 'INVALID_WEBHOOK_SIGNATURE',
        message: 'LeadConnector webhook signature is invalid',
        retryable: false,
      },
    });
  });
});
