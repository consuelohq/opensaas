// Stripe webhook route tests — DEV-1201
// Tests 1 route: POST /v1/webhooks/stripe

import type { RouteDefinition } from '../../routes/index';
import type { ApiRequest, ApiResponse } from '../../types';
import {
  createMockRequest,
  executeHandler,
} from '../../testing/routeTestHelper';

// ---- module mocks (hoisted by jest) ----

jest.mock('../../services/subscription', () => ({
  handleWebhookEvent: jest.fn(),
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

import { stripeWebhookRoutes } from '../webhooks/stripe';
import { handleWebhookEvent } from '../../services/subscription';

const mockHandleWebhookEvent = handleWebhookEvent as jest.Mock;

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

// ---- setup ----

beforeAll(() => {
  routes = stripeWebhookRoutes();
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================
// POST /v1/webhooks/stripe
// ============================================================

describe('POST /v1/webhooks/stripe', () => {
  const route = () => findRoute('POST', '/v1/webhooks/stripe');

  it('processes valid webhook event', async () => {
    mockHandleWebhookEvent.mockResolvedValueOnce(undefined);
    const res = await exec(route(), {
      auth: undefined,
      headers: { 'stripe-signature': 'whsec_test_sig' },
      body: JSON.stringify({ type: 'checkout.session.completed' }),
    });
    expect(res.statusCode).toBe(200);
    expect((res.body as { received: boolean }).received).toBe(true);
    expect(mockHandleWebhookEvent).toHaveBeenCalledWith(
      expect.any(String),
      'whsec_test_sig',
    );
  });

  it('returns 400 when stripe-signature header is missing', async () => {
    const res = await exec(route(), {
      auth: undefined,
      headers: {},
      body: JSON.stringify({ type: 'checkout.session.completed' }),
    });
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('BAD_REQUEST');
  });

  it('returns 400 on webhook processing error', async () => {
    mockHandleWebhookEvent.mockRejectedValueOnce(new Error('Invalid signature'));
    const res = await exec(route(), {
      auth: undefined,
      headers: { 'stripe-signature': 'whsec_bad_sig' },
      body: JSON.stringify({ type: 'checkout.session.completed' }),
    });
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('WEBHOOK_ERROR');
  });

  it('handles string body directly', async () => {
    mockHandleWebhookEvent.mockResolvedValueOnce(undefined);
    const rawBody = '{"type":"customer.subscription.updated"}';
    const res = await exec(route(), {
      auth: undefined,
      headers: { 'stripe-signature': 'whsec_test_sig' },
      body: rawBody,
    });
    expect(res.statusCode).toBe(200);
    expect(mockHandleWebhookEvent).toHaveBeenCalledWith(rawBody, 'whsec_test_sig');
  });
});
