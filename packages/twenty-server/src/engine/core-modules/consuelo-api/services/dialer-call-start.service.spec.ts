import type { DataSource } from 'typeorm';

jest.mock('@consuelo/contacts', () => ({
  isValidPhone: jest.fn((phoneNumber: string) =>
    /^\+\d{10,15}$/.test(phoneNumber),
  ),
  normalizePhone: jest.fn((phoneNumber: string) => phoneNumber),
}));

jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
}));

import { DialerCallStartService } from 'src/engine/core-modules/consuelo-api/services/dialer-call-start.service';

const WORKSPACE_ID = '3b8e6458-5fc1-4e63-8563-008ccddaa6db';
const USER_ID = '20202020-9e3b-46d4-a556-88b9ddc2b034';

const createService = () => {
  const mockQuery = jest.fn();
  const mockDataSource = {
    query: mockQuery,
  } as unknown as DataSource;
  const mockLegacyDialerService = {
    getDialer: jest.fn(),
    getCallerIdLockService: jest.fn(),
  };

  const service = new DialerCallStartService(
    mockDataSource,
    mockLegacyDialerService as never,
  );

  return {
    service,
    mockQuery,
    mockLegacyDialerService,
  };
};

describe('DialerCallStartService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CONSUELO_SCENARIO_SAFE_TO_NUMBERS;
    delete process.env.CONSUELO_SCENARIO_SAFE_FROM_NUMBERS;
  });

  it('should create a direct one-person queue and mock call for a typed phone target', async () => {
    const { service, mockQuery, mockLegacyDialerService } = createService();

    mockQuery.mockImplementation((sql: string) => {
      if (sql.startsWith('SELECT id, phone FROM contacts WHERE workspace_id')) {
        return [];
      }

      if (sql.startsWith('INSERT INTO contacts')) {
        return [{ id: 'contact-direct' }];
      }

      if (sql.startsWith('INSERT INTO call_queues')) {
        return [{ id: 'queue-direct' }];
      }

      return [];
    });

    const result = await service.startDialerCall({
      workspaceId: WORKSPACE_ID,
      userId: USER_ID,
      input: {
        source: 'direct',
        selectionStrategy: 'single',
        requestedFanout: 1,
        targetPhone: '+14155552671',
        callerIdNumber: '+12025550123',
        callMode: 'mock',
      },
    });

    expect(result.queueId).toBe('queue-direct');
    expect(result.selectionStrategy).toBe('single');
    expect(result.requestedFanout).toBe(1);
    expect(result.actualFanout).toBe(1);
    expect(result.status).toBe('mocked');
    expect(result.capacity).toEqual({
      requestedFanout: 1,
      callableUniqueTargets: 1,
      availableDistinctCallerIds: 1,
      actualFanout: 1,
    });
    expect(result.calls).toEqual([
      expect.objectContaining({
        contactId: 'contact-direct',
        to: '+14155552671',
        from: '+12025550123',
        status: 'mocked',
        position: 1,
      }),
    ]);
    expect(mockLegacyDialerService.getDialer).not.toHaveBeenCalled();
  });

  it('should allow predictive starts with actualFanout reduced to available caller ID capacity', async () => {
    const { service, mockQuery } = createService();

    mockQuery.mockImplementation((sql: string, params: unknown[]) => {
      if (sql.startsWith('SELECT id, phone FROM contacts WHERE workspace_id')) {
        const phone = params[1];

        return [
          {
            id: phone === '+14155552671' ? 'contact-one' : 'contact-two',
            phone,
          },
        ];
      }

      if (sql.startsWith('INSERT INTO call_queues')) {
        return [{ id: 'queue-predictive' }];
      }

      if (sql.includes('FROM queue_items qi')) {
        return [
          {
            queue_item_id: 'queue-item-one',
            contact_id: 'contact-one',
            attempts: 0,
            phone: '+14155552671',
            dnc_status: null,
          },
          {
            queue_item_id: 'queue-item-two',
            contact_id: 'contact-two',
            attempts: 0,
            phone: '+16505551234',
            dnc_status: null,
          },
        ];
      }

      return [];
    });

    const result = await service.startDialerCall({
      workspaceId: WORKSPACE_ID,
      userId: USER_ID,
      input: {
        source: 'queue',
        selectionStrategy: 'predictive',
        requestedFanout: 2,
        targetPhones: ['+14155552671', '+16505551234'],
        callerIdNumber: '+12025550123',
        callMode: 'mock',
      },
    });

    expect(result.queueId).toBe('queue-predictive');
    expect(result.selectionStrategy).toBe('predictive');
    expect(result.requestedFanout).toBe(2);
    expect(result.actualFanout).toBe(1);
    expect(result.capacity).toEqual({
      requestedFanout: 2,
      callableUniqueTargets: 2,
      availableDistinctCallerIds: 1,
      actualFanout: 1,
    });
    expect(result.calls).toHaveLength(1);
    expect(result.calls[0]).toEqual(
      expect.objectContaining({
        contactId: 'contact-one',
        to: '+14155552671',
        from: '+12025550123',
        status: 'mocked',
      }),
    );
  });

  it('should fail closed for live starts when the target is not allowlisted', async () => {
    const { service, mockQuery } = createService();

    process.env.CONSUELO_SCENARIO_SAFE_TO_NUMBERS = '+16505551234';
    process.env.CONSUELO_SCENARIO_SAFE_FROM_NUMBERS = '+12025550123';

    mockQuery.mockImplementation((sql: string) => {
      if (sql.startsWith('SELECT id, phone FROM contacts WHERE workspace_id')) {
        return [];
      }

      if (sql.startsWith('INSERT INTO contacts')) {
        return [{ id: 'contact-direct' }];
      }

      return [];
    });

    await expect(
      service.startDialerCall({
        workspaceId: WORKSPACE_ID,
        userId: USER_ID,
        input: {
          source: 'direct',
          selectionStrategy: 'single',
          requestedFanout: 1,
          targetPhone: '+14155552671',
          callerIdNumber: '+12025550123',
          callMode: 'live',
        },
      }),
    ).rejects.toThrow('Target phone number is not allowlisted');
  });
});
