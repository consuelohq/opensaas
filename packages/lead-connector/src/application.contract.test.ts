import { describe, expect, it } from 'bun:test';
import { Effect, Either, Layer } from 'effect';

import {
  LEAD_CONNECTOR_API_VERSION,
  LeadConnectorClock,
  LeadConnectorConfig,
  LeadConnectorHttpTransport,
  LeadConnectorInstallationOwnershipError,
  LeadConnectorInstallationStore,
  type LeadConnectorInstallationStoreService,
  LeadConnectorOAuthStateError,
  LeadConnectorOAuthStateStore,
  type LeadConnectorOAuthStateStoreService,
  LeadConnectorRandom,
  LeadConnectorTokenCipher,
  type LeadConnectorTokenCipherService,
  type LeadConnectorHttpTransportService,
  beginLeadConnectorOAuth,
  completeLeadConnectorOAuth,
  createLeadConnectorNote,
  createLeadConnectorTask,
  getValidLeadConnectorAccessToken,
  listLeadConnectorContacts,
  listLeadConnectorPipelines,
  recordLeadConnectorDisposition,
  resolveLeadConnectorQueueCandidates,
  searchLeadConnectorOpportunities,
  type LeadConnectorHttpRequest,
  type LeadConnectorInstallation,
  type LeadConnectorOAuthState,
} from './index';

const now = new Date('2026-07-24T00:00:00.000Z');

const config = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'https://dialer.example/v1/integrations/leadconnector/callback',
  scopes: ['contacts.readonly', 'opportunities.readonly'],
  authorizationUrl:
    'https://marketplace.leadconnectorhq.com/oauth/chooselocation',
  apiBaseUrl: 'https://services.leadconnectorhq.com',
  tokenRefreshSkewSeconds: 300,
  userType: 'Location' as const,
};

type Harness = {
  requests: LeadConnectorHttpRequest[];
  installationsByWorkspace: Map<string, LeadConnectorInstallation>;
  workspaceByLocation: Map<string, string>;
  oauthStates: Map<string, LeadConnectorOAuthState>;
};

const makeHarness = (
  responseFor: (request: LeadConnectorHttpRequest) => unknown = () => ({}),
) => {
  const state: Harness = {
    requests: [],
    installationsByWorkspace: new Map(),
    workspaceByLocation: new Map(),
    oauthStates: new Map(),
  };

  const installationStore: LeadConnectorInstallationStoreService = {
    getByWorkspaceId: (workspaceId: string) =>
      Effect.succeed(state.installationsByWorkspace.get(workspaceId) ?? null),
    getByLocationId: (locationId: string) => {
      const workspaceId = state.workspaceByLocation.get(locationId);
      return Effect.succeed(
        workspaceId
          ? (state.installationsByWorkspace.get(workspaceId) ?? null)
          : null,
      );
    },
    save: (installation: LeadConnectorInstallation) =>
      Effect.suspend(() => {
        const owner = state.workspaceByLocation.get(installation.locationId);
        if (owner && owner !== installation.workspaceId) {
          return Effect.fail(
            new LeadConnectorInstallationOwnershipError({
              locationId: installation.locationId,
              workspaceId: installation.workspaceId,
              ownerWorkspaceId: owner,
              message: 'Location belongs to another workspace',
              retryable: false,
            }),
          );
        }
        return Effect.sync(() => {
          state.installationsByWorkspace.set(
            installation.workspaceId,
            structuredClone(installation),
          );
          state.workspaceByLocation.set(
            installation.locationId,
            installation.workspaceId,
          );
        });
      }),
    deleteByWorkspaceId: (workspaceId: string) =>
      Effect.sync(() => {
        const installation = state.installationsByWorkspace.get(workspaceId);
        if (installation)
          state.workspaceByLocation.delete(installation.locationId);
        state.installationsByWorkspace.delete(workspaceId);
      }),
  };

  const oauthStateStore: LeadConnectorOAuthStateStoreService = {
    put: (oauthState: LeadConnectorOAuthState) =>
      Effect.sync(() => {
        state.oauthStates.set(oauthState.state, structuredClone(oauthState));
      }),
    consume: (value: string) =>
      Effect.sync(() => {
        const stored = state.oauthStates.get(value) ?? null;
        state.oauthStates.delete(value);
        return stored;
      }),
  };

  const cipher: LeadConnectorTokenCipherService = {
    encrypt: (value: string) => Effect.succeed(`encrypted:${value}`),
    decrypt: (value: string) =>
      Effect.succeed(value.replace(/^encrypted:/, '')),
  };
  const transport: LeadConnectorHttpTransportService = {
    request: (request: LeadConnectorHttpRequest) =>
      Effect.sync(() => {
        state.requests.push(structuredClone(request));
        return { status: 200, body: responseFor(request) };
      }),
  };

  const layer = Layer.mergeAll(
    Layer.succeed(LeadConnectorConfig, config),
    Layer.succeed(LeadConnectorClock, { now: Effect.succeed(now) }),
    Layer.succeed(LeadConnectorRandom, {
      randomBytes: (length: number) =>
        Effect.succeed(
          Uint8Array.from({ length }, (_value, index) => (index + 1) % 256),
        ),
    }),
    Layer.succeed(LeadConnectorTokenCipher, cipher),
    Layer.succeed(LeadConnectorInstallationStore, installationStore),
    Layer.succeed(LeadConnectorOAuthStateStore, oauthStateStore),
    Layer.succeed(LeadConnectorHttpTransport, transport),
  );

  return { state, layer };
};

const connectedInstallation = (
  overrides: Partial<LeadConnectorInstallation> = {},
): LeadConnectorInstallation => ({
  installationId: 'installation-1',
  workspaceId: 'workspace-1',
  locationId: 'location-1',
  accessTokenCiphertext: 'encrypted:access-old',
  refreshTokenCiphertext: 'encrypted:refresh-old',
  expiresAt: '2026-07-24T12:00:00.000Z',
  scopes: ['contacts.readonly', 'opportunities.readonly'],
  connectedAt: '2026-07-23T00:00:00.000Z',
  updatedAt: '2026-07-23T00:00:00.000Z',
  ...overrides,
});

describe('LeadConnector OAuth contracts', () => {
  it('generates a provider-compatible state-bound authorization URL without unsupported PKCE fields', async () => {
    const harness = makeHarness();
    const result = await Effect.runPromise(
      beginLeadConnectorOAuth({ workspaceId: 'workspace-1' }).pipe(
        Effect.provide(harness.layer),
      ),
    );

    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe(config.authorizationUrl);
    expect(url.searchParams.get('client_id')).toBe(config.clientId);
    expect(url.searchParams.get('redirect_uri')).toBe(config.redirectUri);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.has('code_challenge_method')).toBe(false);
    expect(url.searchParams.has('code_challenge')).toBe(false);
    expect(url.searchParams.get('state')).toBe(result.state);
    expect(url.searchParams.get('scope')).toBe(config.scopes.join(' '));
    expect(url.toString()).not.toContain(config.clientSecret);

    const stored = harness.state.oauthStates.get(result.state);
    expect(stored).toEqual(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        redirectUri: config.redirectUri,
      }),
    );
    expect(stored).not.toHaveProperty('codeVerifier');
  });

  it('rejects missing, consumed, or expired state with a stable typed error', async () => {
    const harness = makeHarness();
    const result = await Effect.runPromise(
      Effect.either(
        completeLeadConnectorOAuth({ code: 'code-1', state: 'missing' }).pipe(
          Effect.provide(harness.layer),
        ),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isRight(result)) return;
    expect(result.left).toBeInstanceOf(LeadConnectorOAuthStateError);
    expect(result.left).toEqual(
      expect.objectContaining({
        code: 'INVALID_OAUTH_STATE',
        retryable: false,
      }),
    );
  });

  it('exchanges a valid code, encrypts tokens, and persists location ownership', async () => {
    const harness = makeHarness((request) => {
      if (request.url.endsWith('/oauth/token')) {
        return {
          accessToken: 'access-new',
          refreshToken: 'refresh-new',
          expiresIn: 86400,
          scope: 'contacts.readonly opportunities.readonly',
          locationId: 'location-1',
          userType: 'Location',
        };
      }
      return {};
    });
    const begun = await Effect.runPromise(
      beginLeadConnectorOAuth({ workspaceId: 'workspace-1' }).pipe(
        Effect.provide(harness.layer),
      ),
    );

    const result = await Effect.runPromise(
      completeLeadConnectorOAuth({ code: 'code-1', state: begun.state }).pipe(
        Effect.provide(harness.layer),
      ),
    );

    expect(result).toEqual({
      workspaceId: 'workspace-1',
      locationId: 'location-1',
      connected: true,
    });
    expect(harness.state.installationsByWorkspace.get('workspace-1')).toEqual(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        locationId: 'location-1',
        accessTokenCiphertext: 'encrypted:access-new',
        refreshTokenCiphertext: 'encrypted:refresh-new',
      }),
    );
    expect(harness.state.workspaceByLocation.get('location-1')).toBe(
      'workspace-1',
    );
    expect(harness.state.oauthStates.has(begun.state)).toBe(false);

    const tokenRequest = harness.state.requests[0];
    expect(tokenRequest.headers.Version).toBe(LEAD_CONNECTOR_API_VERSION);
    expect(tokenRequest.headers['Content-Type']).toBe(
      'application/x-www-form-urlencoded',
    );
    expect(tokenRequest.body).toEqual(
      expect.objectContaining({
        clientId: 'client-id',
        clientSecret: 'client-secret',
        grantType: 'authorization_code',
        code: 'code-1',
        redirectUri: config.redirectUri,
        userType: 'Location',
      }),
    );
    expect(tokenRequest.body).not.toHaveProperty('codeVerifier');
  });

  it('rejects a provider location already owned by another workspace', async () => {
    const harness = makeHarness(() => ({
      accessToken: 'access-new',
      refreshToken: 'refresh-new',
      expiresIn: 86400,
      scope: '',
      locationId: 'location-owned',
      userType: 'Location',
    }));
    harness.state.installationsByWorkspace.set(
      'workspace-owner',
      connectedInstallation({
        workspaceId: 'workspace-owner',
        locationId: 'location-owned',
      }),
    );
    harness.state.workspaceByLocation.set('location-owned', 'workspace-owner');
    const begun = await Effect.runPromise(
      beginLeadConnectorOAuth({ workspaceId: 'workspace-other' }).pipe(
        Effect.provide(harness.layer),
      ),
    );

    const result = await Effect.runPromise(
      Effect.either(
        completeLeadConnectorOAuth({ code: 'code-1', state: begun.state }).pipe(
          Effect.provide(harness.layer),
        ),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isRight(result)) return;
    expect(result.left).toBeInstanceOf(LeadConnectorInstallationOwnershipError);
    expect(result.left.retryable).toBe(false);
  });
});

describe('LeadConnector token and resource contracts', () => {
  it('refreshes an expiring encrypted token using v3 headers and persists rotation', async () => {
    const harness = makeHarness((request) => {
      if (request.url.endsWith('/oauth/token')) {
        return {
          accessToken: 'access-refreshed',
          refreshToken: 'refresh-rotated',
          expiresIn: 86400,
          scope: 'contacts.readonly opportunities.readonly',
          locationId: 'location-1',
          userType: 'Location',
        };
      }
      return {};
    });
    harness.state.installationsByWorkspace.set(
      'workspace-1',
      connectedInstallation({ expiresAt: '2026-07-24T00:02:00.000Z' }),
    );
    harness.state.workspaceByLocation.set('location-1', 'workspace-1');

    const token = await Effect.runPromise(
      getValidLeadConnectorAccessToken('workspace-1').pipe(
        Effect.provide(harness.layer),
      ),
    );

    expect(token).toBe('access-refreshed');
    expect(harness.state.requests).toHaveLength(1);
    expect(harness.state.requests[0]).toEqual(
      expect.objectContaining({
        method: 'POST',
        url: `${config.apiBaseUrl}/oauth/token`,
        headers: expect.objectContaining({ Version: 'v3' }),
        body: expect.objectContaining({
          clientId: 'client-id',
          clientSecret: 'client-secret',
          grantType: 'refresh_token',
          refreshToken: 'refresh-old',
          userType: 'Location',
        }),
      }),
    );
    expect(harness.state.installationsByWorkspace.get('workspace-1')).toEqual(
      expect.objectContaining({
        accessTokenCiphertext: 'encrypted:access-refreshed',
        refreshTokenCiphertext: 'encrypted:refresh-rotated',
      }),
    );
  });

  it('uses current API headers and maps opportunities and pipelines', async () => {
    const harness = makeHarness((request) => {
      if (request.url.endsWith('/opportunities/search')) {
        return {
          opportunities: [
            {
              id: 'opportunity-1',
              name: 'Renewal',
              contactId: 'contact-1',
              pipelineId: 'pipeline-1',
              pipelineStageId: 'stage-1',
              status: 'open',
              monetaryValue: 750,
            },
          ],
          meta: { total: 1 },
        };
      }
      if (request.url.includes('/opportunities/pipelines')) {
        return {
          pipelines: [
            {
              id: 'pipeline-1',
              name: 'Sales',
              stages: [{ id: 'stage-1', name: 'Qualified', position: 1 }],
            },
          ],
        };
      }
      return {};
    });
    harness.state.installationsByWorkspace.set(
      'workspace-1',
      connectedInstallation(),
    );
    harness.state.workspaceByLocation.set('location-1', 'workspace-1');

    const opportunities = await Effect.runPromise(
      searchLeadConnectorOpportunities({
        workspaceId: 'workspace-1',
        query: 'renewal',
      }).pipe(Effect.provide(harness.layer)),
    );
    const pipelines = await Effect.runPromise(
      listLeadConnectorPipelines('workspace-1').pipe(
        Effect.provide(harness.layer),
      ),
    );

    expect(opportunities).toEqual({
      opportunities: [
        {
          id: 'opportunity-1',
          name: 'Renewal',
          contactId: 'contact-1',
          pipelineId: 'pipeline-1',
          stageId: 'stage-1',
          status: 'open',
          monetaryValue: 750,
        },
      ],
      total: 1,
    });
    expect(pipelines).toEqual([
      {
        id: 'pipeline-1',
        name: 'Sales',
        stages: [{ id: 'stage-1', name: 'Qualified', position: 1 }],
      },
    ]);
    for (const request of harness.state.requests) {
      expect(request.headers).toEqual(
        expect.objectContaining({
          Authorization: 'Bearer access-old',
          Version: 'v3',
          Accept: 'application/json',
        }),
      );
    }
    expect(harness.state.requests[0].method).toBe('POST');
    expect(harness.state.requests[0].body).toEqual(
      expect.objectContaining({ locationId: 'location-1', query: 'renewal' }),
    );
  });


  it('paginates a pipeline stage and reuses embedded contacts before hydrating missing phones', async () => {
    const harness = makeHarness((request) => {
      if (request.url.endsWith('/opportunities/search')) {
        const page =
          (request.body as { page?: number } | undefined)?.page ?? 1;
        if (page === 1) {
          return {
            opportunities: [
              {
                id: 'opportunity-1',
                name: 'Kokayi Cobb',
                contactId: 'contact-1',
                pipelineId: 'pipeline-1',
                pipelineStageId: 'stage-1',
                status: 'open',
                monetaryValue: 100,
                contact: {
                  id: 'contact-1',
                  name: 'Kokayi Cobb',
                  phone: '+15550100123',
                  tags: [],
                },
              },
              {
                id: 'opportunity-2',
                name: 'No phone deal',
                contactId: 'contact-2',
                pipelineId: 'pipeline-1',
                pipelineStageId: 'stage-1',
                status: 'open',
                monetaryValue: 200,
                contact: {
                  id: 'contact-2',
                  name: 'No Phone',
                  phone: null,
                  tags: [],
                },
              },
            ],
            meta: { total: 3, currentPage: 1, nextPage: 2 },
          };
        }
        return {
          opportunities: [
            {
              id: 'opportunity-3',
              name: 'Hydrated deal',
              contactId: 'contact-3',
              pipelineId: 'pipeline-1',
              pipelineStageId: 'stage-1',
              status: 'open',
              monetaryValue: 300,
            },
          ],
          meta: { total: 3, currentPage: 2, nextPage: null },
        };
      }
      if (request.url.includes('/opportunities/pipelines')) {
        return {
          pipelines: [
            {
              id: 'pipeline-1',
              name: 'Marketing Pipeline',
              stages: [{ id: 'stage-1', name: 'Hot Lead', position: 1 }],
            },
          ],
        };
      }
      if (request.url.endsWith('/contacts/contact-2')) {
        return {
          contact: {
            id: 'contact-2',
            name: 'No Phone',
            phone: null,
            tags: [],
          },
        };
      }
      if (request.url.endsWith('/contacts/contact-3')) {
        return {
          contact: {
            id: 'contact-3',
            name: 'Hydrated Contact',
            phone: '+15550100125',
            tags: [],
          },
        };
      }
      return {};
    });
    harness.state.installationsByWorkspace.set(
      'workspace-1',
      connectedInstallation(),
    );
    harness.state.workspaceByLocation.set('location-1', 'workspace-1');

    const result = await Effect.runPromise(
      resolveLeadConnectorQueueCandidates({
        workspaceId: 'workspace-1',
        pipelineId: 'pipeline-1',
        stageId: 'stage-1',
      }).pipe(Effect.provide(harness.layer)),
    );

    expect(result).toEqual({
      pipelineId: 'pipeline-1',
      pipelineName: 'Marketing Pipeline',
      stageId: 'stage-1',
      stageName: 'Hot Lead',
      opportunityTotal: 3,
      callableTotal: 2,
      truncated: false,
      candidates: [
        {
          opportunityId: 'opportunity-1',
          contactId: 'contact-1',
          contactName: 'Kokayi Cobb',
          phone: '+15550100123',
          status: 'open',
          monetaryValue: 100,
        },
        {
          opportunityId: 'opportunity-3',
          contactId: 'contact-3',
          contactName: 'Hydrated Contact',
          phone: '+15550100125',
          status: 'open',
          monetaryValue: 300,
        },
      ],
    });
    const searches = harness.state.requests.filter((request) =>
      request.url.endsWith('/opportunities/search'),
    );
    expect(searches).toHaveLength(2);
    expect(searches.map((request) => request.body)).toEqual([
      expect.objectContaining({
        query: '',
        filters: [
          { field: 'pipeline_id', operator: 'eq', value: ['pipeline-1'] },
          {
            field: 'pipeline_stage_id',
            operator: 'eq',
            value: ['stage-1'],
          },
          { field: 'status', operator: 'eq', value: ['open'] },
        ],
        limit: 100,
        page: 1,
        includeTopRelations: true,
      }),
      expect.objectContaining({
        query: '',
        filters: [
          { field: 'pipeline_id', operator: 'eq', value: ['pipeline-1'] },
          {
            field: 'pipeline_stage_id',
            operator: 'eq',
            value: ['stage-1'],
          },
          { field: 'status', operator: 'eq', value: ['open'] },
        ],
        limit: 100,
        page: 2,
        includeTopRelations: true,
      }),
    ]);
    for (const request of searches) {
      expect(request.body).not.toEqual(
        expect.objectContaining({
          pipelineId: expect.anything(),
          pipelineStageId: expect.anything(),
          status: expect.anything(),
        }),
      );
    }
    expect(
      harness.state.requests.filter((request) =>
        request.url.endsWith('/contacts/contact-1'),
      ),
    ).toHaveLength(0);
  });

  it('maps provider contacts without importing customer-system entities', async () => {
    const harness = makeHarness((request) => {
      if (request.url.includes('/contacts/')) {
        return {
          contacts: [
            {
              id: 'contact-1',
              firstName: 'Ada',
              lastName: 'Lovelace',
              name: 'Ada Lovelace',
              email: 'ada@example.test',
              phone: '+15555550100',
              tags: ['prospect'],
            },
          ],
          meta: { total: 1, nextCursor: 'cursor-2' },
        };
      }
      return {};
    });
    harness.state.installationsByWorkspace.set(
      'workspace-1',
      connectedInstallation(),
    );
    harness.state.workspaceByLocation.set('location-1', 'workspace-1');

    const result = await Effect.runPromise(
      listLeadConnectorContacts({
        workspaceId: 'workspace-1',
        query: 'Ada',
        limit: 25,
      }).pipe(Effect.provide(harness.layer)),
    );

    expect(result).toEqual({
      contacts: [
        {
          id: 'contact-1',
          firstName: 'Ada',
          lastName: 'Lovelace',
          name: 'Ada Lovelace',
          email: 'ada@example.test',
          phone: '+15555550100',
          tags: ['prospect'],
        },
      ],
      total: 1,
      nextCursor: 'cursor-2',
    });
    const requestUrl = new URL(harness.state.requests[0].url);
    expect(requestUrl.searchParams.get('locationId')).toBe('location-1');
    expect(requestUrl.searchParams.get('query')).toBe('Ada');
    expect(requestUrl.searchParams.get('limit')).toBe('25');
  });

  it('creates provider notes, tasks, and dispositions without dialer lifecycle logic', async () => {
    const harness = makeHarness(() => ({ id: 'created-1' }));
    harness.state.installationsByWorkspace.set(
      'workspace-1',
      connectedInstallation(),
    );
    harness.state.workspaceByLocation.set('location-1', 'workspace-1');

    await Effect.runPromise(
      createLeadConnectorNote({
        workspaceId: 'workspace-1',
        contactId: 'contact-1',
        body: 'Call completed',
      }).pipe(Effect.provide(harness.layer)),
    );
    await Effect.runPromise(
      createLeadConnectorTask({
        workspaceId: 'workspace-1',
        contactId: 'contact-1',
        title: 'Follow up',
        dueDate: '2026-07-25T12:00:00.000Z',
      }).pipe(Effect.provide(harness.layer)),
    );
    await Effect.runPromise(
      recordLeadConnectorDisposition({
        workspaceId: 'workspace-1',
        contactId: 'contact-1',
        disposition: 'answered',
        note: 'Interested',
        tags: ['dialer-answered'],
      }).pipe(Effect.provide(harness.layer)),
    );

    expect(
      harness.state.requests.map(({ method, url }) => ({ method, url })),
    ).toEqual([
      {
        method: 'POST',
        url: `${config.apiBaseUrl}/contacts/contact-1/notes`,
      },
      {
        method: 'POST',
        url: `${config.apiBaseUrl}/contacts/contact-1/tasks`,
      },
      {
        method: 'POST',
        url: `${config.apiBaseUrl}/contacts/contact-1/notes`,
      },
      {
        method: 'PUT',
        url: `${config.apiBaseUrl}/contacts/contact-1`,
      },
    ]);
  });
});
