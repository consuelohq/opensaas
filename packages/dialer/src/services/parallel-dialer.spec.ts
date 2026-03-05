import { ParallelDialerService, InMemoryParallelStore } from './parallel-dialer';

const mockCallsCreate = jest.fn();
const mockCallUpdate = jest.fn();

const mockClient = {
  calls: Object.assign(
    (sid: string) => ({ update: mockCallUpdate }),
    { create: mockCallsCreate },
  ),
};

jest.mock('twilio', () => ({
  __esModule: true,
  default: () => mockClient,
}));

describe('ParallelDialerService', () => {
  let store: InMemoryParallelStore;
  let service: ParallelDialerService;

  const baseOpts = {
    customerNumbers: ['+15551111111', '+15552222222', '+15553333333'],
    fromNumbers: ['+15554444444', '+15555555555', '+15556666666'],
    queueId: 'queue-1',
    userId: 'user-1',
    statusCallbackUrl: 'https://example.com/status',
    customerTwimlUrl: 'https://example.com/twiml',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    store = new InMemoryParallelStore();
    service = new ParallelDialerService(
      { accountSid: 'AC_test', authToken: 'test_token' },
      store,
    );

    let callCount = 0;
    mockCallsCreate.mockImplementation(() => {
      callCount++;
      return Promise.resolve({ sid: `CA_call_${callCount}` });
    });
  });

  describe('initiateGroup', () => {
    it('should create 3 concurrent calls and return group state', async () => {
      const result = await service.initiateGroup(baseOpts);
      expect(result.calls).toHaveLength(3);
      expect(result.groupId).toMatch(/^pg_/);
      expect(result.conferenceName).toContain(result.groupId);
      expect(mockCallsCreate).toHaveBeenCalledTimes(3);
    });

    it('should store group state in the store', async () => {
      const result = await service.initiateGroup(baseOpts);
      const group = await service.getGroup(result.groupId);
      expect(group).not.toBeNull();
      expect(group!.status).toBe('dialing');
      expect(group!.calls).toHaveLength(3);
    });

    it('should set call mappings for reverse lookup', async () => {
      const result = await service.initiateGroup(baseOpts);
      for (const call of result.calls) {
        const groupId = await service.getGroupIdForCall(call.callSid);
        expect(groupId).toBe(result.groupId);
      }
    });

    it('should throw when twilio fails', async () => {
      mockCallsCreate.mockRejectedValue(new Error('twilio error'));
      await expect(service.initiateGroup(baseOpts)).rejects.toThrow('twilio error');
    });
  });

  describe('handleStatusCallback', () => {
    it('should detect winner when human answers first', async () => {
      const result = await service.initiateGroup(baseOpts);
      const winnerSid = result.calls[0].callSid;

      await service.handleStatusCallback(winnerSid, 'in-progress', 'human');

      const group = await service.getGroup(result.groupId);
      expect(group!.winnerSid).toBe(winnerSid);
      expect(group!.status).toBe('connected');
    });

    it('should terminate machine-detected calls', async () => {
      const result = await service.initiateGroup(baseOpts);
      const machineSid = result.calls[0].callSid;

      await service.handleStatusCallback(machineSid, 'in-progress', 'machine');

      const group = await service.getGroup(result.groupId);
      expect(group!.winnerSid).toBeNull();
      // call should be terminated
      expect(mockCallUpdate).toHaveBeenCalledWith({ status: 'completed' });
    });

    it('should reject second answerer (SETNX race)', async () => {
      const result = await service.initiateGroup(baseOpts);

      // first human wins
      await service.handleStatusCallback(result.calls[0].callSid, 'in-progress', 'human');
      // second human loses
      await service.handleStatusCallback(result.calls[1].callSid, 'in-progress', 'human');

      const group = await service.getGroup(result.groupId);
      expect(group!.winnerSid).toBe(result.calls[0].callSid);
    });

    it('should mark group completed when all calls resolve with no winner', async () => {
      const result = await service.initiateGroup(baseOpts);

      for (const call of result.calls) {
        await service.handleStatusCallback(call.callSid, 'no-answer');
      }

      const group = await service.getGroup(result.groupId);
      expect(group!.status).toBe('completed');
      expect(group!.winnerSid).toBeNull();
    });

    it('should silently ignore unknown callSid', async () => {
      // should not throw
      await service.handleStatusCallback('CA_unknown', 'in-progress', 'human');
    });
  });

  describe('terminateGroup', () => {
    it('should terminate all pending calls', async () => {
      const result = await service.initiateGroup(baseOpts);
      await service.terminateGroup(result.groupId);

      const group = await service.getGroup(result.groupId);
      expect(group!.status).toBe('completed');
      expect(group!.calls.every((c) => c.status === 'completed')).toBe(true);
    });

    it('should handle non-existent group gracefully', async () => {
      // should not throw
      await service.terminateGroup('pg_nonexistent');
    });
  });

  describe('getReleasableNumbers', () => {
    it('should return non-winner from numbers', async () => {
      const result = await service.initiateGroup(baseOpts);
      await service.handleStatusCallback(result.calls[0].callSid, 'in-progress', 'human');

      const group = await service.getGroup(result.groupId);
      const releasable = service.getReleasableNumbers(group!);
      expect(releasable).toHaveLength(2);
      expect(releasable).not.toContain(baseOpts.fromNumbers[0]);
    });
  });

  describe('validateRequirements', () => {
    it('should pass with 3+ numbers', () => {
      expect(service.validateRequirements(3).valid).toBe(true);
      expect(service.validateRequirements(5).valid).toBe(true);
    });

    it('should fail with fewer than 3 numbers', () => {
      const result = service.validateRequirements(2);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('at least 3');
    });
  });

  describe('generateCustomerTwiml', () => {
    it('should return TwiML for a known call', async () => {
      const result = await service.initiateGroup(baseOpts);
      const twiml = await service.generateCustomerTwiml(result.calls[0].callSid);
      expect(twiml).toContain('<Conference');
      expect(twiml).toContain(result.conferenceName);
    });

    it('should return null for unknown call', async () => {
      const twiml = await service.generateCustomerTwiml('CA_unknown');
      expect(twiml).toBeNull();
    });
  });
});
