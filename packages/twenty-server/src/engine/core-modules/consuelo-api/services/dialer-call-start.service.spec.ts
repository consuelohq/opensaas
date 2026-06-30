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
    delete process.env.API_BASE_URL;
    delete process.env.TWILIO_TEST_ACCOUNT_SID;
    delete process.env.TWILIO_TEST_AUTH_TOKEN;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
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
      callableTargetCount: 1,
      availableCallerIdCount: 1,
      reducedCapacityReasons: [],
      blockedReasons: [],
      actualFanout: 1,
    });
    expect(result.calls).toEqual([
      expect.objectContaining({
        contactId: 'contact-direct',
        customerNumber: '+14155552671',
        callerId: '+12025550123',
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
      callableTargetCount: 2,
      availableCallerIdCount: 1,
      reducedCapacityReasons: ['caller-id-capacity'],
      blockedReasons: [],
      actualFanout: 1,
    });
    expect(result.calls).toHaveLength(1);
    expect(result.calls[0]).toEqual(
      expect.objectContaining({
        contactId: 'contact-one',
        customerNumber: '+14155552671',
        callerId: '+12025550123',
        status: 'mocked',
      }),
    );
  });

  it('should include the active calling queue item when starting predictive dialing', async () => {
    const { service, mockQuery } = createService();

    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM queue_items qi')) {
        expect(sql).toContain("qi.status IN ('calling', 'pending')");
        expect(sql).toContain(
          "CASE qi.status WHEN 'calling' THEN 0 ELSE 1 END",
        );

        return [
          {
            queue_item_id: 'queue-item-active',
            contact_id: 'contact-active',
            attempts: 1,
            phone: '+14155552671',
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
        queueId: 'queue-active',
        callerIdNumber: '+12025550123',
        callMode: 'mock',
      },
    });

    expect(result.queueId).toBe('queue-active');
    expect(result.actualFanout).toBe(1);
    expect(result.capacity).toEqual({
      requestedFanout: 2,
      callableTargetCount: 1,
      availableCallerIdCount: 1,
      reducedCapacityReasons: [
        'callable-target-capacity',
        'caller-id-capacity',
      ],
      blockedReasons: [],
      actualFanout: 1,
    });
    expect(result.calls[0]).toEqual(
      expect.objectContaining({
        contactId: 'contact-active',
        customerNumber: '+14155552671',
        callerId: '+12025550123',
        status: 'mocked',
      }),
    );
  });

  it('should resolve queue targets keyed by workspace person id phone fields', async () => {
    const { service, mockQuery } = createService();

    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM queue_items qi')) {
        expect(sql).toContain('LEFT JOIN contacts');
        expect(sql).toContain('LEFT JOIN "workspace_');
        expect(sql).toContain('"."person" person');
        expect(sql).toContain('person."phonesPrimaryPhoneCallingCode"');
        expect(sql).toContain('person."phonesPrimaryPhoneNumber"');

        return [
          {
            queue_item_id: 'queue-item-person',
            contact_id: 'person-contact-id',
            attempts: 1,
            phone: '+14155552671',
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
        requestedFanout: 1,
        queueId: 'queue-person',
        callerIdNumber: '+12025550123',
        callMode: 'mock',
      },
    });

    expect(result.actualFanout).toBe(1);
    expect(result.capacity).toEqual({
      requestedFanout: 1,
      callableTargetCount: 1,
      availableCallerIdCount: 1,
      reducedCapacityReasons: [],
      blockedReasons: [],
      actualFanout: 1,
    });
    expect(result.calls[0]).toEqual(
      expect.objectContaining({
        contactId: 'person-contact-id',
        customerNumber: '+14155552671',
        callerId: '+12025550123',
        status: 'mocked',
      }),
    );
  });

  it('should use input target phone fallback when queue person fields are empty', async () => {
    const { service, mockQuery } = createService();

    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM queue_items qi')) {
        return [
          {
            queue_item_id: 'queue-item-fallback',
            contact_id: 'person-contact-id',
            attempts: 1,
            phone: null,
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
        requestedFanout: 1,
        queueId: 'queue-person',
        contactIds: ['person-contact-id'],
        targetPhones: ['+14155552671'],
        callerIdNumber: '+12025550123',
        callMode: 'mock',
      },
    });

    expect(result.actualFanout).toBe(1);
    expect(result.calls[0]).toEqual(
      expect.objectContaining({
        contactId: 'person-contact-id',
        customerNumber: '+14155552671',
        callerId: '+12025550123',
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

  it('should fail closed for twilio-test starts without test credentials', async () => {
    const { service, mockQuery } = createService();

    process.env.CONSUELO_SCENARIO_SAFE_TO_NUMBERS = '+14155552671';
    process.env.CONSUELO_SCENARIO_SAFE_FROM_NUMBERS = '+12025550123';
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
          callMode: 'twilio-test',
        },
      }),
    ).rejects.toThrow(
      'twilio-test mode requires TWILIO_TEST_ACCOUNT_SID and TWILIO_TEST_AUTH_TOKEN',
    );
  });

  it('should fail closed for twilio-test starts without a public callback base URL', async () => {
    const { service, mockQuery, mockLegacyDialerService } = createService();

    process.env.TWILIO_TEST_ACCOUNT_SID = 'AC_TEST_ACCOUNT';
    process.env.TWILIO_TEST_AUTH_TOKEN = 'test-auth-token';
    process.env.TWILIO_ACCOUNT_SID = 'AC_LIVE_ACCOUNT';
    process.env.TWILIO_AUTH_TOKEN = 'live-auth-token';
    process.env.CONSUELO_SCENARIO_SAFE_TO_NUMBERS = '+14155552671';
    process.env.CONSUELO_SCENARIO_SAFE_FROM_NUMBERS = '+12025550123';
    mockLegacyDialerService.getCallerIdLockService.mockReturnValue({
      acquireLock: jest.fn().mockResolvedValue(true),
      transferLock: jest.fn(),
      releaseLockByNumber: jest.fn(),
    });
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
          callMode: 'twilio-test',
        },
      }),
    ).rejects.toThrow(
      'Twilio-backed dialer mode requires a public HTTPS API_BASE_URL or SERVER_URL for callbacks',
    );
  });

  it('should transfer pending caller ID locks to call SIDs without releasing the number', async () => {
    const { service, mockQuery, mockLegacyDialerService } = createService();
    const mockLockService = {
      acquireLock: jest.fn().mockResolvedValue(true),
      transferLock: jest.fn().mockResolvedValue(true),
      releaseLockByNumber: jest.fn(),
    };
    const mockDialer = {
      parallel: {
        initiateGroup: jest.fn().mockResolvedValue({
          groupId: 'pg_test',
          calls: [
            {
              callSid: 'CA_TEST_CALL',
              fromNumber: '+12025550123',
              position: 1,
              status: 'dialing',
            },
          ],
        }),
        terminateGroup: jest.fn(),
      },
    };

    process.env.API_BASE_URL = 'https://dev-1499.example.test';
    process.env.CONSUELO_SCENARIO_SAFE_TO_NUMBERS = '+14155552671';
    process.env.CONSUELO_SCENARIO_SAFE_FROM_NUMBERS = '+12025550123';
    mockLegacyDialerService.getCallerIdLockService.mockReturnValue(
      mockLockService,
    );
    mockLegacyDialerService.getDialer.mockReturnValue(mockDialer);
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
        callMode: 'live',
      },
    });

    const pendingCallSid = mockLockService.acquireLock.mock.calls[0][2];

    expect(result.calls[0]).toEqual(
      expect.objectContaining({
        callSid: 'CA_TEST_CALL',
        customerNumber: '+14155552671',
        callerId: '+12025550123',
      }),
    );
    expect(result.twilioGroupId).toBe('pg_test');
    expect(mockLockService.transferLock).toHaveBeenCalledWith(
      '+12025550123',
      pendingCallSid,
      'CA_TEST_CALL',
    );
    expect(mockLockService.releaseLockByNumber).not.toHaveBeenCalled();
  });

  it('should use the live product path without scenario allowlists when call mode is omitted', async () => {
    const { service, mockQuery, mockLegacyDialerService } = createService();
    const mockLockService = {
      acquireLock: jest.fn().mockResolvedValue(true),
      transferLock: jest.fn().mockResolvedValue(true),
      releaseLockByNumber: jest.fn(),
      isNumberAvailable: jest.fn().mockResolvedValue(true),
    };
    const mockDialer = {
      listNumbers: jest.fn().mockResolvedValue([
        {
          phoneNumber: '+12025550123',
        },
      ]),
      parallel: {
        initiateGroup: jest.fn().mockResolvedValue({
          groupId: 'pg_product',
          calls: [
            {
              callSid: 'CA_PRODUCT_CALL',
              fromNumber: '+12025550123',
              position: 1,
              status: 'dialing',
            },
          ],
        }),
        terminateGroup: jest.fn(),
      },
    };

    process.env.API_BASE_URL = 'https://dev-1499.example.test';
    mockLegacyDialerService.getCallerIdLockService.mockReturnValue(
      mockLockService,
    );
    mockLegacyDialerService.getDialer.mockReturnValue(mockDialer);
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
      },
    });

    expect(result.status).toBe('dialing');
    expect(result.twilioGroupId).toBe('pg_product');
    expect(mockDialer.listNumbers).toHaveBeenCalled();
    expect(mockDialer.parallel.initiateGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        customerNumbers: ['+14155552671'],
        fromNumbers: ['+12025550123'],
      }),
    );
  });

  it('should terminate created calls and release locks when lock transfer fails', async () => {
    const { service, mockQuery, mockLegacyDialerService } = createService();
    const mockLockService = {
      acquireLock: jest.fn().mockResolvedValue(true),
      transferLock: jest.fn().mockResolvedValue(false),
      releaseLockByNumber: jest.fn(),
    };
    const mockDialer = {
      parallel: {
        initiateGroup: jest.fn().mockResolvedValue({
          groupId: 'pg_test',
          calls: [
            {
              callSid: 'CA_TEST_CALL',
              fromNumber: '+12025550123',
              position: 1,
              status: 'dialing',
            },
          ],
        }),
        terminateGroup: jest.fn(),
      },
    };

    process.env.API_BASE_URL = 'https://dev-1499.example.test';
    process.env.CONSUELO_SCENARIO_SAFE_TO_NUMBERS = '+14155552671';
    process.env.CONSUELO_SCENARIO_SAFE_FROM_NUMBERS = '+12025550123';
    mockLegacyDialerService.getCallerIdLockService.mockReturnValue(
      mockLockService,
    );
    mockLegacyDialerService.getDialer.mockReturnValue(mockDialer);
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
    ).rejects.toThrow('Dialer call start failed');

    expect(mockDialer.parallel.terminateGroup).toHaveBeenCalledWith('pg_test');
    expect(mockLockService.releaseLockByNumber).toHaveBeenCalledWith(
      '+12025550123',
    );
  });

  it('should block a start when the caller ID lock is already held', async () => {
    const { service, mockQuery, mockLegacyDialerService } = createService();
    const mockLockService = {
      acquireLock: jest.fn().mockResolvedValue(false),
      transferLock: jest.fn(),
      releaseLockByNumber: jest.fn(),
    };
    const mockDialer = {
      parallel: {
        initiateGroup: jest.fn(),
        terminateGroup: jest.fn(),
      },
    };

    process.env.API_BASE_URL = 'https://dev-1499.example.test';
    process.env.CONSUELO_SCENARIO_SAFE_TO_NUMBERS = '+14155552671';
    process.env.CONSUELO_SCENARIO_SAFE_FROM_NUMBERS = '+12025550123';
    mockLegacyDialerService.getCallerIdLockService.mockReturnValue(
      mockLockService,
    );
    mockLegacyDialerService.getDialer.mockReturnValue(mockDialer);
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
    ).rejects.toThrow('Caller ID number is currently in use');

    expect(mockDialer.parallel.initiateGroup).not.toHaveBeenCalled();
  });
});
