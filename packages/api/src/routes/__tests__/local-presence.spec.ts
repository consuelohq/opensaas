// Local presence + caller-id route tests — DEV-1201
// Tests 4 routes: POST toggle, GET preview, GET locks, POST cleanup

import type { RouteDefinition } from '../index';
import type { ApiRequest, ApiResponse } from '../../types';
import {
  createAuthenticatedRequest,
  createMockRequest,
  executeHandler,
} from '../../testing/routeTestHelper';

// ---- module mocks (hoisted by jest) ----

jest.mock('@consuelo/dialer', () => {
  const selectNumberFn = jest.fn();
  return {
    LocalPresenceService: jest.fn().mockImplementation(() => ({
      selectNumber: selectNumberFn,
    })),
    extractAreaCode: jest.fn((num: string) => {
      const match = num.match(/^\+1(\d{3})/);
      return match ? match[1] : null;
    }),
    __mockSelectNumber: selectNumberFn,
  };
});

jest.mock('../../shared/dialer', () => ({
  sharedDialer: jest.fn(),
  sharedCallerIdLockService: jest.fn(),
  getDialerForWorkspace: jest.fn(),
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

// ---- import after mocks ----

import { localPresenceRoutes } from '../local-presence';
import { sharedCallerIdLockService, getDialerForWorkspace } from '../../shared/dialer';

// access the mock selectNumber through the mocked LocalPresenceService instance
// the constructor was called at module level in local-presence.ts during import
const { LocalPresenceService } = jest.requireMock('@consuelo/dialer') as { LocalPresenceService: jest.Mock };
const mockSelectNumber = LocalPresenceService.mock.results[0]?.value?.selectNumber as jest.Mock;

// wire up mock instances after import
const mockGetUserLocks = jest.fn();
const mockReleaseLock = jest.fn();
const mockLockServiceInstance = {
  getUserLocks: mockGetUserLocks,
  releaseLock: mockReleaseLock,
};

const mockIsCallCompleted = jest.fn();
const mockDialerInstance = {
  isCallCompleted: mockIsCallCompleted,
};

(sharedCallerIdLockService as unknown as jest.Mock).mockReturnValue(mockLockServiceInstance);
(getDialerForWorkspace as jest.Mock).mockResolvedValue(mockDialerInstance);

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
  routes = localPresenceRoutes();
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================
// POST /v1/local-presence/toggle
// ============================================================

describe('POST /v1/local-presence/toggle', () => {
  const route = () => findRoute('POST', '/v1/local-presence/toggle');

  it('enables local presence', async () => {
    const res = await exec(route(), authReq({ body: { enabled: true } }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ enabled: true, userId: 'user-test-001' });
  });

  it('disables local presence', async () => {
    const res = await exec(route(), authReq({ body: { enabled: false } }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ enabled: false, userId: 'user-test-001' });
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq({ body: { enabled: true } }));
    expect(res.statusCode).toBe(401);
    expect((res.body as { error: { code: string } }).error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 when enabled is missing', async () => {
    const res = await exec(route(), authReq({ body: {} }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('BAD_REQUEST');
  });

  it('returns 400 when enabled is not boolean', async () => {
    const res = await exec(route(), authReq({ body: { enabled: 'yes' } }));
    expect(res.statusCode).toBe(400);
  });
});

// ============================================================
// GET /v1/local-presence/preview
// ============================================================

describe('GET /v1/local-presence/preview', () => {
  const route = () => findRoute('GET', '/v1/local-presence/preview');

  it('returns preview with local match', async () => {
    mockSelectNumber.mockResolvedValueOnce({
      phoneNumber: '+15551234567',
      areaCode: '555',
      localMatch: true,
      proximityMatch: false,
      distanceMiles: 0,
      isPrimary: false,
      customerAreaCode: '555',
    });
    const res = await exec(route(), authReq({
      query: {
        phoneNumber: '+15551234567',
        fromNumbers: '+15559876543,+15551111111',
      },
    }));
    expect(res.statusCode).toBe(200);
    expect((res.body as { localMatch: boolean }).localMatch).toBe(true);
  });

  it('returns primary fallback when no match', async () => {
    mockSelectNumber.mockResolvedValueOnce(null);
    const res = await exec(route(), authReq({
      query: {
        phoneNumber: '+15551234567',
        fromNumbers: '+15559876543',
      },
    }));
    expect(res.statusCode).toBe(200);
    expect((res.body as { isPrimary: boolean }).isPrimary).toBe(true);
    expect((res.body as { localMatch: boolean }).localMatch).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq({
      query: { phoneNumber: '+15551234567', fromNumbers: '+15559876543' },
    }));
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for missing phoneNumber', async () => {
    const res = await exec(route(), authReq({
      query: { fromNumbers: '+15559876543' },
    }));
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for invalid phoneNumber', async () => {
    const res = await exec(route(), authReq({
      query: { phoneNumber: '555-bad', fromNumbers: '+15559876543' },
    }));
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for missing fromNumbers', async () => {
    const res = await exec(route(), authReq({
      query: { phoneNumber: '+15551234567' },
    }));
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when all fromNumbers are invalid', async () => {
    const res = await exec(route(), authReq({
      query: { phoneNumber: '+15551234567', fromNumbers: 'bad,also-bad' },
    }));
    expect(res.statusCode).toBe(400);
  });
});

// ============================================================
// GET /v1/caller-id/locks
// ============================================================

describe('GET /v1/caller-id/locks', () => {
  const route = () => findRoute('GET', '/v1/caller-id/locks');

  it('returns locks for authenticated user', async () => {
    const now = new Date();
    const later = new Date(now.getTime() + 300000);
    mockGetUserLocks.mockResolvedValueOnce([
      { phoneNumber: '+15551234567', callSid: 'CA-001', acquiredAt: now, expiresAt: later },
    ]);
    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(200);
    expect((res.body as { count: number }).count).toBe(1);
    expect((res.body as { locks: unknown[] }).locks).toHaveLength(1);
  });

  it('returns empty locks', async () => {
    mockGetUserLocks.mockResolvedValueOnce([]);
    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(200);
    expect((res.body as { count: number }).count).toBe(0);
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq());
    expect(res.statusCode).toBe(401);
  });

  it('returns 500 on lock service error', async () => {
    mockGetUserLocks.mockRejectedValueOnce(new Error('redis down'));
    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(500);
    expect((res.body as { error: { code: string } }).error.code).toBe('LOCKS_FETCH_FAILED');
  });
});

// ============================================================
// POST /v1/caller-id/locks/cleanup
// ============================================================

describe('POST /v1/caller-id/locks/cleanup', () => {
  const route = () => findRoute('POST', '/v1/caller-id/locks/cleanup');

  it('cleans up completed call locks', async () => {
    const now = new Date();
    const later = new Date(now.getTime() + 300000);
    mockGetUserLocks.mockResolvedValueOnce([
      { phoneNumber: '+15551234567', callSid: 'CA-001', acquiredAt: now, expiresAt: later },
    ]);
    mockIsCallCompleted.mockResolvedValueOnce(true);
    mockReleaseLock.mockResolvedValueOnce(undefined);

    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(200);
    expect((res.body as { cleaned: number }).cleaned).toBe(1);
    expect((res.body as { remaining: number }).remaining).toBe(0);
  });

  it('keeps active call locks', async () => {
    const now = new Date();
    const later = new Date(now.getTime() + 300000);
    mockGetUserLocks.mockResolvedValueOnce([
      { phoneNumber: '+15551234567', callSid: 'CA-001', acquiredAt: now, expiresAt: later },
    ]);
    mockIsCallCompleted.mockResolvedValueOnce(false);

    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(200);
    expect((res.body as { cleaned: number }).cleaned).toBe(0);
    expect((res.body as { remaining: number }).remaining).toBe(1);
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq());
    expect(res.statusCode).toBe(401);
  });

  it('cleans up locks when isCallCompleted throws', async () => {
    const now = new Date();
    const later = new Date(now.getTime() + 300000);
    mockGetUserLocks.mockResolvedValueOnce([
      { phoneNumber: '+15551234567', callSid: 'CA-001', acquiredAt: now, expiresAt: later },
    ]);
    mockIsCallCompleted.mockRejectedValueOnce(new Error('twilio error'));
    mockReleaseLock.mockResolvedValueOnce(undefined);

    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(200);
    // should still clean up on error (stale lock assumption)
    expect((res.body as { cleaned: number }).cleaned).toBe(1);
  });
});
