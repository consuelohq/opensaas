// GHL integration route tests — DEV-1202
// Tests all 12 routes in ghl.ts with 3+ cases each

import type { RouteDefinition } from '../index';
import type { ApiRequest } from '../../types';
import {
  createAuthenticatedRequest,
  createMockRequest,
  executeHandler,
} from '../../testing/routeTestHelper';

// ---- mock instance vars (var is hoisted, assigned inside jest.mock factories) ----

/* eslint-disable no-var */
var mockAuth: Record<string, jest.Mock>;
var mockClient: Record<string, jest.Mock>;
var mockPush: Record<string, jest.Mock>;
var mockWebhook: Record<string, jest.Mock>;
var mockPipeline: Record<string, jest.Mock>;
var mockSync: Record<string, jest.Mock>;
var mockVerifySignature: jest.Mock;
/* eslint-enable no-var */

// ---- module mocks (hoisted by jest) ----

jest.mock('../../shared/db', () => {
  const queryFn = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
  return { getSharedPool: jest.fn().mockResolvedValue({ query: queryFn }) };
});

jest.mock('../../services/ghl-auth', () => {
  mockAuth = {
    getAuthUrl: jest.fn(),
    handleCallback: jest.fn(),
    storeTokens: jest.fn(),
    getStatus: jest.fn(),
    disconnect: jest.fn(),
    getValidToken: jest.fn().mockResolvedValue('ghl-access-token'),
  };
  return { GHLAuthService: jest.fn().mockImplementation(() => mockAuth) };
});

jest.mock('../../services/ghl-client', () => {
  mockClient = { getContacts: jest.fn() };
  return { GHLClient: jest.fn().mockImplementation(() => mockClient) };
});

jest.mock('../../services/ghl-push', () => {
  mockPush = {
    pushCallOutcome: jest.fn(),
    pushTagUpdate: jest.fn(),
    pushContactUpdate: jest.fn(),
  };
  return {
    GHLPushService: jest.fn().mockImplementation(() => mockPush),
    GHLPushMappingServiceImpl: jest.fn(),
  };
});

jest.mock('../../services/ghl-webhook', () => {
  mockWebhook = { handleWebhook: jest.fn().mockResolvedValue(undefined) };
  mockVerifySignature = jest.fn().mockReturnValue(true);
  return {
    GHLWebhookHandler: jest.fn().mockImplementation(() => mockWebhook),
    verifyWebhookSignature: mockVerifySignature,
  };
});

jest.mock('../../services/ghl-pipeline', () => {
  mockPipeline = {
    getPipelines: jest.fn(),
    getMappings: jest.fn(),
    updateMappings: jest.fn(),
    detectConflicts: jest.fn(),
    syncOpportunities: jest.fn(),
  };
  return { GHLPipelineSync: jest.fn().mockImplementation(() => mockPipeline) };
});

jest.mock('../../services/ghl-sync', () => {
  mockSync = {
    createSyncLog: jest.fn(),
    updateSyncLog: jest.fn(),
    importContacts: jest.fn(),
    getSyncLogs: jest.fn(),
  };
  return { GHLSyncService: jest.fn().mockImplementation(() => mockSync) };
});

jest.mock('../../services/redis', () => ({
  redisService: {
    setPkceVerifier: jest.fn(),
    getPkceVerifier: jest.fn(),
    deletePkceVerifier: jest.fn(),
  },
}));

jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

jest.mock('@consuelo/logger', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('node:crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({ toString: () => 'mock-state-hex' }),
}));

// ---- import after mocks ----

import { ghlRoutes } from '../ghl';

// ---- helpers ----

type Route = RouteDefinition;
let routes: Route[];

const findRoute = (method: string, path: string): Route => {
  const r = routes.find((rt) => rt.method === method && rt.path === path);
  if (!r) throw new Error(`Route not found: ${method} ${path}`);
  return r;
};

const exec = (route: Route, req?: Partial<ApiRequest>) =>
  executeHandler(route.handler, req);

const authReq = (overrides?: Partial<ApiRequest>) =>
  ({ ...createAuthenticatedRequest(overrides) });

const noAuthReq = (overrides?: Partial<ApiRequest>) =>
  ({ auth: undefined, ...overrides } as Partial<ApiRequest> & { auth: undefined });

const mockConnected = () => {
  mockAuth.getStatus.mockResolvedValue({
    connected: true,
    locationId: 'loc-001',
    connectedAt: '2026-01-01',
  });
};

const mockDisconnected = () => {
  mockAuth.getStatus.mockResolvedValue({ connected: false });
};

// ---- setup ----

beforeAll(() => {
  process.env.GHL_CLIENT_ID = 'test-client-id';
  process.env.GHL_CLIENT_SECRET = 'test-client-secret';
  process.env.GHL_REDIRECT_URI = 'https://app.test/callback';
  routes = ghlRoutes();
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ===========================================================
// POST /v1/integrations/ghl/oauth — start OAuth flow
// ===========================================================

describe('POST /v1/integrations/ghl/oauth', () => {
  const route = () => findRoute('POST', '/v1/integrations/ghl/oauth');

  it('returns redirect URL with PKCE state', async () => {
    mockAuth.getAuthUrl.mockReturnValue({
      url: 'https://marketplace.gohighlevel.com/oauth?state=mock-state-hex',
      codeVerifier: 'pkce-verifier-123',
    });
    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(200);
    expect((res.body as { redirectUrl: string }).redirectUrl).toContain('gohighlevel.com');
    expect((res.body as { state: string }).state).toBe('mock-state-hex');
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq());
    expect(res.statusCode).toBe(401);
  });

  it('returns 503 when GHL not configured', async () => {
    const savedId = process.env.GHL_CLIENT_ID;
    const savedSecret = process.env.GHL_CLIENT_SECRET;
    delete process.env.GHL_CLIENT_ID;
    delete process.env.GHL_CLIENT_SECRET;
    const freshRoutes = ghlRoutes();
    const oauthRoute = freshRoutes.find(
      (rt) => rt.method === 'POST' && rt.path === '/v1/integrations/ghl/oauth',
    )!;
    const res = await executeHandler(oauthRoute.handler, authReq());
    expect(res.statusCode).toBe(503);
    expect((res.body as { error: { code: string } }).error.code).toBe('GHL_NOT_CONFIGURED');
    process.env.GHL_CLIENT_ID = savedId;
    process.env.GHL_CLIENT_SECRET = savedSecret;
  });
});

// ===========================================================
// GET /v1/integrations/ghl/callback — handle OAuth callback
// ===========================================================

describe('GET /v1/integrations/ghl/callback', () => {
  const route = () => findRoute('GET', '/v1/integrations/ghl/callback');

  it('returns 400 when error param present', async () => {
    const res = await exec(route(), createMockRequest({
      query: { error: 'access_denied' },
    }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('GHL_AUTH_DENIED');
  });

  it('returns 400 when code or state missing', async () => {
    const res = await exec(route(), createMockRequest({ query: {} }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_CALLBACK');
  });

  it('returns 400 when only code provided without state', async () => {
    const res = await exec(route(), createMockRequest({
      query: { code: 'auth-code-123' },
    }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_CALLBACK');
  });

  it('returns 400 for invalid/expired state', async () => {
    const res = await exec(route(), createMockRequest({
      query: { code: 'auth-code-123', state: 'unknown-state' },
    }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_STATE');
  });
});

// ===========================================================
// GET /v1/integrations/ghl/status — connection status
// ===========================================================

describe('GET /v1/integrations/ghl/status', () => {
  const route = () => findRoute('GET', '/v1/integrations/ghl/status');

  it('returns connection status', async () => {
    const status = { connected: true, locationId: 'loc-001', connectedAt: '2026-01-01' };
    mockAuth.getStatus.mockResolvedValue(status);
    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(status);
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq());
    expect(res.statusCode).toBe(401);
  });

  it('returns disconnected status', async () => {
    mockAuth.getStatus.mockResolvedValue({ connected: false });
    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(200);
    expect((res.body as { connected: boolean }).connected).toBe(false);
  });
});

// ===========================================================
// DELETE /v1/integrations/ghl/connection — disconnect
// ===========================================================

describe('DELETE /v1/integrations/ghl/connection', () => {
  const route = () => findRoute('DELETE', '/v1/integrations/ghl/connection');

  it('disconnects GHL integration', async () => {
    mockAuth.disconnect.mockResolvedValue(undefined);
    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(200);
    expect((res.body as { disconnected: boolean }).disconnected).toBe(true);
    expect(mockAuth.disconnect).toHaveBeenCalledWith('ws-test-001');
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq());
    expect(res.statusCode).toBe(401);
  });

  it('returns 500 on service error', async () => {
    mockAuth.disconnect.mockRejectedValue(new Error('db error'));
    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(500);
  });
});

// ===========================================================
// POST /v1/integrations/ghl/push — push data to GHL
// ===========================================================

describe('POST /v1/integrations/ghl/push', () => {
  const route = () => findRoute('POST', '/v1/integrations/ghl/push');

  beforeEach(() => mockConnected());

  it('pushes call outcome', async () => {
    mockPush.pushCallOutcome.mockResolvedValue(true);
    const res = await exec(route(), authReq({
      body: { type: 'call-outcome', contactId: 'ct-001', data: { disposition: 'answered' } },
    }));
    expect(res.statusCode).toBe(200);
    expect((res.body as { pushed: boolean }).pushed).toBe(true);
  });

  it('pushes tag update', async () => {
    mockPush.pushTagUpdate.mockResolvedValue(true);
    const res = await exec(route(), authReq({
      body: { type: 'tags', contactId: 'ct-001', data: { tags: ['vip'] } },
    }));
    expect(res.statusCode).toBe(200);
    expect((res.body as { pushed: boolean }).pushed).toBe(true);
  });

  it('returns 400 when type or contactId missing', async () => {
    const res = await exec(route(), authReq({ body: { type: 'tags' } }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_PAYLOAD');
  });

  it('returns 400 when GHL not connected', async () => {
    mockDisconnected();
    const res = await exec(route(), authReq({
      body: { type: 'call-outcome', contactId: 'ct-001' },
    }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('GHL_NOT_CONNECTED');
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq());
    expect(res.statusCode).toBe(401);
  });
});

// ===========================================================
// GET /v1/integrations/ghl/pipelines — list pipelines
// ===========================================================

describe('GET /v1/integrations/ghl/pipelines', () => {
  const route = () => findRoute('GET', '/v1/integrations/ghl/pipelines');

  beforeEach(() => mockConnected());

  it('returns pipelines and mappings', async () => {
    const pipelines = [{ id: 'p-1', name: 'Sales', stages: [] }];
    const mappings = [{ ghlPipelineId: 'p-1', twentyPipelineId: 'tp-1' }];
    mockPipeline.getPipelines.mockResolvedValue(pipelines);
    mockPipeline.getMappings.mockResolvedValue(mappings);
    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(200);
    expect((res.body as { pipelines: unknown[] }).pipelines).toEqual(pipelines);
    expect((res.body as { mappings: unknown[] }).mappings).toEqual(mappings);
  });

  it('returns 400 when GHL not connected', async () => {
    mockDisconnected();
    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('GHL_NOT_CONNECTED');
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq());
    expect(res.statusCode).toBe(401);
  });
});

// ===========================================================
// PUT /v1/integrations/ghl/pipelines/mappings — update mappings
// ===========================================================

describe('PUT /v1/integrations/ghl/pipelines/mappings', () => {
  const route = () => findRoute('PUT', '/v1/integrations/ghl/pipelines/mappings');

  beforeEach(() => mockConnected());

  it('updates pipeline mappings', async () => {
    mockPipeline.updateMappings.mockResolvedValue(undefined);
    const mappings = [{
      ghlPipelineId: 'gp-1', ghlStageId: 'gs-1',
      twentyPipelineId: 'tp-1', twentyStageId: 'ts-1',
    }];
    const res = await exec(route(), authReq({ body: { mappings } }));
    expect(res.statusCode).toBe(200);
    expect((res.body as { updated: boolean }).updated).toBe(true);
    expect((res.body as { count: number }).count).toBe(1);
  });

  it('returns 400 when mappings not an array', async () => {
    const res = await exec(route(), authReq({ body: { mappings: 'bad' } }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_PAYLOAD');
  });

  it('returns 400 when mapping fields missing', async () => {
    const res = await exec(route(), authReq({
      body: { mappings: [{ ghlPipelineId: 'gp-1' }] },
    }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { message: string } }).error.message).toContain('ghlStageId');
  });

  it('returns 400 when GHL not connected', async () => {
    mockDisconnected();
    const mappings = [{
      ghlPipelineId: 'gp-1', ghlStageId: 'gs-1',
      twentyPipelineId: 'tp-1', twentyStageId: 'ts-1',
    }];
    const res = await exec(route(), authReq({ body: { mappings } }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('GHL_NOT_CONNECTED');
  });
});

// ===========================================================
// POST /v1/integrations/ghl/pipelines/sync — sync opportunities
// ===========================================================

describe('POST /v1/integrations/ghl/pipelines/sync', () => {
  const route = () => findRoute('POST', '/v1/integrations/ghl/pipelines/sync');

  beforeEach(() => mockConnected());

  it('syncs opportunities without conflict check', async () => {
    mockPipeline.syncOpportunities.mockResolvedValue({ synced: 5, created: 3, updated: 2 });
    const res = await exec(route(), authReq({ body: {} }));
    expect(res.statusCode).toBe(200);
    expect((res.body as { synced: number }).synced).toBe(5);
    expect((res.body as { conflicts: unknown }).conflicts).toBeNull();
  });

  it('syncs with conflict detection', async () => {
    mockPipeline.detectConflicts.mockResolvedValue([{ id: 'c-1' }]);
    mockPipeline.syncOpportunities.mockResolvedValue({ synced: 2 });
    const res = await exec(route(), authReq({ body: { checkConflicts: true } }));
    expect(res.statusCode).toBe(200);
    expect((res.body as { conflicts: unknown[] }).conflicts).toHaveLength(1);
  });

  it('returns 400 when GHL not connected', async () => {
    mockDisconnected();
    const res = await exec(route(), authReq({ body: {} }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('GHL_NOT_CONNECTED');
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq());
    expect(res.statusCode).toBe(401);
  });
});

// ===========================================================
// POST /v1/integrations/ghl/import — initial import
// ===========================================================

describe('POST /v1/integrations/ghl/import', () => {
  const route = () => findRoute('POST', '/v1/integrations/ghl/import');

  beforeEach(() => mockConnected());

  it('imports contacts with pagination', async () => {
    mockSync.createSyncLog.mockResolvedValue('log-001');
    // return exactly limit (100) contacts to trigger pagination, then empty to stop
    const fullPage = Array.from({ length: 100 }, (_, i) => ({ id: `c${i}` }));
    mockClient.getContacts.mockResolvedValueOnce({ contacts: fullPage });
    mockClient.getContacts.mockResolvedValueOnce({ contacts: [] });
    mockSync.importContacts.mockResolvedValue({ imported: 100, skipped: 0 });
    mockSync.updateSyncLog.mockResolvedValue(undefined);

    const res = await exec(route(), authReq({ body: { conflictResolution: 'merge' } }));
    expect(res.statusCode).toBe(200);
    expect((res.body as { success: boolean }).success).toBe(true);
    expect((res.body as { imported: number }).imported).toBe(100);
    expect(mockSync.createSyncLog).toHaveBeenCalledWith('ws-test-001', 'import', 0);
  });

  it('returns 400 when GHL not connected', async () => {
    mockDisconnected();
    const res = await exec(route(), authReq({ body: {} }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('GHL_NOT_CONNECTED');
  });

  it('logs failure on import error', async () => {
    mockSync.createSyncLog.mockResolvedValue('log-002');
    mockClient.getContacts.mockRejectedValue(new Error('GHL API down'));
    mockSync.updateSyncLog.mockResolvedValue(undefined);

    const res = await exec(route(), authReq({ body: {} }));
    expect(res.statusCode).toBe(500);
    expect(mockSync.updateSyncLog).toHaveBeenCalledWith(
      'log-002', 'failed', {}, 'GHL API down',
    );
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq());
    expect(res.statusCode).toBe(401);
  });
});

// ===========================================================
// POST /v1/integrations/ghl/sync — incremental sync
// ===========================================================

describe('POST /v1/integrations/ghl/sync', () => {
  const route = () => findRoute('POST', '/v1/integrations/ghl/sync');

  beforeEach(() => mockConnected());

  it('runs incremental sync', async () => {
    mockSync.createSyncLog.mockResolvedValue('log-003');
    // return fewer than limit to stop pagination in one call
    mockClient.getContacts.mockResolvedValueOnce({ contacts: [{ id: 'c1' }] });
    mockSync.importContacts.mockResolvedValue({ imported: 1, updated: 0 });
    mockSync.updateSyncLog.mockResolvedValue(undefined);

    const res = await exec(route(), authReq({ body: {} }));
    expect(res.statusCode).toBe(200);
    expect((res.body as { success: boolean }).success).toBe(true);
    expect(mockSync.createSyncLog).toHaveBeenCalledWith('ws-test-001', 'incremental', 0);
  });

  it('returns 400 when GHL not connected', async () => {
    mockDisconnected();
    const res = await exec(route(), authReq({ body: {} }));
    expect(res.statusCode).toBe(400);
  });

  it('logs failure on sync error', async () => {
    mockSync.createSyncLog.mockResolvedValue('log-004');
    mockClient.getContacts.mockRejectedValue(new Error('timeout'));
    mockSync.updateSyncLog.mockResolvedValue(undefined);

    const res = await exec(route(), authReq({ body: {} }));
    expect(res.statusCode).toBe(500);
    expect(mockSync.updateSyncLog).toHaveBeenCalledWith(
      'log-004', 'failed', {}, 'timeout',
    );
  });
});

// ===========================================================
// GET /v1/integrations/ghl/sync/log — get sync logs
// ===========================================================

describe('GET /v1/integrations/ghl/sync/log', () => {
  const route = () => findRoute('GET', '/v1/integrations/ghl/sync/log');

  it('returns sync logs with defaults', async () => {
    const logs = [{ id: 'log-1', type: 'import', status: 'completed' }];
    mockSync.getSyncLogs.mockResolvedValue(logs);
    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(200);
    expect((res.body as { logs: unknown[] }).logs).toEqual(logs);
    expect(mockSync.getSyncLogs).toHaveBeenCalledWith('ws-test-001', 50, 0);
  });

  it('respects limit and offset query params', async () => {
    mockSync.getSyncLogs.mockResolvedValue([]);
    const res = await exec(route(), authReq({ query: { limit: '10', offset: '20' } }));
    expect(res.statusCode).toBe(200);
    expect(mockSync.getSyncLogs).toHaveBeenCalledWith('ws-test-001', 10, 20);
  });

  it('caps limit at 100', async () => {
    mockSync.getSyncLogs.mockResolvedValue([]);
    const res = await exec(route(), authReq({ query: { limit: '500' } }));
    expect(res.statusCode).toBe(200);
    expect(mockSync.getSyncLogs).toHaveBeenCalledWith('ws-test-001', 100, 0);
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq());
    expect(res.statusCode).toBe(401);
  });
});

// ===========================================================
// POST /v1/webhooks/ghl — receive GHL webhook events
// ===========================================================

describe('POST /v1/webhooks/ghl', () => {
  const route = () => findRoute('POST', '/v1/webhooks/ghl');

  it('processes valid webhook payload', async () => {
    const res = await exec(route(), createMockRequest({
      body: { type: 'ContactCreate', locationId: 'loc-001', body: { id: 'c1' } },
    }));
    expect(res.statusCode).toBe(200);
    expect((res.body as { received: boolean }).received).toBe(true);
    expect(mockWebhook.handleWebhook).toHaveBeenCalled();
  });

  it('returns 400 when type or locationId missing', async () => {
    const res = await exec(route(), createMockRequest({
      body: { body: { id: 'c1' } },
    }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_PAYLOAD');
  });

  it('returns 401 when signature verification fails', async () => {
    process.env.GHL_WEBHOOK_SECRET = 'webhook-secret';
    mockVerifySignature.mockReturnValueOnce(false);
    const res = await exec(route(), createMockRequest({
      headers: { 'x-ghl-signature': 'bad-sig' },
      body: { type: 'ContactCreate', locationId: 'loc-001', body: {} },
    }));
    expect(res.statusCode).toBe(401);
    expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_SIGNATURE');
    delete process.env.GHL_WEBHOOK_SECRET;
  });

  it('skips signature check when no webhook secret configured', async () => {
    delete process.env.GHL_WEBHOOK_SECRET;
    const res = await exec(route(), createMockRequest({
      body: { type: 'ContactUpdate', locationId: 'loc-001', body: { id: 'c2' } },
    }));
    expect(res.statusCode).toBe(200);
  });
});
