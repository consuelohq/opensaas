import { Logger } from '@nestjs/common';

import type { ParallelGroup } from '@consuelo/dialer';

jest.mock(
  '@consuelo/dialer',
  () => ({
    ParallelStrategyResolver: class {},
  }),
  { virtual: true },
);
jest.mock('@consuelo/contacts', () => ({
  isValidPhone: jest.fn((phoneNumber: string) =>
    [
      '+14155552671',
      '+16505551234',
      '+12025550123',
      '+12125550123',
      '+18178447395',
    ].includes(phoneNumber),
  ),
  normalizePhone: jest.fn((phoneNumber: string) => {
    const normalizedPhonesByRawPhone: Record<string, string> = {
      '(415) 555-2671': '+14155552671',
      '650-555-1234': '+16505551234',
    };

    return normalizedPhonesByRawPhone[phoneNumber] ?? phoneNumber;
  }),
}));

jest.mock('@sentry/node', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

import { ParallelService } from 'src/engine/core-modules/consuelo-api/services/parallel.service';

beforeEach(() => {
  jest.clearAllMocks();
});

const buildGroup = (): ParallelGroup => ({
  groupId: 'group-1',
  conferenceName: 'conf-1',
  status: 'connected',
  winnerSid: 'CA_WINNER',
  calls: [
    {
      callSid: 'CA_WINNER',
      customerNumber: '+14155552671',
      fromNumber: '+12025550123',
      position: 0,
      status: 'in-progress',
      amdResult: 'human',
      contactId: 'contact-1',
      dialStartedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    },
    {
      callSid: 'CA_LOSER',
      customerNumber: '+16505551234',
      fromNumber: '+12125550123',
      position: 1,
      status: 'completed',
      amdResult: 'machine',
      contactId: 'contact-2',
      dialStartedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    },
  ],
  queueId: 'queue-1',
  userId: 'user-1',
  createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  connectedAt: new Date('2026-01-01T00:00:10.000Z').toISOString(),
  profile: {
    id: 'balanced',
    fanout: 2,
    staggerMs: 500,
    amdPolicy: 'human-or-unknown',
    terminationPolicy: 'winner-take-all',
  },
  resolverReason: 'thompson-sampling-global',
});

const buildStrategy = () => ({
  profile: {
    id: 'conservative' as const,
    fanout: 2,
    staggerMs: 900,
    amdPolicy: 'human-or-unknown' as const,
    terminationPolicy: 'winner-take-all' as const,
  },
  reason: 'explicit-profile-id',
});

const createService = () => {
  const group = buildGroup();
  const strategy = buildStrategy();
  const mockLockService = {
    acquireLock: jest.fn().mockResolvedValue(true),
    releaseLockByNumber: jest.fn().mockResolvedValue(undefined),
  };
  const mockDialer = {
    listNumbers: jest
      .fn()
      .mockResolvedValue(['+12025550123', '+12125550123', '+18178447395']),
    resolveCallerId: jest
      .fn()
      .mockResolvedValueOnce({ callerIdNumber: '+12025550123' })
      .mockResolvedValueOnce({ callerIdNumber: '+12125550123' }),
    parallel: {
      initiateGroup: jest.fn().mockResolvedValue({
        groupId: group.groupId,
        conferenceName: group.conferenceName,
        profileId: strategy.profile.id,
        calls: group.calls.map((call) => ({
          callSid: call.callSid,
          customerNumber: call.customerNumber,
          fromNumber: call.fromNumber,
          position: call.position,
          status: 'dialing',
        })),
      }),
      validateRequirements: jest.fn().mockReturnValue({
        valid: true,
        required: 2,
        current: 3,
      }),
      handleStatusCallback: jest.fn().mockResolvedValue(undefined),
      getGroupIdForCall: jest.fn().mockResolvedValue(group.groupId),
      getGroup: jest.fn().mockResolvedValue(group),
      getReleasableNumbers: jest.fn().mockReturnValue(['+12125550123']),
      markTelemetryEmittedIfAbsent: jest.fn().mockResolvedValue(true),
      computeTelemetry: jest.fn().mockReturnValue({
        winnerRate: 1,
        wastedLegs: 1,
        connectLatencyMs: 1000,
      }),
      generateCustomerTwiml: jest
        .fn()
        .mockResolvedValue('<?xml version="1.0"?><Response />'),
      terminateGroup: jest.fn().mockResolvedValue(undefined),
    },
  };

  const mockLegacyDialerService = {
    getDialer: jest.fn().mockReturnValue(mockDialer),
    getCallerIdLockService: jest.fn().mockReturnValue(mockLockService),
  };

  const mockParallelPosteriorStore = {
    updatePosterior: jest.fn().mockResolvedValue(undefined),
  };

  const mockParallelStrategyResolver = {
    resolve: jest.fn().mockResolvedValue(strategy),
  };

  const service = new ParallelService(
    mockLegacyDialerService as never,
    mockParallelPosteriorStore as never,
    mockParallelStrategyResolver as never,
  );

  return {
    service,
    group,
    mockDialer,
    mockLockService,
    mockParallelPosteriorStore,
    mockParallelStrategyResolver,
  };
};

describe('ParallelService initiateParallelDial', () => {
  it('should create a real parallel group through the legacy dialer bridge', async () => {
    const { service, group, mockDialer, mockParallelStrategyResolver } =
      createService();

    const result = await service.initiateParallelDial({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      body: {
        queueId: group.queueId,
        customerNumbers: ['+14155552671', '+16505551234'],
        contactIds: ['contact-1', 'contact-2'],
        profileId: 'conservative',
      },
    });

    expect(mockParallelStrategyResolver.resolve).toHaveBeenCalledWith({
      queueId: group.queueId,
      workspaceId: 'workspace-1',
      campaignSegment: undefined,
      recentAnswerRate: undefined,
      profileId: 'conservative',
    });
    expect(mockDialer.parallel.initiateGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        queueId: group.queueId,
        customerNumbers: ['+14155552671', '+16505551234'],
        contactIds: ['contact-1', 'contact-2'],
        userId: 'user-1',
        statusCallbackUrl: '/api/v1/calls/parallel/status-callback',
        customerTwimlUrl: '/api/v1/calls/parallel/customer-twiml',
      }),
    );
    expect(result.groupId).toBe(group.groupId);
  });

  it('should normalize valid customer numbers before initiating the group', async () => {
    const { service, group, mockDialer } = createService();

    await service.initiateParallelDial({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      body: {
        queueId: group.queueId,
        customerNumbers: ['(415) 555-2671', '650-555-1234'],
        profileId: 'conservative',
      },
    });

    expect(mockDialer.parallel.initiateGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        customerNumbers: ['+14155552671', '+16505551234'],
      }),
    );
  });

  it('should reject Twilio-invalid customer numbers before initiating the group', async () => {
    const { service, group, mockDialer, mockParallelStrategyResolver } =
      createService();

    await expect(
      service.initiateParallelDial({
        userId: 'user-1',
        workspaceId: 'workspace-1',
        body: {
          queueId: group.queueId,
          customerNumbers: ['584143861603', '+14155552671'],
          profileId: 'conservative',
        },
      }),
    ).rejects.toThrow('Invalid customer phone number');

    expect(mockParallelStrategyResolver.resolve).not.toHaveBeenCalled();
    expect(mockDialer.parallel.initiateGroup).not.toHaveBeenCalled();
  });

  it('should reject provider-denied customer numbers before returning a generic 500', async () => {
    const { service, group, mockDialer, mockLockService } = createService();

    const providerError = new Error(
      'Account not authorized to call +17876240936. geo-permissions',
    ) as Error & { code: number };

    providerError.code = 21215;
    mockDialer.parallel.initiateGroup.mockRejectedValueOnce(providerError);

    const loggerWarnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    await expect(
      service.initiateParallelDial({
        userId: 'user-1',
        workspaceId: 'workspace-1',
        body: {
          queueId: group.queueId,
          customerNumbers: ['+14155552671', '+16505551234'],
          profileId: 'conservative',
        },
      }),
    ).rejects.toThrow('Invalid customer phone number');

    expect(mockLockService.releaseLockByNumber).toHaveBeenCalledWith(
      '+12025550123',
    );
    expect(mockLockService.releaseLockByNumber).toHaveBeenCalledWith(
      '+12125550123',
    );
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      'parallel dial rejected customer number',
      expect.objectContaining({
        errorCode: '21215',
        errorMessage: 'Account not authorized to call ***0936. geo-permissions',
      }),
    );
  });

  it('should reject message-only provider-denied customer numbers as bad requests', async () => {
    const { service, group, mockDialer } = createService();

    mockDialer.parallel.initiateGroup.mockRejectedValueOnce(
      new Error('Account not authorized to call +17876240936. geo-permissions'),
    );

    const loggerWarnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    await expect(
      service.initiateParallelDial({
        userId: 'user-1',
        workspaceId: 'workspace-1',
        body: {
          queueId: group.queueId,
          customerNumbers: ['+14155552671', '+16505551234'],
          profileId: 'conservative',
        },
      }),
    ).rejects.toThrow('Invalid customer phone number');

    expect(loggerWarnSpy).toHaveBeenCalledWith(
      'parallel dial rejected customer number',
      expect.objectContaining({
        errorCode: null,
        errorMessage: 'Account not authorized to call ***0936. geo-permissions',
      }),
    );
  });

  it('should reject batches that do not match the resolved fanout', async () => {
    const { service, group, mockDialer } = createService();

    await expect(
      service.initiateParallelDial({
        userId: 'user-1',
        workspaceId: 'workspace-1',
        body: {
          queueId: group.queueId,
          customerNumbers: ['+14155552671'],
          profileId: 'conservative',
        },
      }),
    ).rejects.toThrow('requires exactly 2 customerNumbers');

    expect(mockDialer.parallel.initiateGroup).not.toHaveBeenCalled();
  });

  it('should reject and log when a caller-id lock cannot be acquired', async () => {
    const { service, group, mockDialer, mockLockService } = createService();
    const loggerWarnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    mockLockService.acquireLock
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    try {
      await expect(
        service.initiateParallelDial({
          userId: 'user-1',
          workspaceId: 'workspace-1',
          body: {
            queueId: group.queueId,
            customerNumbers: ['+14155552671', '+16505551234'],
            profileId: 'conservative',
          },
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'CALLER_ID_LOCKED',
          message: 'Caller ID is in use',
          retryAfterMs: 5000,
        }),
      });

      expect(mockLockService.releaseLockByNumber).toHaveBeenCalledWith(
        '+12025550123',
      );
      expect(mockLockService.releaseLockByNumber).not.toHaveBeenCalledWith(
        '+12125550123',
      );
      expect(mockDialer.parallel.initiateGroup).not.toHaveBeenCalled();
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'parallel dial blocked by caller id lock',
        expect.objectContaining({
          queueId: group.queueId,
          userId: 'user-1',
          lockedFromNumberSuffix: '0123',
        }),
      );
    } finally {
      loggerWarnSpy.mockRestore();
    }
  });

  it('should release caller-id locks when group creation fails', async () => {
    const { service, group, mockDialer, mockLockService } = createService();

    mockDialer.parallel.initiateGroup.mockRejectedValueOnce(
      new Error('twilio unavailable'),
    );

    await expect(
      service.initiateParallelDial({
        userId: 'user-1',
        workspaceId: 'workspace-1',
        body: {
          queueId: group.queueId,
          customerNumbers: ['+14155552671', '+16505551234'],
          profileId: 'conservative',
        },
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ message: 'twilio unavailable' }),
    });

    expect(mockLockService.releaseLockByNumber).toHaveBeenCalledWith(
      '+12025550123',
    );
    expect(mockLockService.releaseLockByNumber).toHaveBeenCalledWith(
      '+12125550123',
    );
  });

  it('should log the safe create stage and error details when group creation fails', async () => {
    const { service, group, mockDialer } = createService();
    const err = new Error('twilio unavailable');

    err.stack = 'Error: twilio unavailable';
    mockDialer.parallel.initiateGroup.mockRejectedValueOnce(err);

    const loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    try {
      await expect(
        service.initiateParallelDial({
          userId: 'user-1',
          workspaceId: 'workspace-1',
          body: {
            queueId: group.queueId,
            customerNumbers: ['+14155552671', '+16505551234'],
            profileId: 'conservative',
          },
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ message: 'twilio unavailable' }),
      });

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'parallel dial failed',
        expect.objectContaining({
          queueId: group.queueId,
          workspaceId: 'workspace-1',
          profileId: 'conservative',
          stage: 'initiate-group',
          customerNumberCount: 2,
          fromNumberCount: 2,
          errorName: 'Error',
          errorMessage: 'twilio unavailable',
          errorStack: 'Error: twilio unavailable',
        }),
      );

      const parallelFailureCall = loggerErrorSpy.mock.calls.find(
        ([message]) => message === 'parallel dial failed',
      );

      expect(parallelFailureCall?.[1]).not.toHaveProperty('customerNumbers');
      expect(parallelFailureCall?.[1]).not.toHaveProperty('fromNumbers');
    } finally {
      loggerErrorSpy.mockRestore();
    }
  });
});

describe('ParallelService validateParallelDial', () => {
  it('should validate the resolved profile without throwing not implemented', async () => {
    const { service, mockDialer } = createService();

    const result = await service.validateParallelDial({
      workspaceId: 'workspace-1',
      query: { queueId: 'queue-1', profileId: 'conservative' },
    });

    expect(mockDialer.parallel.validateRequirements).toHaveBeenCalledWith(3, 2);
    expect(result).toEqual(
      expect.objectContaining({
        valid: true,
        required: 2,
        current: 3,
        strategyReason: 'explicit-profile-id',
      }),
    );
  });
});

describe('ParallelService group lifecycle', () => {
  it('should include winner for frontend polling compatibility', async () => {
    const { service, group } = createService();

    const result = await service.getGroupStatus({
      groupId: group.groupId,
      workspaceId: 'workspace-1',
    });

    expect(result.winnerSid).toBe('CA_WINNER');
    expect(result.winner?.callSid).toBe('CA_WINNER');
  });

  it('should return customer twiml from the migrated route', async () => {
    const { service } = createService();

    await expect(service.customerTwiml({ CallSid: 'CA_WINNER' })).resolves.toBe(
      '<?xml version="1.0"?><Response />',
    );
  });

  it('should terminate the group and release caller-id locks', async () => {
    const { service, group, mockDialer, mockLockService } = createService();

    const result = await service.terminateGroup({
      groupId: group.groupId,
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });

    expect(mockLockService.releaseLockByNumber).toHaveBeenCalledWith(
      '+12025550123',
    );
    expect(mockLockService.releaseLockByNumber).toHaveBeenCalledWith(
      '+12125550123',
    );
    expect(mockDialer.parallel.terminateGroup).toHaveBeenCalledWith(
      group.groupId,
    );
    expect(result).toEqual({ groupId: group.groupId, status: 'completed' });
  });
});

describe('ParallelService posterior updates', () => {
  it('should increment alpha when success=true', async () => {
    const { service, mockParallelPosteriorStore } = createService();

    await service.statusCallback({
      CallSid: 'CA_WINNER',
      CallStatus: 'completed',
      CallDuration: '45',
    });

    expect(mockParallelPosteriorStore.updatePosterior).toHaveBeenCalledWith(
      'balanced',
      true,
    );
  });

  it('should increment beta when success=false', async () => {
    const { service, mockParallelPosteriorStore } = createService();

    await service.statusCallback({
      CallSid: 'CA_WINNER',
      CallStatus: 'completed',
      CallDuration: '5',
    });

    expect(mockParallelPosteriorStore.updatePosterior).toHaveBeenCalledWith(
      'balanced',
      false,
    );
  });

  it('should be idempotent and write once for the same group telemetry guard', async () => {
    const { service, mockDialer, mockParallelPosteriorStore } = createService();

    await service.statusCallback({
      CallSid: 'CA_WINNER',
      CallStatus: 'completed',
      CallDuration: '45',
    });

    mockDialer.parallel.markTelemetryEmittedIfAbsent.mockResolvedValueOnce(
      false,
    );

    await service.statusCallback({
      CallSid: 'CA_WINNER',
      CallStatus: 'completed',
      CallDuration: '45',
    });

    expect(mockParallelPosteriorStore.updatePosterior).toHaveBeenCalledTimes(1);
  });

  it('should degrade gracefully when db update fails and still return success response', async () => {
    const { service, mockParallelPosteriorStore } = createService();

    mockParallelPosteriorStore.updatePosterior.mockRejectedValueOnce(
      new Error('db write failed'),
    );

    await expect(
      service.statusCallback({
        CallSid: 'CA_WINNER',
        CallStatus: 'completed',
        CallDuration: '45',
      }),
    ).resolves.toEqual({ received: true });
  });
});
