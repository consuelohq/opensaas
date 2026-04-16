import type { RouteDefinition } from '../index';
import { createAuthenticatedRequest, executeHandler } from '../../testing/routeTestHelper';

jest.mock('../../shared/dialer', () => ({
  getDialerForWorkspace: jest.fn(),
  sharedDialer: jest.fn(),
  sharedCallerIdLockService: jest.fn(),
}));

jest.mock('../../services/redis', () => ({
  redisService: {
    setPhoneCallState: jest.fn(),
    mapCallSidToCallId: jest.fn(),
    publishCallEvent: jest.fn(),
  },
}));

jest.mock('../../services/callback-routing', () => ({
  storeRecentCallbackRoute: jest.fn(),
}));

jest.mock('../../services/retry-policy', () => ({
  evaluateRetryPolicy: jest.fn(),
}));

jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

jest.mock('@consuelo/logger', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock('node:crypto', () => ({
  randomUUID: jest.fn()
    .mockReturnValueOnce('call-id-001')
    .mockReturnValueOnce('conf-id-001')
    .mockReturnValue('extra-id-001'),
}));

import { callRoutes } from '../calls';
import { getDialerForWorkspace, sharedCallerIdLockService } from '../../shared/dialer';
import { redisService } from '../../services/redis';
import { storeRecentCallbackRoute } from '../../services/callback-routing';

type Route = RouteDefinition;
let routes: Route[];

const mockDialer = {
  dial: jest.fn(),
  createCall: jest.fn(),
  listNumbers: jest.fn(),
  resolveCallerId: jest.fn(),
  conference: {
    generateConferenceTwiml: jest.fn(),
  },
};

const mockLockService = {
  acquireLock: jest.fn(),
};

const mockRedis = redisService as unknown as Record<string, jest.Mock>;
const mockCallbackRouting = {
  storeRecentCallbackRoute: storeRecentCallbackRoute as jest.Mock,
};

(getDialerForWorkspace as jest.Mock).mockResolvedValue(mockDialer);
(sharedCallerIdLockService as unknown as jest.Mock).mockReturnValue(mockLockService);

const findRoute = (method: string, path: string): Route => {
  const route = routes.find((candidate) => candidate.method === method && candidate.path === path);

  if (!route) {
    throw new Error(`route not found: ${method} ${path}`);
  }

  return route;
};

const exec = (route: Route, req: Record<string, unknown>) =>
  executeHandler(route.handler, req);

beforeAll(() => {
  process.env.API_BASE_URL = 'https://api.example.com';
  routes = callRoutes();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockDialer.dial.mockResolvedValue({
    success: true,
    callSid: 'CA-dial-001',
    fromNumber: '+15551230000',
  });
  mockDialer.createCall.mockResolvedValue({ callSid: 'CA-create-001' });
  mockDialer.listNumbers.mockResolvedValue([]);
  mockDialer.resolveCallerId.mockResolvedValue({ callerIdNumber: '+15550000000' });
  mockDialer.conference.generateConferenceTwiml.mockReturnValue(
    '<Response><Conference>conf-phone-conf-id-001</Conference></Response>',
  );
  mockLockService.acquireLock.mockResolvedValue(true);
  mockRedis.setPhoneCallState.mockResolvedValue(undefined);
  mockRedis.mapCallSidToCallId.mockResolvedValue(undefined);
  mockRedis.publishCallEvent.mockResolvedValue(undefined);
  mockCallbackRouting.storeRecentCallbackRoute.mockResolvedValue(true);
});

describe('POST /v1/calls', () => {
  const route = () => findRoute('POST', '/v1/calls');

  it('persists recent callback routing after a successful outbound browser call', async () => {
    const res = await exec(
      route(),
      createAuthenticatedRequest({
        body: {
          to: '+15559876543',
          from: '+15551112222',
        },
      }) as unknown as Record<string, unknown>,
    );

    expect(res.statusCode).toBe(201);
    expect(mockCallbackRouting.storeRecentCallbackRoute).toHaveBeenCalledWith({
      workspaceId: 'ws-test-001',
      userId: 'user-test-001',
      twilioNumber: '+15551230000',
      prospectNumber: '+15559876543',
    });
  });
});

describe('POST /v1/calls/callback', () => {
  const route = () => findRoute('POST', '/v1/calls/callback');

  it('persists recent callback routing after a successful callback bridge call', async () => {
    const res = await exec(
      route(),
      createAuthenticatedRequest({
        body: {
          agentPhone: '+15551112222',
          customerPhone: '+15559876543',
          callerId: '+15551230000',
        },
      }) as unknown as Record<string, unknown>,
    );

    expect(res.statusCode).toBe(201);
    expect(mockCallbackRouting.storeRecentCallbackRoute).toHaveBeenCalledWith({
      workspaceId: 'ws-test-001',
      userId: 'user-test-001',
      twilioNumber: '+15551230000',
      prospectNumber: '+15559876543',
    });
  });
});

describe('POST /v1/calls/initiate-phone', () => {
  const route = () => findRoute('POST', '/v1/calls/initiate-phone');

  it('persists recent callback routing after a successful phone-initiated call', async () => {
    const res = await exec(
      route(),
      createAuthenticatedRequest({
        body: {
          repPhone: '+15551112222',
          leadPhone: '+15559876543',
          from: '+15551230000',
        },
      }) as unknown as Record<string, unknown>,
    );

    expect(res.statusCode).toBe(201);
    expect(mockCallbackRouting.storeRecentCallbackRoute).toHaveBeenCalledWith({
      workspaceId: 'ws-test-001',
      userId: 'user-test-001',
      twilioNumber: '+15551230000',
      prospectNumber: '+15559876543',
    });
  });
});
