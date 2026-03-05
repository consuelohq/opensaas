// Subscription route tests — DEV-1201
// Tests 3 routes: GET status, POST checkout, POST portal

import type { RouteDefinition } from '../index';
import type { ApiRequest, ApiResponse } from '../../types';
import {
  createAuthenticatedRequest,
  executeHandler,
} from '../../testing/routeTestHelper';

// ---- module mocks (hoisted by jest) ----

jest.mock('../../services/subscription', () => ({
  getSubscriptionStatus: jest.fn(),
  createCheckoutSession: jest.fn(),
  createPortalSession: jest.fn(),
  PRICE_IDS: {
    baseMonthly: 'price_base_monthly',
    baseAnnual: 'price_base_annual',
    dialerCoachMonthly: 'price_dialer_monthly',
    dialerCoachAnnual: 'price_dialer_annual',
    aiAssistantMonthly: 'price_ai_monthly',
    aiAssistantAnnual: 'price_ai_annual',
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

// ---- import after mocks ----

import { subscriptionRoutes } from '../subscription';
import {
  getSubscriptionStatus,
  createCheckoutSession,
  createPortalSession,
} from '../../services/subscription';

const mockGetSubscriptionStatus = getSubscriptionStatus as jest.Mock;
const mockCreateCheckoutSession = createCheckoutSession as jest.Mock;
const mockCreatePortalSession = createPortalSession as jest.Mock;

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
  routes = subscriptionRoutes();
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================
// GET /v1/subscription/status
// ============================================================

describe('GET /v1/subscription/status', () => {
  const route = () => findRoute('GET', '/v1/subscription/status');

  it('returns subscription status', async () => {
    const status = {
      workspaceId: 'ws-test-001',
      mode: 'hosted',
      plan: { name: 'consuelo-base', status: 'active', interval: 'month', currentPeriodEnd: '2026-04-01' },
      addOns: ['dialer-coach'],
      usage: { callMinutes: { used: 120, limit: null }, aiTokens: { used: 500, limit: null } },
      byokKeys: null,
      stripeCustomerId: 'cus_test',
    };
    mockGetSubscriptionStatus.mockResolvedValueOnce(status);
    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(status);
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq());
    expect(res.statusCode).toBe(401);
    expect((res.body as { error: { code: string } }).error.code).toBe('UNAUTHORIZED');
  });

  it('returns 500 on service error', async () => {
    mockGetSubscriptionStatus.mockRejectedValueOnce(new Error('db down'));
    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(500);
  });
});

// ============================================================
// POST /v1/subscription/checkout
// ============================================================

describe('POST /v1/subscription/checkout', () => {
  const route = () => findRoute('POST', '/v1/subscription/checkout');

  it('creates checkout session with default base plan', async () => {
    mockCreateCheckoutSession.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/session' });
    const res = await exec(route(), authReq({
      body: { successUrl: 'https://app.com/success', cancelUrl: 'https://app.com/cancel' },
    }));
    expect(res.statusCode).toBe(200);
    expect((res.body as { url: string }).url).toBe('https://checkout.stripe.com/session');
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      'ws-test-001',
      expect.arrayContaining(['price_base_monthly']),
      'https://app.com/success',
      'https://app.com/cancel',
    );
  });

  it('creates checkout with add-ons', async () => {
    mockCreateCheckoutSession.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/session' });
    const res = await exec(route(), authReq({
      body: {
        successUrl: 'https://app.com/success',
        cancelUrl: 'https://app.com/cancel',
        addOns: ['dialer-coach'],
        interval: 'year',
      },
    }));
    expect(res.statusCode).toBe(200);
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      'ws-test-001',
      expect.arrayContaining(['price_base_annual', 'price_dialer_annual']),
      'https://app.com/success',
      'https://app.com/cancel',
    );
  });

  it('creates checkout with explicit priceIds', async () => {
    mockCreateCheckoutSession.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/session' });
    const res = await exec(route(), authReq({
      body: {
        successUrl: 'https://app.com/success',
        cancelUrl: 'https://app.com/cancel',
        priceIds: ['price_custom_123'],
      },
    }));
    expect(res.statusCode).toBe(200);
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      'ws-test-001',
      ['price_custom_123'],
      'https://app.com/success',
      'https://app.com/cancel',
    );
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq({
      body: { successUrl: 'https://app.com/success', cancelUrl: 'https://app.com/cancel' },
    }));
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when URLs are missing', async () => {
    const res = await exec(route(), authReq({ body: {} }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('BAD_REQUEST');
  });

  it('returns 500 on stripe error', async () => {
    mockCreateCheckoutSession.mockRejectedValueOnce(new Error('stripe error'));
    const res = await exec(route(), authReq({
      body: { successUrl: 'https://app.com/success', cancelUrl: 'https://app.com/cancel' },
    }));
    expect(res.statusCode).toBe(500);
  });
});

// ============================================================
// POST /v1/subscription/portal
// ============================================================

describe('POST /v1/subscription/portal', () => {
  const route = () => findRoute('POST', '/v1/subscription/portal');

  it('creates portal session', async () => {
    mockCreatePortalSession.mockResolvedValueOnce({ url: 'https://billing.stripe.com/portal' });
    const res = await exec(route(), authReq({
      body: { returnUrl: 'https://app.com/settings' },
    }));
    expect(res.statusCode).toBe(200);
    expect((res.body as { url: string }).url).toBe('https://billing.stripe.com/portal');
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq({
      body: { returnUrl: 'https://app.com/settings' },
    }));
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when returnUrl is missing', async () => {
    const res = await exec(route(), authReq({ body: {} }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('BAD_REQUEST');
  });

  it('returns 500 on stripe error', async () => {
    mockCreatePortalSession.mockRejectedValueOnce(
      Object.assign(new Error('No subscription found'), { status: 404 }),
    );
    const res = await exec(route(), authReq({
      body: { returnUrl: 'https://app.com/settings' },
    }));
    // errorHandler catches the error with status 404
    expect(res.statusCode).toBe(404);
  });
});
