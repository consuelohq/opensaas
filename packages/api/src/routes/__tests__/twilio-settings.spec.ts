// Twilio settings route tests — DEV-1201
// Tests 5 routes: GET health, GET config, POST test, PUT config, DELETE config

import type { RouteDefinition } from '../index';
import type { ApiRequest, ApiResponse } from '../../types';
import {
  createAuthenticatedRequest,
  executeHandler,
} from '../../testing/routeTestHelper';

// ---- module mocks (hoisted by jest) ----

jest.mock('../../services/twilio-config', () => ({
  getWorkspaceTwilioConfig: jest.fn(),
  getDecryptedCredentials: jest.fn(),
  saveByokConfig: jest.fn(),
  deleteWorkspaceTwilioConfig: jest.fn(),
  isHostedInstance: jest.fn().mockReturnValue(false),
  maskCredential: jest.fn((v: string) => `${v.slice(0, 4)}...${v.slice(-4)}`),
  ensureOrCreateTwimlApp: jest.fn(),
  syncTwimlAppUrl: jest.fn(),
}));

jest.mock('../../shared/dialer', () => ({
  invalidateDialerCache: jest.fn(),
}));

// mock twilio for test/save routes — fetch fn defined inside factory
const mockFetchFn = jest.fn().mockResolvedValue({});
jest.mock('twilio', () => {
  const fetchFn = jest.fn().mockResolvedValue({});
  return {
    __esModule: true,
    default: jest.fn().mockReturnValue({
      api: { accounts: jest.fn().mockReturnValue({ fetch: fetchFn }) },
      applications: {
        list: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ sid: 'AP-new-001' }),
      },
    }),
    __mockFetch: fetchFn,
  };
});

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

// ---- import after mocks ----

import { twilioSettingsRoutes } from '../twilio-settings';
import * as twilioConfigModule from '../../services/twilio-config';
import { invalidateDialerCache } from '../../shared/dialer';

const mockGetWorkspaceTwilioConfig = twilioConfigModule.getWorkspaceTwilioConfig as jest.Mock;
const mockGetDecryptedCredentials = twilioConfigModule.getDecryptedCredentials as jest.Mock;
const mockSaveByokConfig = twilioConfigModule.saveByokConfig as jest.Mock;
const mockDeleteWorkspaceTwilioConfig = twilioConfigModule.deleteWorkspaceTwilioConfig as jest.Mock;
const mockIsHostedInstance = twilioConfigModule.isHostedInstance as unknown as jest.Mock;
const mockMaskCredential = twilioConfigModule.maskCredential as unknown as jest.Mock;
const mockEnsureOrCreateTwimlApp = twilioConfigModule.ensureOrCreateTwimlApp as jest.Mock;
const mockSyncTwimlAppUrl = twilioConfigModule.syncTwimlAppUrl as jest.Mock;
const mockInvalidateDialerCache = invalidateDialerCache as jest.Mock;

// access the mock fetch — twilio is mocked, so we get the mock client via the factory
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mockTwilioModule = jest.requireMock('twilio') as { default: jest.Mock; __mockFetch: jest.Mock };
const mockTwilioClient = mockTwilioModule.default();
const mockFetch = mockTwilioClient.api.accounts().fetch as jest.Mock;

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

// ---- setup ----

beforeAll(() => {
  routes = twilioSettingsRoutes();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockIsHostedInstance.mockReturnValue(false);
});

// ============================================================
// GET /v1/settings/twilio/health
// ============================================================

describe('GET /v1/settings/twilio/health', () => {
  const route = () => findRoute('GET', '/v1/settings/twilio/health');

  it('returns healthy when config and twiml app are valid', async () => {
    const config = { twimlAppSid: 'AP-001', mode: 'byok' };
    mockGetWorkspaceTwilioConfig.mockResolvedValueOnce(config);
    mockGetDecryptedCredentials.mockReturnValueOnce({
      accountSid: 'AC-test',
      authToken: 'token-test',
    });
    mockSyncTwimlAppUrl.mockResolvedValueOnce({ updated: false, voiceUrl: 'https://api.com/v1/voice/twiml' });
    // second call for updated config
    mockGetWorkspaceTwilioConfig.mockResolvedValueOnce(config);

    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(200);
    expect((res.body as { healthy: boolean }).healthy).toBe(true);
  });

  it('returns unhealthy when no config', async () => {
    mockGetWorkspaceTwilioConfig.mockResolvedValueOnce(null);
    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(200);
    expect((res.body as { healthy: boolean }).healthy).toBe(false);
  });

  it('returns unhealthy when no twiml app', async () => {
    mockGetWorkspaceTwilioConfig.mockResolvedValueOnce({ twimlAppSid: null, mode: 'byok' });
    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(200);
    expect((res.body as { healthy: boolean }).healthy).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq());
    expect(res.statusCode).toBe(401);
  });
});

// ============================================================
// GET /v1/settings/twilio
// ============================================================

describe('GET /v1/settings/twilio', () => {
  const route = () => findRoute('GET', '/v1/settings/twilio');

  it('returns configured state with masked credentials', async () => {
    const config = { mode: 'byok', byokAccountSidEncrypted: 'enc' };
    mockGetWorkspaceTwilioConfig.mockResolvedValueOnce(config);
    mockGetDecryptedCredentials.mockReturnValueOnce({
      accountSid: 'AC-test-account-sid',
      authToken: 'token-secret',
      apiKey: 'SK-test-key',
    });

    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(200);
    expect((res.body as { configured: boolean }).configured).toBe(true);
    expect((res.body as { mode: string }).mode).toBe('byok');
    expect(mockMaskCredential).toHaveBeenCalled();
  });

  it('returns not configured when no config exists', async () => {
    mockGetWorkspaceTwilioConfig.mockResolvedValueOnce(null);
    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(200);
    expect((res.body as { configured: boolean }).configured).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq());
    expect(res.statusCode).toBe(401);
  });

  it('shows hostedAvailable when hosted instance', async () => {
    mockIsHostedInstance.mockReturnValue(true);
    mockGetWorkspaceTwilioConfig.mockResolvedValueOnce(null);
    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(200);
    expect((res.body as { hostedAvailable: boolean }).hostedAvailable).toBe(true);
  });
});

// ============================================================
// POST /v1/settings/twilio/test
// ============================================================

describe('POST /v1/settings/twilio/test', () => {
  const route = () => findRoute('POST', '/v1/settings/twilio/test');

  it('returns valid for correct credentials', async () => {
    const res = await exec(route(), authReq({
      body: { accountSid: 'AC-test', authToken: 'token-test' },
    }));
    expect(res.statusCode).toBe(200);
    expect((res.body as { valid: boolean }).valid).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq({
      body: { accountSid: 'AC-test', authToken: 'token-test' },
    }));
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for missing credentials', async () => {
    const res = await exec(route(), authReq({ body: {} }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_REQUEST');
  });

  it('returns 400 for invalid credentials', async () => {
    mockFetch.mockRejectedValueOnce(new Error('authenticate: 20003'));
    const res = await exec(route(), authReq({
      body: { accountSid: 'AC-bad', authToken: 'bad-token' },
    }));
    expect((res.body as { valid: boolean }).valid).toBe(false);
    expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_CREDENTIALS');
  });
});

// ============================================================
// PUT /v1/settings/twilio
// ============================================================

describe('PUT /v1/settings/twilio', () => {
  const route = () => findRoute('PUT', '/v1/settings/twilio');

  it('saves BYOK config successfully', async () => {
    mockSaveByokConfig.mockResolvedValueOnce(undefined);
    mockEnsureOrCreateTwimlApp.mockResolvedValueOnce('AP-new-001');

    const res = await exec(route(), authReq({
      body: { accountSid: 'AC-test', authToken: 'token-test' },
    }));
    expect(res.statusCode).toBe(200);
    expect((res.body as { mode: string }).mode).toBe('byok');
    expect((res.body as { twimlAppSid: string }).twimlAppSid).toBe('AP-new-001');
    expect(mockInvalidateDialerCache).toHaveBeenCalledWith('ws-test-001');
  });

  it('saves config with twiml app warning on failure', async () => {
    mockSaveByokConfig.mockResolvedValueOnce(undefined);
    mockEnsureOrCreateTwimlApp.mockRejectedValueOnce(new Error('twiml creation failed'));

    const res = await exec(route(), authReq({
      body: { accountSid: 'AC-test', authToken: 'token-test' },
    }));
    expect(res.statusCode).toBe(200);
    expect((res.body as { warning: string }).warning).toContain('TwiML App auto-creation failed');
    expect((res.body as { twimlAppSid: string | null }).twimlAppSid).toBeNull();
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq({
      body: { accountSid: 'AC-test', authToken: 'token-test' },
    }));
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for missing credentials', async () => {
    const res = await exec(route(), authReq({ body: {} }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_REQUEST');
  });

  it('returns 400 for invalid twilio credentials', async () => {
    mockFetch.mockRejectedValueOnce(new Error('authenticate: 20003'));
    const res = await exec(route(), authReq({
      body: { accountSid: 'AC-bad', authToken: 'bad-token' },
    }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_CREDENTIALS');
  });
});

// ============================================================
// DELETE /v1/settings/twilio
// ============================================================

describe('DELETE /v1/settings/twilio', () => {
  const route = () => findRoute('DELETE', '/v1/settings/twilio');

  it('deletes config successfully', async () => {
    mockDeleteWorkspaceTwilioConfig.mockResolvedValueOnce(undefined);
    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(200);
    expect((res.body as { deleted: boolean }).deleted).toBe(true);
    expect(mockInvalidateDialerCache).toHaveBeenCalledWith('ws-test-001');
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq());
    expect(res.statusCode).toBe(401);
  });

  it('returns 500 on delete error', async () => {
    mockDeleteWorkspaceTwilioConfig.mockRejectedValueOnce(new Error('db error'));
    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(500);
    expect((res.body as { error: { code: string } }).error.code).toBe('CONFIG_ERROR');
  });
});
