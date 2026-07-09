jest.mock('@consuelo/contacts', () => ({
  isValidPhone: jest.fn((phoneNumber: string) =>
    /^\+\d{10,15}$/.test(phoneNumber),
  ),
  normalizePhone: jest.fn((phoneNumber: string) => phoneNumber),
}));

import { DialerCallStartResolver } from 'src/engine/core-modules/consuelo-api/resolvers/dialer-call-start.resolver';
import { type DialerCallStartService } from 'src/engine/core-modules/consuelo-api/services/dialer-call-start.service';
import { type ParallelService } from 'src/engine/core-modules/consuelo-api/services/parallel.service';

describe('DialerCallStartResolver', () => {
  it('should treat explicit null callMode as unspecified', async () => {
    const mockDialerCallStartService = {
      startDialerCall: jest.fn().mockResolvedValue({
        sessionId: 'session-test',
        twilioGroupId: null,
        queueId: 'queue-test',
        selectionStrategy: 'single',
        requestedFanout: 1,
        actualFanout: 1,
        status: 'dialing',
        capacity: {
          requestedFanout: 1,
          callableTargetCount: 1,
          availableCallerIdCount: 1,
          reducedCapacityReasons: [],
          blockedReasons: [],
          actualFanout: 1,
        },
        calls: [],
      }),
    } as unknown as DialerCallStartService;
    const mockParallelService = {
      terminateGroup: jest.fn(),
    } as unknown as ParallelService;
    const resolver = new DialerCallStartResolver(
      mockDialerCallStartService,
      mockParallelService,
    );

    await resolver.startDialerCall(
      { id: 'workspace-id' } as never,
      { id: 'user-id' } as never,
      {
        source: 'direct',
        selectionStrategy: 'single',
        requestedFanout: 1,
        targetPhone: '+14155552671',
        callMode: null,
      },
    );

    expect(mockDialerCallStartService.startDialerCall).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          callMode: null,
        }),
      }),
    );
  });

  it('should terminate by Twilio group ID', async () => {
    const mockDialerCallStartService = {
      startDialerCall: jest.fn(),
    } as unknown as DialerCallStartService;
    const mockParallelService = {
      terminateGroup: jest.fn().mockResolvedValue({
        groupId: 'pg_test',
        status: 'completed',
      }),
    } as unknown as ParallelService;
    const resolver = new DialerCallStartResolver(
      mockDialerCallStartService,
      mockParallelService,
    );

    await expect(
      resolver.terminateDialerCall(
        { id: 'workspace-id' } as never,
        { id: 'user-id' } as never,
        { twilioGroupId: 'pg_test' },
      ),
    ).resolves.toEqual({
      twilioGroupId: 'pg_test',
      status: 'completed',
    });
    expect(mockParallelService.terminateGroup).toHaveBeenCalledWith({
      groupId: 'pg_test',
      userId: 'user-id',
      workspaceId: 'workspace-id',
    });
  });
});
