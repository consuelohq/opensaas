// Preferences route tests — DEV-1201
// Tests 2 routes: GET /v1/settings/preferences, PUT /v1/settings/preferences

import type { RouteDefinition } from '../index';
import type { ApiRequest, ApiResponse } from '../../types';
import {
  createAuthenticatedRequest,
  executeHandler,
} from '../../testing/routeTestHelper';

// ---- module mocks (hoisted by jest) ----

jest.mock('../../shared/db', () => {
  const queryFn = jest.fn();
  return {
    getSharedPool: jest.fn().mockResolvedValue({ query: queryFn }),
    __mockQuery: queryFn,
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

import { preferencesRoutes } from '../preferences';

// get mock query from the db mock
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __mockQuery: mockQuery } = require('../../shared/db') as { __mockQuery: jest.Mock };

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
  routes = preferencesRoutes();
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================
// GET /v1/settings/preferences
// ============================================================

describe('GET /v1/settings/preferences', () => {
  const route = () => findRoute('GET', '/v1/settings/preferences');

  it('returns preferences for authenticated user', async () => {
    const prefs = { theme: 'dark', notifications: true };
    mockQuery.mockResolvedValueOnce({ rows: [{ preferences: prefs }] });
    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(prefs);
  });

  it('returns empty object when no preferences exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({});
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq());
    expect(res.statusCode).toBe(401);
    expect((res.body as { error: { code: string } }).error.code).toBe('UNAUTHORIZED');
  });
});

// ============================================================
// PUT /v1/settings/preferences
// ============================================================

describe('PUT /v1/settings/preferences', () => {
  const route = () => findRoute('PUT', '/v1/settings/preferences');

  it('upserts preferences', async () => {
    const prefs = { theme: 'light', autoRecord: false };
    mockQuery.mockResolvedValueOnce({ rows: [{ preferences: prefs }] });
    const res = await exec(route(), authReq({ body: prefs }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(prefs);
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq({ body: { theme: 'dark' } }));
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for missing body', async () => {
    const res = await exec(route(), authReq({ body: undefined }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('BAD_REQUEST');
  });

  it('returns 400 for non-object body', async () => {
    const res = await exec(route(), authReq({ body: 'not-an-object' }));
    expect(res.statusCode).toBe(400);
  });
});
