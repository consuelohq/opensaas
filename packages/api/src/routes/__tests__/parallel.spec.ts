import type { RouteDefinition } from '../index';
import type { ApiRequest } from '../../types';
import {
  createAuthenticatedRequest,
  createMockRequest,
  createMockResponse,
} from '../../testing/routeTestHelper';

const mockDialerInstance = {
  listNumbers: jest.fn(),
  resolveCallerId: jest.fn(),
  parallel: {
    initiateGroup: jest.fn(),
    validateRequirements: jest.fn(),
    handleStatusCallback: jest.fn(),
    getGroupIdForCall: jest.fn(),
    getGroup: jest.fn(),
    getReleasableNumbers: jest.fn(),
    computeTelemetry: jest.fn(),
    markTelemetryEmitted: jest.fn(),
    generateCustomerTwiml: jest.fn(),
    terminateGroup: jest.fn(),
  },
};

const mockLockServiceInstance = {
  acquireLock: jest.fn(),
  releaseLock: jest.fn(),
  releaseLockByNumber: jest.fn(),
  getUserLocks: jest.fn(),
};

jest.mock('@consuelo/dialer', () => ({
  ParallelStrategyResolver: class {
    async resolve(input: { profileId?: string }) {
      const profiles = {
        conservative: {
          id: 'conservative',
          fanout: 2,
          staggerMs: 900,
          amdPolicy: 'human-or-unknown',
          terminationPolicy: 'winner-take-all',
        },
        balanced: {
          id: 'balanced',
          fanout: 3,
          staggerMs: 500,
          amdPolicy: 'human-or-unknown',
          terminationPolicy: 'winner-take-all',
        },
        aggressive: {
          id: 'aggressive',
          fanout: 4,
          staggerMs: 250,
          amdPolicy: 'human-only',
          terminationPolicy: 'winner-take-all',
        },
      };
      const profileId = input.profileId ?? 'balanced';
      return {
        profile:
          profiles[profileId as keyof typeof profiles] ?? profiles.balanced,
        reason: 'test-profile',
      };
    }
  },
}));

jest.mock('../../shared/dialer.js', () => ({
  getDialerForWorkspace: jest.fn(),
  sharedDialer: jest.fn(),
  sharedCallerIdLockService: jest.fn(),
}));

jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
}));

jest.mock('@consuelo/logger', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

import { parallelRoutes } from '../parallel';
import {
  getDialerForWorkspace,
  sharedCallerIdLockService,
  sharedDialer,
} from '../../shared/dialer.js';

const mockDialer = mockDialerInstance;
const mockLockService = mockLockServiceInstance;

(getDialerForWorkspace as jest.Mock).mockResolvedValue(mockDialer);
(sharedDialer as unknown as jest.Mock).mockReturnValue(mockDialer);
(sharedCallerIdLockService as unknown as jest.Mock).mockReturnValue(
  mockLockService,
);

const findRoute = (method: RouteDefinition['method'], path: string) => {
  const route = parallelRoutes().find(
    (candidate) => candidate.method === method && candidate.path === path,
  );

  if (!route) {
    throw new Error(`route not found: ${method} ${path}`);
  }

  return route;
};

const exec = async (
  route: RouteDefinition,
  request?: Partial<ApiRequest> & { auth?: ApiRequest['auth'] },
) => {
  const req = request?.auth
    ? createMockRequest(request)
    : createAuthenticatedRequest(request);
  const res = createMockResponse();
  await route.handler(req, res);
  return res._getData();
};

const defaultParallelBody = {
  customerNumbers: ['+15551111111', '+15552222222'],
  queueId: 'queue-test-001',
  contactIds: ['contact-1', 'contact-2'],
  profileId: 'conservative',
};

describe('POST /v1/calls/parallel', () => {
  const route = () => findRoute('POST', '/v1/calls/parallel');

  beforeEach(() => {
    jest.clearAllMocks();
    mockDialer.listNumbers.mockResolvedValue([
      {
        phoneNumber: '+15554444444',
        areaCode: '555',
        isPrimary: true,
        isActive: true,
      },
    ]);
    mockDialer.resolveCallerId.mockResolvedValue({
      callerIdNumber: '+15554444444',
    });
    mockDialer.parallel.initiateGroup.mockResolvedValue({
      groupId: 'pg-test-001',
      calls: [],
    });
    mockLockService.acquireLock.mockResolvedValue(true);
    mockLockService.releaseLockByNumber.mockResolvedValue(true);
  });

  it('locks duplicate resolved caller ids once for a single parallel batch', async () => {
    const res = await exec(route(), { body: defaultParallelBody });

    expect(res.statusCode).toBe(201);
    expect(mockLockService.acquireLock).toHaveBeenCalledTimes(1);
    expect(mockLockService.acquireLock).toHaveBeenCalledWith(
      '+15554444444',
      'user-test-001',
      'parallel-queue-test-001-0',
    );
    expect(mockDialer.parallel.initiateGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        customerNumbers: defaultParallelBody.customerNumbers,
        fromNumbers: ['+15554444444', '+15554444444'],
      }),
    );
  });

  it('releases acquired caller ids when parallel group creation fails', async () => {
    mockDialer.resolveCallerId
      .mockResolvedValueOnce({ callerIdNumber: '+15554444444' })
      .mockResolvedValueOnce({ callerIdNumber: '+15556666666' });
    mockDialer.parallel.initiateGroup.mockRejectedValueOnce(
      new Error('twilio unavailable'),
    );

    const res = await exec(route(), { body: defaultParallelBody });

    expect(res.statusCode).toBe(500);
    expect(mockLockService.releaseLockByNumber).toHaveBeenCalledWith(
      '+15554444444',
    );
    expect(mockLockService.releaseLockByNumber).toHaveBeenCalledWith(
      '+15556666666',
    );
  });

  it('returns 409 and releases earlier locks when a distinct caller id is busy', async () => {
    mockDialer.resolveCallerId
      .mockResolvedValueOnce({ callerIdNumber: '+15554444444' })
      .mockResolvedValueOnce({ callerIdNumber: '+15556666666' });
    mockLockService.acquireLock
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const res = await exec(route(), { body: defaultParallelBody });

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      error: {
        code: 'CALLER_ID_LOCKED',
        message: 'Caller ID +15556666666 is in use',
      },
    });
    expect(mockLockService.releaseLockByNumber).toHaveBeenCalledWith(
      '+15554444444',
    );
    expect(mockDialer.parallel.initiateGroup).not.toHaveBeenCalled();
  });
});
