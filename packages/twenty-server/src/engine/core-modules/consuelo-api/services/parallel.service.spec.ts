import type { ParallelGroup } from '@consuelo/dialer';

jest.mock('@consuelo/dialer', () => ({}), { virtual: true });
jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
}));

import { ParallelService } from 'src/engine/core-modules/consuelo-api/services/parallel.service';

describe('ParallelService posterior updates', () => {
  const buildGroup = (): ParallelGroup => ({
    groupId: 'group-1',
    conferenceName: 'conf-1',
    status: 'connected',
    winnerSid: 'CA_WINNER',
    calls: [
      {
        callSid: 'CA_WINNER',
        customerNumber: '+15550001111',
        fromNumber: '+15550002222',
        position: 0,
        status: 'in-progress',
        amdResult: 'human',
        dialStartedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      },
    ],
    queueId: 'queue-1',
    userId: 'user-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    connectedAt: new Date('2026-01-01T00:00:10.000Z').toISOString(),
    profile: {
      id: 'balanced',
      fanout: 3,
      staggerMs: 500,
      amdPolicy: 'human-or-unknown',
      terminationPolicy: 'winner-take-all',
    },
    resolverReason: 'thompson-sampling-global',
  });

  const createService = () => {
    const group = buildGroup();

    const mockDialer = {
      parallel: {
        handleStatusCallback: jest.fn().mockResolvedValue(undefined),
        getGroupIdForCall: jest.fn().mockResolvedValue(group.groupId),
        getGroup: jest.fn().mockResolvedValue(group),
        markTelemetryEmittedIfAbsent: jest.fn().mockResolvedValue(true),
        computeTelemetry: jest.fn().mockReturnValue({
          winnerRate: 1,
          wastedLegs: 2,
          connectLatencyMs: 1000,
        }),
      },
    };

    const mockLegacyDialerService = {
      getDialer: jest.fn().mockReturnValue(mockDialer),
    };

    const mockParallelPosteriorStore = {
      updatePosterior: jest.fn().mockResolvedValue(undefined),
    };

    const service = new ParallelService(
      mockLegacyDialerService as never,
      mockParallelPosteriorStore as never,
    );

    return { service, group, mockDialer, mockParallelPosteriorStore };
  };

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

    mockDialer.parallel.markTelemetryEmittedIfAbsent.mockResolvedValueOnce(false);

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
