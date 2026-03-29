import type { RouteDefinition } from '../index';
import type { ApiRequest } from '../../types';
import {
  createAuthenticatedRequest,
  createMockResponse,
} from '../../testing/routeTestHelper';
import { numberPacksRoutes } from '../number-packs';
import {
  getNumberPackStatus,
  createNumberPackCheckout,
} from '../../services/number-packs';

jest.mock('../../services/number-packs', () => ({
  getNumberPackStatus: jest.fn(),
  createNumberPackCheckout: jest.fn(),
}));

jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

const mockedGetNumberPackStatus = jest.mocked(getNumberPackStatus);
const mockedCreateNumberPackCheckout = jest.mocked(createNumberPackCheckout);

describe('numberPacksRoutes', () => {
  let routes: RouteDefinition[];

  beforeAll(() => {
    routes = numberPacksRoutes();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /v1/number-packs/status', () => {
    const findRoute = () =>
      routes.find((r) => r.method === 'GET' && r.path === '/v1/number-packs/status');
    const handler = () => findRoute()!.handler;

    it('should return 401 without auth', async () => {
      // HACK: minimal request object without auth to test 401 path
      const req = {} as unknown as ApiRequest;
      const res = createMockResponse();

      await handler()(req, res);

      expect(res._getData().statusCode).toBe(401);
    });

    it('should return pack status with valid auth', async () => {
      mockedGetNumberPackStatus.mockResolvedValueOnce({
        packs: {
          5: { count: 0, subscriptionIds: [] },
          10: { count: 0, subscriptionIds: [] },
          50: { count: 0, subscriptionIds: [] },
        },
        totalPackSlots: 0,
        canPurchase: true,
      });

      const req = createAuthenticatedRequest();
      const res = createMockResponse();
      await handler()(req, res);

      expect(res._getData().statusCode).toBe(200);
    });
  });

  describe('POST /v1/number-packs/checkout', () => {
    const findRoute = () =>
      routes.find((r) => r.method === 'POST' && r.path === '/v1/number-packs/checkout');
    const handler = () => findRoute()!.handler;

    it('should return 401 without auth', async () => {
      // HACK: minimal request object without auth to test 401 path
      const req = { body: {} } as unknown as ApiRequest;
      const res = createMockResponse();

      await handler()(req, res);

      expect(res._getData().statusCode).toBe(401);
    });

    it('should return 400 for missing required fields', async () => {
      const req = createAuthenticatedRequest({ body: {} });
      const res = createMockResponse();
      await handler()(req, res);

      expect(res._getData().statusCode).toBe(400);
    });

    it('should return 400 for invalid packSize', async () => {
      const req = createAuthenticatedRequest({
        body: { packSize: 7, billingInterval: 'month' },
      });
      const res = createMockResponse();
      await handler()(req, res);

      expect(res._getData().statusCode).toBe(400);
    });

    it('should return 400 for invalid billingInterval', async () => {
      const req = createAuthenticatedRequest({
        body: { packSize: 5, billingInterval: 'weekly' },
      });
      const res = createMockResponse();
      await handler()(req, res);

      expect(res._getData().statusCode).toBe(400);
    });

    it('should create checkout session with valid input', async () => {
      mockedCreateNumberPackCheckout.mockResolvedValueOnce({
        url: 'https://checkout.stripe.com/session',
      });

      const req = createAuthenticatedRequest({
        body: { packSize: 5, billingInterval: 'month' },
        headers: { origin: 'https://example.com' },
      });
      const res = createMockResponse();
      await handler()(req, res);

      expect(res._getData().statusCode).toBe(200);
    });
  });
});
