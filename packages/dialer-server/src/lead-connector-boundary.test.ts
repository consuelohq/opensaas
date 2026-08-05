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
    disableInstallation: mock(() =>
      Effect.succeed({ disabled: true as const }),
    ),
    listContacts: mock(() =>
      Effect.succeed({ contacts: [], total: 0, nextCursor: null }),
    ),
    searchOpportunities: mock(() =>
      Effect.succeed({ opportunities: [], total: 0 }),
    ),
    listPipelines: mock(() => Effect.succeed([])),
    resolveQueueCandidates: mock(() =>
      Effect.succeed({
        pipelineId: 'pipeline-1',
        pipelineName: 'Pipeline',
        stageId: 'stage-1',
        stageName: 'Stage',
        opportunityTotal: 0,
        callableTotal: 0,
        truncated: false,
        candidates: [],
      }),
    ),
    recordDisposition: mock(() => Effect.succeed({ recorded: true as const })),
    exchangeEmbedBootstrap: mock(() =>
      Effect.succeed({
        workspaceId: 'workspace-1',
        userId: 'provider-user-1',
        installationId: 'installation-1',
        locationId: 'location-1',
        role: 'admin',
        contextType: 'location' as const,
      }),
    ),
    validateEmbedIdentity: mock(() => Effect.succeed(true)),
  },
});

describe('dialer-server LeadConnector boundary', () => {
  it('persists dispositions locally before mirroring them to LeadConnector', async () => {
    const dependencies = createDependencies();
    const operations: string[] = [];
    dependencies.callOperations = {
      recordDisposition: () =>
        Effect.sync(() => {
          operations.push('local');
        }),
      setCrmSyncStatus: ({ status }: { status: string }) =>
        Effect.sync(() => {
          operations.push(`sync:${status}`);
        }),
    } as unknown as NonNullable<DialerServerDependencies['callOperations']>;
    dependencies.leadConnector!.recordDisposition = mock(() =>
      Effect.sync(() => {
        operations.push('provider');
        return { recorded: true as const };
      }),
    );

    const response = await createDialerServer(dependencies).request(
      '/v1/integrations/leadconnector/dispositions',
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: 'session-1',
          contactId: 'contact-1',
          disposition: 'connected',
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(operations).toEqual(['local', 'provider', 'sync:synced']);
  });

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

  it('schedules commercial uninstall before disabling the provider installation', async () => {
    const dependencies = createDependencies();
    const operations: string[] = [];
    dependencies.leadConnector!.processWebhook = mock(() =>
      Effect.succeed({
        accepted: true as const,
        duplicate: false,
        workspaceId: 'workspace-1',
        event: {
          id: 'uninstall-1',
          type: 'installation.uninstalled' as const,
          workspaceId: 'workspace-1',
          locationId: 'location-1',
          occurredAt: null,
          data: { appId: 'app-1' },
        },
      }),
    );
    dependencies.leadConnector!.disableInstallation = mock(() =>
      Effect.sync(() => {
        operations.push('disable-installation');
        return { disabled: true as const };
      }),
    );
    dependencies.commercial = {
      catalog: () => Effect.die('unused'),
      dashboard: () => Effect.die('unused'),
      updateTeam: () => Effect.die('unused'),
      assignNumber: () => Effect.die('unused'),
      searchNumbers: () => Effect.die('unused'),
      provisionNumber: () => Effect.die('unused'),
      releaseNumber: () => Effect.die('unused'),
      processStripeWebhook: () => Effect.die('unused'),
      processInstallationUninstall: mock((event) =>
        Effect.sync(() => {
          operations.push(`commercial:${event.id}`);
          return { duplicate: false, cancellationScheduled: true };
        }),
      ),
      recordProviderCompletion: () => Effect.die('unused'),
    };

    const response = await createDialerServer(dependencies).request(
      '/v1/webhooks/leadconnector',
      { method: 'POST', body: '{}' },
    );

    expect(response.status).toBe(200);
    expect(operations).toEqual(['commercial:uninstall-1', 'disable-installation']);
    expect(
      dependencies.commercial.processInstallationUninstall,
    ).toHaveBeenCalledWith({
      id: 'uninstall-1',
      workspaceId: 'workspace-1',
      locationId: 'location-1',
      appId: 'app-1',
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
